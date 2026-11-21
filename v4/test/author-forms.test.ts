import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { after, test } from 'node:test';
import { registerAuthorForms } from '../src/author-forms.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-author-forms-'));
const databasePath = join(directory, 'synthetic-author-forms.sqlite3');
const database = new DatabaseSync(databasePath);
database.exec(`
  CREATE TABLE board_form (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    created_date DATETIME NOT NULL
  );
  INSERT INTO board_form (id, title, content, user_id, created_date)
  VALUES (1, '첫 서식', '첫 번째 문단', 1, '2024-02-01 00:30:00');
`);
database.close();

const db = new PrismaClient({ datasourceUrl: `file:${databasePath}?connection_limit=1` });
const app = Fastify();
await app.register(cookie);
registerAuthorForms(app, db, {
  siteUrl: new URL('https://blog.example'),
  currentUser: async (request) => {
    const raw = request.headers['x-test-user'];
    const id = Number(Array.isArray(raw) ? raw.at(-1) : raw);
    if (id === 1) return { id, username: 'writer', hasEditorRole: true };
    if (id === 2) return { id, username: 'reader', hasEditorRole: false };
    return null;
  },
  validateCsrf: (request) => request.headers['x-test-csrf'] === 'valid',
});
await app.ready();

after(async () => {
  await app.close();
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

const csrfToken = 'c'.repeat(43);
const writerHeaders = { 'x-test-user': '1', 'x-test-csrf': 'valid', cookie: `csrftoken=${csrfToken}` };
const apiHeaders = { ...writerHeaders, 'content-type': 'application/json' };

test('renders protected Korean form settings and Korean-localized dates', async () => {
  const anonymous = await app.inject('/settings/forms');
  assert.equal(anonymous.statusCode, 302);
  assert.equal(anonymous.headers.location, '/login?next=%2Fsettings%2Fforms');
  assert.equal((await app.inject({ url: '/settings/forms', headers: { 'x-test-user': '2' } })).statusCode, 404);

  const page = await app.inject({ url: '/settings/forms?id=1', headers: writerHeaders });
  assert.equal(page.statusCode, 200, page.body);
  assert.match(page.body, /<html lang="ko">/);
  assert.match(page.body, /data-site-header/);
  assert.match(page.body, /설정 메뉴/);
  assert.match(page.body, /저장된 서식 \(1\)/);
  assert.match(page.body, /첫 서식/);
  assert.match(page.body, /2024년 2월 1일/);
  assert.match(page.body, /새 포스트 작성/);
  assert.match(page.body, /서식 삭제/);

  const csrfPage = await app.inject({
    method: 'POST', url: '/settings/forms', headers: { ...writerHeaders, 'x-test-csrf': 'invalid' },
    payload: { id: '1', title: '수정', content: '내용', action: 'save' },
  });
  assert.equal(csrfPage.statusCode, 403);
  assert.match(csrfPage.body, /요청을 확인할 수 없습니다/);
  assert.match(csrfPage.body, new RegExp(`name="csrfmiddlewaretoken" value="${csrfToken}"`));
});

test('preserves legacy form API envelopes and owner checks', async () => {
  const list = await app.inject({ url: '/v1/forms', headers: writerHeaders });
  assert.equal(list.json().status, 'DONE');
  assert.equal(list.json().body.forms[0].title, '첫 서식');
  assert.equal(typeof list.json().body.forms[0].createdDate, 'string');

  const created = await app.inject({
    method: 'POST', url: '/v1/forms', headers: apiHeaders,
    payload: { title: '새 포스트 서식', content: '## 시작' },
  });
  assert.equal(created.json().status, 'DONE', created.body);
  const id = Number(created.json().body.id);
  assert.ok(id > 1);

  const detail = await app.inject({ url: `/v1/forms/${id}`, headers: writerHeaders });
  assert.deepEqual(detail.json().body, { id, title: '새 포스트 서식', content: '## 시작' });
  const readerDetail = await app.inject({ url: `/v1/forms/${id}`, headers: { 'x-test-user': '2' } });
  assert.equal(readerDetail.json().errorCode, 'error:AT', readerDetail.body);

  const updated = await app.inject({
    method: 'PUT', url: `/v1/forms/${id}`, headers: apiHeaders,
    payload: { title: '수정된 서식', content: '수정 내용' },
  });
  assert.equal(updated.json().status, 'DONE');
  assert.equal((await app.inject({ url: `/v1/forms/${id}`, headers: writerHeaders })).json().body.title, '수정된 서식');

  const deleted = await app.inject({ method: 'DELETE', url: `/v1/forms/${id}`, headers: apiHeaders, payload: {} });
  assert.equal(deleted.json().status, 'DONE', deleted.body);
  assert.equal((await app.inject({ url: `/v1/forms/${id}`, headers: writerHeaders })).statusCode, 404);
});
