import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { after, beforeEach, test } from 'node:test';
import { registerAuthorCollections } from '../src/features/series/index.js';
import { migratedTableSql } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-author-collections-'));
const databasePath = join(directory, 'synthetic-author-collections.sqlite3');
const csrfToken = 'c'.repeat(43);

function createSchema() {
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE auth_user (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, is_active BOOLEAN NOT NULL DEFAULT 1
    );
    CREATE TABLE board_profile (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE, role TEXT NOT NULL
    );
    ${migratedTableSql('Series')}
        CREATE TABLE board_post (
      id INTEGER PRIMARY KEY, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL, image TEXT NOT NULL DEFAULT '',
      published_date DATETIME, deleted_date DATETIME, author_id INTEGER NOT NULL, series_id INTEGER REFERENCES "Series" (id) ON DELETE SET NULL,
      updated_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE board_postconfig (
      id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL UNIQUE, hide BOOLEAN NOT NULL DEFAULT 0
    );
    CREATE TABLE board_pinnedpost (
      id INTEGER PRIMARY KEY, "order" INTEGER NOT NULL, created_date DATETIME NOT NULL,
      post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, UNIQUE(user_id, post_id)
    );
  `);
  database.close();
}

function seed() {
  const database = new DatabaseSync(databasePath);
  database.exec(`
    DELETE FROM board_pinnedpost;
    DELETE FROM board_postconfig;
    DELETE FROM board_post;
    DELETE FROM "Series";
    DELETE FROM board_profile;
    DELETE FROM auth_user;
    INSERT INTO auth_user VALUES
      (1, 'writer', 1), (2, 'other-writer', 1), (3, 'reader', 1), (4, 'inactive-writer', 0);
    INSERT INTO board_profile VALUES
      (1, 1, 'EDITOR'), (2, 2, 'EDITOR'), (3, 3, 'READER'), (4, 4, 'EDITOR');
    INSERT INTO "Series" ("id", "order", "descriptionMarkdown", "descriptionHtml", "isHidden", "slug", "layout", "createdAt", "updatedAt", "ownerId", "name", "createdAtMicroseconds", "updatedAtMicroseconds") VALUES
    (10, 0, '**series description**', '<p><strong>series description</strong></p>', 0, 'writer-series', 'list', 1704099600000, 1704099600000, 1, 'Writer Series', 0, 0),
    (11, 1, '', '', 1, 'hidden-series', 'list', 1704186000000, 1704186000000, 1, 'Hidden Series', 0, 0),
    (20, 0, '', '', 0, 'other-series', 'list', 1704272400000, 1704272400000, 2, 'Other Series', 0, 0);
    INSERT INTO board_post VALUES
      (1, 'public-unassigned', 'Public unassigned', '', '2024-06-01 12:00:00', NULL, 1, NULL, '2024-06-01 12:00:00'),
      (2, 'public-assigned', 'Public assigned', '', '2024-06-02 12:00:00', NULL, 1, 10, '2024-06-02 12:00:00'),
      (3, 'hidden-post', 'Hidden post', '', '2024-06-03 12:00:00', NULL, 1, NULL, '2024-06-03 12:00:00'),
      (4, 'draft-post', 'Draft post', '', NULL, NULL, 1, NULL, '2024-06-04 12:00:00'),
      (5, 'scheduled-post', 'Scheduled post', '', '2099-06-05 12:00:00', NULL, 1, NULL, '2024-06-05 12:00:00'),
      (6, 'trashed-post', 'Trashed post', '', '2024-06-06 12:00:00', '2024-06-07 12:00:00', 1, NULL, '2024-06-06 12:00:00'),
      (7, 'assigned-hidden', 'Assigned hidden', '', '2024-06-07 12:00:00', NULL, 1, 10, '2024-06-07 12:00:00'),
      (8, 'assigned-draft', 'Assigned draft', '', NULL, NULL, 1, 10, '2024-06-08 12:00:00'),
      (9, 'assigned-trash', 'Assigned trash', '', '2024-06-09 12:00:00', '2024-06-10 12:00:00', 1, 10, '2024-06-09 12:00:00'),
      (10, 'other-public', 'Other public', '', '2024-06-10 12:00:00', NULL, 2, NULL, '2024-06-10 12:00:00'),
      (11, 'hidden-series-public', 'Hidden series public post', '', '2024-06-11 12:00:00', NULL, 1, 11, '2024-06-11 12:00:00'),
      (12, 'public-unassigned-newest', 'Public unassigned newest', '', '2024-06-12 12:00:00', NULL, 1, NULL, '2024-06-12 12:00:00');
    INSERT INTO board_postconfig VALUES
      (1, 1, 0), (2, 2, 0), (3, 3, 1), (4, 4, 0), (5, 5, 0), (6, 6, 0),
      (7, 7, 1), (8, 8, 0), (9, 9, 0), (10, 10, 0), (11, 11, 0), (12, 12, 0);
    INSERT INTO board_pinnedpost VALUES
      (1, 0, '2024-06-01 12:00:00', 1, 1),
      (2, 1, '2024-06-02 12:00:00', 3, 1),
      (3, 2, '2024-06-03 12:00:00', 6, 1),
      (4, 3, '2024-06-04 12:00:00', 4, 1),
      (5, 4, '2024-06-05 12:00:00', 5, 1);
  `);
  database.close();
}

createSchema();
const db = new PrismaClient({ datasourceUrl: `file:${databasePath}?connection_limit=1` });
const app = Fastify();
registerAuthorCollections(app, db, {
  siteUrl: new URL('https://blog.example'),
  currentUser: async (request) => {
    const raw = request.headers['x-test-user'];
    const id = Number(Array.isArray(raw) ? raw.at(-1) : raw);
    const users: Record<number, string> = { 1: 'writer', 2: 'other-writer', 3: 'reader', 4: 'inactive-writer' };
    return Number.isSafeInteger(id) && users[id] ? { id, username: users[id]! } : null;
  },
  validateCsrf: (request) => request.headers.origin === 'https://blog.example'
    && request.headers.cookie?.includes(`csrftoken=${csrfToken}`) === true
    && (request.headers['x-test-csrf'] === csrfToken
      || (request.body as Record<string, unknown> | undefined)?.csrfmiddlewaretoken === csrfToken),
});
await app.ready();

after(async () => {
  await app.close();
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

beforeEach(() => seed());

const signedIn = (id: number) => ({
  'x-test-user': String(id),
  'x-test-csrf': csrfToken,
  cookie: `csrftoken=${csrfToken}`,
  origin: 'https://blog.example',
});
const jsonHeaders = (id: number, csrf = true) => ({
  ...(csrf ? signedIn(id) : { 'x-test-user': String(id) }),
  'content-type': 'application/json',
});

test('series APIs preserve ownership, counts, markdown, post selection, and ordering', async () => {
  const ownerList = await app.inject({ url: '/v1/series', headers: signedIn(1) });
  assert.equal(ownerList.json().status, 'DONE');
  const listed = ownerList.json().body.series as Array<{ id: string; url: string; totalPosts: number }>;
  assert.equal(listed.find((series) => series.id === '10')?.totalPosts, 1);
  assert.ok(listed.some((series) => series.url === 'hidden-series'));

  const setting = await app.inject({ url: '/v1/setting/series', headers: signedIn(1) });
  const settingSeries = setting.json().body.series as Array<{ id: number; totalPosts: number }>;
  assert.equal(settingSeries.find((series) => series.id === 10)?.totalPosts, 3);

  const detail = await app.inject({ url: '/v1/series/10', headers: signedIn(1) });
  assert.deepEqual(detail.json().body.postIds, [2, 7, 8, 9]);
  const notOwner = await app.inject({ url: '/v1/series/10', headers: signedIn(2) });
  assert.equal(notOwner.json().errorCode, 'error:NF');

  const available = await app.inject({ url: '/v1/series/valid-posts', headers: signedIn(1) });
  assert.deepEqual((available.json().body as Array<{ id: number }>).map((post) => post.id), [12, 1]);
  const selectedAvailable = await app.inject({ url: '/v1/series/valid-posts?seriesId=10', headers: signedIn(1) });
  assert.deepEqual((selectedAvailable.json().body as Array<{ id: number }>).map((post) => post.id), [12, 9, 7, 2, 1, 8]);
  assert.equal((await app.inject({ url: '/v1/series/valid-posts?seriesId=abc', headers: signedIn(1) })).json().errorCode, 'error:IP');

  const created = await app.inject({
    method: 'POST', url: '/v1/series', headers: jsonHeaders(1),
    payload: { name: 'New Series', url: 'writer-series', description: '**welcome**', postIds: [1, 2, 10, 999] },
  });
  assert.equal(created.json().status, 'DONE', created.body);
  assert.equal(created.json().body.postCount, 2);
  assert.match(created.json().body.url, /^writer-series-[0-9a-f]{8}$/);
  const newId = Number(created.json().body.id);
  const [stored] = await db.$queryRaw<Array<{ text_html: string }>>`SELECT descriptionHtml AS text_html FROM "Series" WHERE id = ${newId}`;
  assert.equal(stored.text_html, '**welcome**');
  const [movedPost] = await db.$queryRaw<Array<{ series_id: number | null }>>`SELECT series_id FROM board_post WHERE id = 2`;
  assert.equal(movedPost.series_id, newId);
  const [foreignPost] = await db.$queryRaw<Array<{ series_id: number | null }>>`SELECT series_id FROM board_post WHERE id = 10`;
  assert.equal(foreignPost.series_id, null);

  const updated = await app.inject({
    method: 'PUT', url: `/v1/series/${newId}`, headers: jsonHeaders(1), payload: { name: 'Renamed', postIds: [] },
  });
  assert.equal(updated.json().body.name, 'Renamed');
  assert.equal(updated.json().body.postCount, 0);
  const foreignUpdate = await app.inject({
    method: 'PUT', url: `/v1/series/${newId}`, headers: jsonHeaders(2), payload: { name: 'Wrong owner' },
  });
  assert.equal(foreignUpdate.json().errorCode, 'error:NF');

  const ordered = await app.inject({
    method: 'PUT', url: '/v1/series/order', headers: jsonHeaders(1), payload: { order: [[10, 9], [20, 3]] },
  });
  assert.equal(ordered.json().status, 'DONE');
  const tooWide = await app.inject({ method: 'PUT', url: '/v1/series/order', headers: jsonHeaders(1), payload: { order: [[10, 3_000_000_000]] } });
  assert.equal(tooWide.json().status, 'DONE');
  assert.equal((await app.inject({ url: '/v1/setting/series', headers: signedIn(1) })).statusCode, 200);
  const [seriesOrder] = await db.$queryRaw<Array<{ order: number }>>`SELECT "order" AS "order" FROM "Series" WHERE id = 10`;
  const [otherOrder] = await db.$queryRaw<Array<{ order: number }>>`SELECT "order" AS "order" FROM "Series" WHERE id = 20`;
  assert.equal(seriesOrder.order, 9);
  assert.equal(otherOrder.order, 0);

  const deleted = await app.inject({ method: 'DELETE', url: `/v1/series/${newId}`, headers: signedIn(1) });
  assert.equal(deleted.json().status, 'DONE');
  assert.equal((await db.$queryRaw<Array<{ id: number }>>`SELECT id FROM "Series" WHERE id = ${newId}`).length, 0);

  const badCsrf = await app.inject({ method: 'POST', url: '/v1/series', headers: jsonHeaders(1, false), payload: { name: 'No CSRF' } });
  assert.equal(badCsrf.statusCode, 403);
});

test('pinned APIs expose public rows, reserve trash, paginate, and guard author mutations', async () => {
  const publicRows = await app.inject('/v1/users/@writer/pinned-posts');
  assert.equal(publicRows.statusCode, 200);
  assert.deepEqual(publicRows.json().body.pinnedPosts.map((item: { post: { url: string } }) => item.post.url), ['public-unassigned']);
  assert.equal(publicRows.json().body.maxCount, 6);

  const setting = await app.inject({ url: '/v1/setting/pinned-posts', headers: signedIn(1) });
  assert.equal(setting.json().body.pinnedPosts.length, 1);
  assert.equal(setting.json().body.reservedCount, 1);
  assert.equal((await app.inject('/v1/setting/pinned-posts')).json().errorCode, 'error:NL');

  const pinnable = await app.inject({ url: '/v1/setting/pinnable-posts?limit=2&page=99', headers: signedIn(1) });
  assert.equal(pinnable.json().body.page, 2);
  assert.equal(pinnable.json().body.lastPage, 2);
  assert.equal(pinnable.json().body.totalCount, 3);
  assert.deepEqual(pinnable.json().body.posts.map((post: { url: string }) => post.url), ['public-assigned']);
  const invalidPage = await app.inject({ url: '/v1/setting/pinnable-posts?page=abc', headers: signedIn(1) });
  assert.equal(invalidPage.json().messageKey, 'pinned_posts.invalid_page');

  assert.equal((await app.inject({ method: 'POST', url: '/v1/users/@writer/pinned-posts', headers: jsonHeaders(2), payload: { post_url: 'public-unassigned-newest' } })).json().errorCode, 'error:AT');
  assert.equal((await app.inject({ method: 'POST', url: '/v1/users/@reader/pinned-posts', headers: jsonHeaders(3), payload: { post_url: 'public-unassigned-newest' } })).json().errorCode, 'error:RJ');
  assert.equal((await app.inject({ method: 'POST', url: '/v1/users/@writer/pinned-posts', payload: { post_url: 'public-unassigned-newest' } })).json().errorCode, 'error:NL');

  const added = await app.inject({
    method: 'POST', url: '/v1/setting/pinned-posts', headers: jsonHeaders(1), payload: { post_url: 'public-unassigned-newest' },
  });
  assert.equal(added.json().status, 'DONE');
  const hidden = await app.inject({
    method: 'POST', url: '/v1/setting/pinned-posts', headers: jsonHeaders(1), payload: { post_url: 'hidden-post' },
  });
  assert.equal(hidden.json().messageKey, 'pinned_posts.limit_reached');

  const reordered = await app.inject({
    method: 'PUT', url: '/v1/setting/pinned-posts/order', headers: jsonHeaders(1), payload: { post_urls: ['public-unassigned-newest'] },
  });
  assert.equal(reordered.json().status, 'DONE');
  const allOrders = await db.$queryRaw<Array<{ url: string; order: number }>>`
    SELECT post.url AS url, pinned."order" AS "order" FROM board_pinnedpost AS pinned
      JOIN board_post AS post ON post.id = pinned.post_id WHERE pinned.user_id = 1 ORDER BY pinned."order"
  `;
  assert.deepEqual(allOrders.map((row) => row.url), [
    'public-unassigned-newest', 'public-unassigned', 'hidden-post', 'trashed-post', 'draft-post', 'scheduled-post',
  ]);

  const ownerMutation = await app.inject({
    method: 'POST', url: '/v1/users/@writer/pinned-posts', headers: jsonHeaders(1), payload: { post_url: 'public-assigned' },
  });
  assert.equal(ownerMutation.json().messageKey, 'pinned_posts.limit_reached');
  const noCsrf = await app.inject({ method: 'DELETE', url: '/v1/setting/pinned-posts', headers: jsonHeaders(1, false), payload: { post_url: 'public-unassigned' } });
  assert.equal(noCsrf.statusCode, 403);
});

test('the pinned API removes rows', async () => {
  const removed = await app.inject({
    method: 'DELETE', url: '/v1/setting/pinned-posts', headers: jsonHeaders(1), payload: { post_url: 'public-unassigned' },
  });
  assert.equal(removed.json().status, 'DONE', removed.body);
  const [remaining] = await db.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM board_pinnedpost WHERE user_id = 1 AND post_id = 1`;
  assert.equal(Number(remaining.count), 0);
});
