import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { after, beforeEach, test } from 'node:test';
import { registerPublicMedia } from '../src/features/media/public-media.js';
import { registerWorkLogs } from '../src/features/work-logs/index.js';
import { insertRow } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-work-logs-'));
const databasePath = join(directory, 'work-logs.sqlite3');
const mediaRoot = join(directory, 'media');
const privateFileName = 'ab/demo.mp4';
const privateFilePath = join(mediaRoot, '_work_logs', privateFileName);
const csrfToken = 'a'.repeat(43);
const shareToken = '11111111-1111-4111-8111-111111111111';

const day = (date: number, month = 1) => Date.UTC(2025, month - 1, date);

function createDatabaseSchema() {
  const database = new DatabaseSync(databasePath);
  database.exec(readFileSync(new URL('../../prisma/migrations/0001_init/migration.sql', import.meta.url), 'utf8'));
  database.close();
}

function seedDatabase() {
  const database = new DatabaseSync(databasePath);
  database.exec('DELETE FROM WorkLog; DELETE FROM "Profile"; DELETE FROM "User";');
  for (const [id, username, isActive, role] of [[1, 'writer', 1, 'EDITOR'], [2, 'other', 1, 'EDITOR'], [3, 'reader', 1, 'READER'], [4, 'inactive', 0, 'EDITOR']] as const) {
    insertRow(database, 'User', { id, username, isActive: isActive });
    insertRow(database, 'Profile', { userId: id, role });
  }
  const log = database.prepare('INSERT INTO WorkLog (id, title, createdAt, ownerId) VALUES (?, ?, ?, ?)');
  log.run(1, 'Private notes', day(1), 1);
  log.run(2, 'Second log', day(2), 1);
  log.run(3, 'Other notes', day(3), 2);
  const entry = database.prepare('INSERT INTO WorkLogEntry (id, title, text, mediaType, attachment, createdAt, logId) VALUES (?, ?, ?, ?, ?, ?, ?)');
  entry.run(1, 'Private planning', 'not public unless selected', '', '', day(1), 1);
  entry.run(2, 'Selected clip', 'snapshot body', 'video/mp4', privateFileName, day(2), 1);
  entry.run(3, 'Later note', 'not in the earlier snapshot', '', '', day(3), 1);
  entry.run(4, 'Other log entry', 'other owner data', '', '', day(1), 3);
  database.prepare('INSERT INTO WorkLogShare (id, token, headline, createdAt, logId) VALUES (1, ?, ?, ?, 1)').run(shareToken.replaceAll('-', ''), 'Existing snapshot', day(4));
  database.exec('INSERT INTO _WorkLogEntryToWorkLogShare (A, B) VALUES (2, 1)');
  database.close();
}

createDatabaseSchema();
await mkdir(join(mediaRoot, '_work_logs', 'ab'), { recursive: true, mode: 0o700 });
const mediaBytes = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50, 0, 0, 0, 0]);
await (await import('node:fs/promises')).writeFile(privateFilePath, mediaBytes, { mode: 0o600 });
const prisma = new PrismaClient({ datasourceUrl: `file:${databasePath}?connection_limit=1` });
const app = Fastify();
registerWorkLogs(app, prisma, {
  siteUrl: new URL('https://blog.example'),
  mediaRoot,
  currentUser: async (request) => {
    const id = Number(request.headers['x-test-user']);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const database = new DatabaseSync(databasePath, { readOnly: true });
    const user = database.prepare('SELECT id, username FROM "User" WHERE id = ?').get(id) as { id: number; username: string } | undefined;
    database.close();
    return user ?? null;
  },
  validateCsrf: (request) => {
    const body = request.body as Record<string, unknown> | undefined;
    return request.headers['x-csrftoken'] === csrfToken &&
      request.headers.cookie?.includes(`csrftoken=${csrfToken}`) === true &&
      body?.csrfmiddlewaretoken === csrfToken;
  },
});
await registerPublicMedia(app, mediaRoot);
await app.ready();

beforeEach(async () => {
  seedDatabase();
  await rm(join(mediaRoot, '_work_logs'), { recursive: true, force: true });
  await mkdir(join(mediaRoot, '_work_logs', 'ab'), { recursive: true, mode: 0o700 });
  await (await import('node:fs/promises')).writeFile(privateFilePath, mediaBytes, { mode: 0o600 });
});

after(async () => {
  await app.close();
  await prisma.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

function headers(userId?: number, csrf = true) {
  return {
    ...(userId === undefined ? {} : { 'x-test-user': String(userId) }),
    ...(csrf ? {
      cookie: `csrftoken=${csrfToken}`,
      origin: 'https://blog.example',
      'x-csrftoken': csrfToken,
    } : {}),
  };
}

function formHeaders(userId?: number, csrf = true) {
  return { ...headers(userId, csrf), 'content-type': 'application/x-www-form-urlencoded' };
}

function form(fields: Array<[string, string]>) {
  return new URLSearchParams(fields).toString();
}

function multipart(fields: Array<[string, string]>, file: Buffer, boundary = 'work-log-boundary') {
  const parts: Buffer[] = [];
  for (const [name, value] of fields) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="attachment"; filename="upload.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`));
  parts.push(file);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { payload: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function listFiles(root: string, base = root): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const paths = await Promise.all(entries.map((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? listFiles(path, base) : Promise.resolve([relative(base, path)]);
  }));
  return paths.flat();
}

test('serves private owner pages with noindex headers and hides other owners’ logs', async () => {
  const unauthenticated = await app.inject('/work-logs/');
  assert.equal(unauthenticated.statusCode, 302);
  assert.match(unauthenticated.headers.location ?? '', /^\/login\?next=/);

  const index = await app.inject({ method: 'GET', url: '/work-logs/', headers: headers(1) });
  assert.equal(index.statusCode, 200, index.body);
  assert.match(index.headers['cache-control'] ?? '', /no-store/);
  assert.equal(index.headers['x-robots-tag'], 'noindex, nofollow, noarchive');
  assert.equal(index.headers['referrer-policy'], 'strict-origin');
  assert.match(index.body, /Private notes/);
  assert.match(index.body, /Second log/);
  assert.doesNotMatch(index.body, /Other notes/);
  assert.match(index.body, /기록 3개/);

  const ownerDetail = await app.inject({ method: 'GET', url: '/work-logs/1/', headers: headers(1) });
  assert.equal(ownerDetail.statusCode, 200, ownerDetail.body);
  assert.match(ownerDetail.body, /Private planning/);
  assert.match(ownerDetail.body, /Selected clip/);
  assert.match(ownerDetail.body, /기록 골라 공유하기/);

  const readerDetail = await app.inject({ method: 'GET', url: '/work-logs/1/', headers: headers(3) });
  assert.equal(readerDetail.statusCode, 404);
  const otherDetail = await app.inject({ method: 'GET', url: '/work-logs/1/', headers: headers(2) });
  assert.equal(otherDetail.statusCode, 404);
});

test('requires CSRF and editor role before creating logs or entries', async () => {
  const noCsrf = await app.inject({
    method: 'POST', url: '/work-logs/', headers: formHeaders(1, false),
    payload: form([['title', 'Blocked']]),
  });
  assert.equal(noCsrf.statusCode, 403);

  const readerWrite = await app.inject({
    method: 'POST', url: '/work-logs/', headers: formHeaders(3),
    payload: form([['csrfmiddlewaretoken', csrfToken], ['title', 'Reader log']]),
  });
  assert.equal(readerWrite.statusCode, 403);

  const created = await app.inject({
    method: 'POST', url: '/work-logs/', headers: formHeaders(1),
    payload: form([['csrfmiddlewaretoken', csrfToken], ['title', '  Created log  ']]),
  });
  assert.equal(created.statusCode, 302, created.body);
  assert.match(created.headers.location ?? '', /^\/work-logs\/\d+\/$/);
  const createdTitle = (await prisma.$queryRaw<Array<{ title: string }>>`SELECT title FROM WorkLog WHERE title = 'Created log'`)[0]?.title;
  assert.equal(createdTitle, 'Created log');

  const logId = Number(created.headers.location?.match(/\d+/)?.[0]);
  const entry = await app.inject({
    method: 'POST', url: `/work-logs/${logId}/entry/`, headers: formHeaders(1),
    payload: form([
      ['csrfmiddlewaretoken', csrfToken], ['title', 'Short note'], ['text', 'A useful observation.'],
    ]),
  });
  assert.equal(entry.statusCode, 302, entry.body);
  const saved = await prisma.$queryRaw<Array<{ title: string; text: string }>>`
    SELECT title, text FROM WorkLogEntry WHERE logId = ${logId}
  `;
  assert.deepEqual(saved, [{ title: 'Short note', text: 'A useful observation.' }]);
});

test('creates immutable entry snapshots, rejects cross-log selections, and revokes links', async () => {
  const crossLog = await app.inject({
    method: 'POST', url: '/work-logs/1/share/', headers: formHeaders(1),
    payload: form([
      ['csrfmiddlewaretoken', csrfToken], ['headline', 'Invalid selection'],
      ['entries', '4'], ['action', 'publish'],
    ]),
  });
  assert.equal(crossLog.statusCode, 200, crossLog.body);
  assert.match(crossLog.body, /이 작업 일지의 기록을 선택해 주세요/);
  assert.equal(Number((await prisma.$queryRaw<Array<{ total: number | bigint }>>`SELECT COUNT(*) AS total FROM WorkLogShare`)[0]?.total), 1);

  const published = await app.inject({
    method: 'POST', url: '/work-logs/1/share/', headers: formHeaders(1),
    payload: form([
      ['csrfmiddlewaretoken', csrfToken], ['headline', 'The draft stays'],
      ['entries', '1'], ['entries', '2'], ['action', 'publish'],
    ]),
  });
  assert.equal(published.statusCode, 302, published.body);
  const token = published.headers.location?.match(/share\/([^/]+)\//)?.[1];
  assert.ok(token);
  const shared = await app.inject(`/work-logs/share/${token}/`);
  assert.equal(shared.statusCode, 200, shared.body);
  assert.match(shared.body, /The draft stays/);
  assert.match(shared.body, /Private planning/);
  assert.match(shared.body, /Selected clip/);
  assert.doesNotMatch(shared.body, /Later note/);
  assert.equal(shared.headers['x-robots-tag'], 'noindex, nofollow, noarchive');
  assert.match(shared.headers['cache-control'] ?? '', /no-store/);

  const later = await app.inject({
    method: 'POST', url: '/work-logs/1/entry/', headers: formHeaders(1),
    payload: form([['csrfmiddlewaretoken', csrfToken], ['text', 'A note added after sharing.']]),
  });
  assert.equal(later.statusCode, 302);
  const unchanged = await app.inject(`/work-logs/share/${token}/`);
  assert.doesNotMatch(unchanged.body, /A note added after sharing/);

  const invalidCsrf = await app.inject({
    method: 'POST', url: `/work-logs/1/share/${token}/revoke/`, headers: formHeaders(1, false),
  });
  assert.equal(invalidCsrf.statusCode, 403);
  assert.equal((await app.inject(`/work-logs/share/${token}/`)).statusCode, 200);

  const database = new DatabaseSync(databasePath);
  database.prepare("UPDATE \"Profile\" SET role = 'READER' WHERE userId = 1").run();
  database.close();
  const revoked = await app.inject({
    method: 'POST', url: `/work-logs/1/share/${token}/revoke/`, headers: formHeaders(1),
    payload: form([['csrfmiddlewaretoken', csrfToken]]),
  });
  assert.equal(revoked.statusCode, 302, revoked.body);
  assert.equal((await app.inject(`/work-logs/share/${token}/`)).statusCode, 404);
});

test('disables shared pages and media when the log owner becomes inactive', async () => {
  const database = new DatabaseSync(databasePath);
  database.prepare('UPDATE "User" SET isActive = 0 WHERE id = 1').run();
  database.close();

  assert.equal((await app.inject(`/work-logs/share/${shareToken}/`)).statusCode, 404);
  assert.equal((await app.inject(`/work-logs/share/${shareToken}/media/2/`)).statusCode, 404);
});

test('keeps large share previews paginated through the POST preview flow', async () => {
  const database = new DatabaseSync(databasePath);
  const insert = database.prepare(`
    INSERT INTO WorkLogEntry (id, title, text, mediaType, attachment, createdAt, logId)
    VALUES (?, ?, '', '', '', ?, 1)
  `);
  for (let id = 10; id < 31; id += 1) {
    insert.run(id, `Preview entry ${id}`, day(id - 9, 2));
  }
  database.close();
  const selectedEntries = Array.from({ length: 21 }, (_value, index) => index + 10).join(',');

  const firstPage = await app.inject({
    method: 'POST', url: '/work-logs/1/share/', headers: formHeaders(1),
    payload: form([
      ['csrfmiddlewaretoken', csrfToken], ['action', 'preview'], ['headline', 'Long preview'],
      ['selected_entries', selectedEntries],
    ]),
  });
  assert.equal(firstPage.statusCode, 200, firstPage.body);
  assert.match(firstPage.body, /Preview entry 10/);
  assert.doesNotMatch(firstPage.body, /Preview entry 30/);
  assert.match(firstPage.body, /(?:name="preview_page"[^>]*value="2"|value="2"[^>]*name="preview_page")/);

  const secondPage = await app.inject({
    method: 'POST', url: '/work-logs/1/share/', headers: formHeaders(1),
    payload: form([
      ['csrfmiddlewaretoken', csrfToken], ['action', 'preview'], ['headline', 'Long preview'],
      ['selected_entries', selectedEntries], ['preview_page', '2'],
    ]),
  });
  assert.equal(secondPage.statusCode, 200, secondPage.body);
  assert.doesNotMatch(secondPage.body, /Preview entry 10/);
  assert.match(secondPage.body, /Preview entry 30/);
});

test('gates private and shared media, supports byte ranges, and blocks public static access', async () => {
  const privateMedia = await app.inject({ method: 'GET', url: '/work-logs/1/media/2/', headers: headers(1) });
  assert.equal(privateMedia.statusCode, 200, privateMedia.body);
  assert.equal(privateMedia.headers['content-type'], 'video/mp4');
  assert.equal(privateMedia.headers['x-content-type-options'], 'nosniff');
  assert.equal(privateMedia.headers['content-length'], String(mediaBytes.length));
  assert.deepEqual(privateMedia.rawPayload, mediaBytes);

  const range = await app.inject({
    method: 'GET', url: '/work-logs/1/media/2/', headers: { ...headers(1), range: 'bytes=1-4' },
  });
  assert.equal(range.statusCode, 206);
  assert.equal(range.headers['content-range'], `bytes 1-4/${mediaBytes.length}`);
  assert.deepEqual(range.rawPayload, mediaBytes.subarray(1, 5));
  const head = await app.inject({ method: 'HEAD', url: '/work-logs/1/media/2/', headers: headers(1) });
  assert.equal(head.statusCode, 200);
  assert.equal(head.headers['content-length'], String(mediaBytes.length));
  assert.equal(head.rawPayload.length, 0);
  assert.equal((await app.inject({ method: 'GET', url: '/work-logs/1/media/2/', headers: { ...headers(1), range: 'bytes=99-' } })).statusCode, 416);

  assert.equal((await app.inject({ method: 'GET', url: '/work-logs/1/media/2/', headers: headers(2) })).statusCode, 404);
  assert.equal((await app.inject(`/work-logs/share/${shareToken}/media/2/`)).statusCode, 200);
  assert.equal((await app.inject(`/work-logs/share/${shareToken}/media/1/`)).statusCode, 404);
  assert.equal((await app.inject(`/resources/media/_work_logs/${privateFileName}`)).statusCode, 404);
});

test('validates images before storing uploads and rolls back files when database writes fail', async () => {
  const invalidFile = multipart([
    ['csrfmiddlewaretoken', csrfToken], ['title', 'Bad image'], ['text', ''],
  ], Buffer.from('<script>not an image</script>'));
  const rejected = await app.inject({
    method: 'POST', url: '/work-logs/1/entry/', headers: { ...headers(1), 'content-type': invalidFile.contentType },
    payload: invalidFile.payload,
  });
  assert.equal(rejected.statusCode, 200, rejected.body);
  assert.match(rejected.body, /PNG, JPEG, WebP, MP4, WebM 파일을 선택해 주세요/);
  assert.equal(Number((await prisma.$queryRaw<Array<{ total: number | bigint }>>`SELECT COUNT(*) AS total FROM WorkLogEntry WHERE logId = 1`)[0]?.total), 3);

  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#117755' } }).png().toBuffer();
  const validFile = multipart([
    ['csrfmiddlewaretoken', csrfToken], ['title', 'Image proof'], ['text', ''],
  ], image);
  const uploaded = await app.inject({
    method: 'POST', url: '/work-logs/1/entry/', headers: { ...headers(1), 'content-type': validFile.contentType },
    payload: validFile.payload,
  });
  assert.equal(uploaded.statusCode, 302, uploaded.body);
  const [stored] = await prisma.$queryRaw<Array<{ id: number; mediaType: string; attachment: string }>>`
    SELECT id, mediaType, attachment FROM WorkLogEntry
     WHERE logId = 1 AND title = 'Image proof'
  `;
  assert.equal(stored.mediaType, 'image/png');
  const savedPath = join(mediaRoot, '_work_logs', stored.attachment);
  assert.deepEqual(await readFile(savedPath), image);
  assert.equal((await stat(savedPath)).mode & 0o777, 0o600);
  const filesBeforeFailedInsert = (await listFiles(join(mediaRoot, '_work_logs'))).sort();

  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TRIGGER reject_orphan_proof BEFORE INSERT ON WorkLogEntry
    WHEN NEW.title = 'Orphan proof'
    BEGIN SELECT RAISE(ABORT, 'synthetic insert rejection'); END;
  `);
  database.close();
  const failed = multipart([
    ['csrfmiddlewaretoken', csrfToken], ['title', 'Orphan proof'], ['text', ''],
  ], image);
  const failedResponse = await app.inject({
    method: 'POST', url: '/work-logs/1/entry/', headers: { ...headers(1), 'content-type': failed.contentType },
    payload: failed.payload,
  });
  assert.equal(failedResponse.statusCode, 500);
  assert.equal(Number((await prisma.$queryRaw<Array<{ total: number | bigint }>>`SELECT COUNT(*) AS total FROM WorkLogEntry WHERE title = 'Orphan proof'`)[0]?.total), 0);
  const filesAfterFailedInsert = (await listFiles(join(mediaRoot, '_work_logs'))).sort();
  assert.deepEqual(filesAfterFailedInsert, filesBeforeFailedInsert);
  const cleanup = new DatabaseSync(databasePath);
  cleanup.exec('DROP TRIGGER reject_orphan_proof');
  cleanup.close();
});

test('deleting an entry removes its media and closes emptied snapshots; deleting a log removes remaining files', async () => {
  const confirm = await app.inject({ method: 'GET', url: '/work-logs/1/entry/2/delete/', headers: headers(1) });
  assert.equal(confirm.statusCode, 200);
  assert.match(confirm.body, /모든 공유 링크에서 이 기록과 첨부가 사라져요/);

  const deletedEntry = await app.inject({
    method: 'POST', url: '/work-logs/1/entry/2/delete/', headers: formHeaders(1),
    payload: form([['csrfmiddlewaretoken', csrfToken]]),
  });
  assert.equal(deletedEntry.statusCode, 302, deletedEntry.body);
  assert.equal((await app.inject(`/work-logs/share/${shareToken}/`)).statusCode, 404);
  await assert.rejects(stat(privateFilePath));

  const deleteLog = await app.inject({
    method: 'POST', url: '/work-logs/1/delete/', headers: formHeaders(1),
    payload: form([['csrfmiddlewaretoken', csrfToken]]),
  });
  assert.equal(deleteLog.statusCode, 302, deleteLog.body);
  assert.equal((await app.inject({ method: 'GET', url: '/work-logs/1/', headers: headers(1) })).statusCode, 404);
});
