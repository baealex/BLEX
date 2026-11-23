import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { after, test } from 'node:test';
import { registerAuthorForms } from '../src/features/posts/author-forms.js';
import { accountTables, createMigratedTables, migratedTableSql } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-author-forms-'));
const databasePath = join(directory, 'synthetic-author-forms.sqlite3');
const database = new DatabaseSync(databasePath);
createMigratedTables(database, 'FormTemplate');
database.exec(`
  ${migratedTableSql(...accountTables)}
  INSERT INTO "User" ("id", "username", "email", "passwordHash", "joinedAt") VALUES
    (1, 'writer', '', '', 1577836800000),
    (2, 'other', '', '', 1577836800000),
    (3, 'third', '', '', 1577836800000);
  INSERT INTO FormTemplate (id, title, content, isPublic, userId, createdAt, updatedAt)
  VALUES (1, '첫 서식', '첫 번째 문단', 0, 1, ${Date.UTC(2024, 1, 1, 0, 30)}, ${Date.UTC(2024, 1, 1, 0, 30)});
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
    if (id === 3) return { id, username: 'third', hasEditorRole: true };
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

test('protects the form API by login, editor role, CSRF, and field limits', async () => {
  assert.equal((await app.inject('/v1/forms')).json().errorCode, 'error:NL');
  assert.equal((await app.inject({ url: '/v1/forms', headers: { 'x-test-user': '2' } })).json().errorCode, 'error:RJ');

  const rejected = await app.inject({
    method: 'PUT',
    url: '/v1/forms/1',
    headers: { ...apiHeaders, 'x-test-csrf': 'invalid' },
    payload: { title: '수정', content: '내용' },
  });
  assert.equal(rejected.statusCode, 403);
  const tooLong = await app.inject({
    method: 'PUT',
    url: '/v1/forms/1',
    headers: apiHeaders,
    payload: { title: 'x'.repeat(51), content: '내용' },
  });
  assert.equal(tooLong.json().errorCode, 'error:IP');
  const stored = await app.inject({ url: '/v1/forms/1', headers: writerHeaders });
  assert.deepEqual(stored.json().body, { id: 1, title: '첫 서식', content: '첫 번째 문단' });
});

test('preserves legacy form API envelopes and owner checks', async () => {
  const list = await app.inject({ url: '/v1/forms', headers: writerHeaders });
  assert.equal(list.json().status, 'DONE');
  assert.equal(list.json().body.forms[0].title, '첫 서식');
  assert.equal(list.json().body.forms[0].createdDate, '2024-02-01T09:30:00+09:00');

  const created = await app.inject({
    method: 'POST',
    url: '/v1/forms',
    headers: apiHeaders,
    payload: { title: '새 포스트 서식', content: '## 시작' },
  });
  assert.equal(created.json().status, 'DONE', created.body);
  const id = Number(created.json().body.id);
  assert.ok(id > 1);

  const detail = await app.inject({ url: `/v1/forms/${id}`, headers: writerHeaders });
  assert.deepEqual(detail.json().body, { id, title: '새 포스트 서식', content: '## 시작' });
  const readerDetail = await app.inject({ url: `/v1/forms/${id}`, headers: { 'x-test-user': '2' } });
  assert.equal(readerDetail.json().errorCode, 'error:RJ', readerDetail.body);

  const otherEditor = { 'x-test-user': '3', 'x-test-csrf': 'valid', 'content-type': 'application/json' };
  for (const method of ['GET', 'PUT', 'DELETE'] as const) {
    const denied = await app.inject({
      method,
      url: `/v1/forms/${id}`,
      headers: otherEditor,
      ...(method === 'GET' ? {} : { payload: { title: '남의 서식', content: '바꾸기' } }),
    });
    assert.equal(denied.statusCode, 404, `${method} ${denied.body}`);
  }
  assert.equal((await db.formTemplate.findUniqueOrThrow({ where: { id } })).title, '새 포스트 서식');

  const updated = await app.inject({
    method: 'PUT',
    url: `/v1/forms/${id}`,
    headers: apiHeaders,
    payload: { title: '수정된 서식', content: '수정 내용' },
  });
  assert.equal(updated.json().status, 'DONE');
  assert.equal((await app.inject({ url: `/v1/forms/${id}`, headers: writerHeaders })).json().body.title, '수정된 서식');

  const deleted = await app.inject({ method: 'DELETE', url: `/v1/forms/${id}`, headers: apiHeaders, payload: {} });
  assert.equal(deleted.json().status, 'DONE', deleted.body);
  assert.equal((await app.inject({ url: `/v1/forms/${id}`, headers: writerHeaders })).statusCode, 404);
});

test('renders Markdown by default and sanitizes HTML when sourceType asks for it', async () => {
  const render = async (payload: object) =>
    (await app.inject({ method: 'POST', url: '/v1/markdown', headers: apiHeaders, payload })).json().body
      .html as string;
  assert.match(await render({ text: '**bold**' }), /<strong>bold<\/strong>/);
  const html = await render({ text: '**kept**<script>alert(1)</script>', sourceType: 'html' });
  assert.ok(html.includes('**kept**'));
  assert.ok(!html.includes('<script'));
});
