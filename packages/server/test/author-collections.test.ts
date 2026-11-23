import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { after, beforeEach, test } from 'node:test';
import { registerAuthorCollections } from '../src/features/series/index.js';
import { accountTables, migratedTableSql } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-author-collections-'));
const databasePath = join(directory, 'synthetic-author-collections.sqlite3');
const csrfToken = 'c'.repeat(43);

function createSchema() {
  const database = new DatabaseSync(databasePath);
  database.exec(`
  ${migratedTableSql(...accountTables)}
    ${migratedTableSql('Series')}
${migratedTableSql('Post', 'PostContent', 'Tag', '_PostToTag', 'PostRevision', 'PostLike', 'PinnedPost', 'PostShareLink', 'PostShareDailyCount', 'ScheduledPublication')}


  `);
  database.close();
}

function seed() {
  const database = new DatabaseSync(databasePath);
  database.exec(`
    DELETE FROM "PinnedPost";
    
    DELETE FROM "Post";
    DELETE FROM "Series";
    DELETE FROM "Profile";
    DELETE FROM "User";
    INSERT INTO "User" ("id", "username", "isActive", "email", "passwordHash", "joinedAt") VALUES
    (1, 'writer', 1, '', '', 1577836800000),
    (2, 'other-writer', 1, '', '', 1577836800000),
    (3, 'reader', 1, '', '', 1577836800000),
    (4, 'inactive-writer', 0, '', '', 1577836800000);
    INSERT INTO "Profile" ("userId", "role") VALUES
    (1, 'EDITOR'),
    (2, 'EDITOR'),
    (3, 'READER'),
    (4, 'EDITOR');
    INSERT INTO "Series" ("id", "order", "descriptionMarkdown", "descriptionHtml", "isHidden", "slug", "layout", "createdAt", "updatedAt", "ownerId", "name") VALUES
    (10, 0, '**series description**', '<p><strong>series description</strong></p>', 0, 'writer-series', 'list', 1704099600000, 1704099600000, 1, 'Writer Series'),
    (11, 1, '', '', 1, 'hidden-series', 'list', 1704186000000, 1704186000000, 1, 'Hidden Series'),
    (20, 0, '', '', 0, 'other-series', 'list', 1704272400000, 1704272400000, 2, 'Other Series');
    INSERT INTO "Post" ("id", "slug", "title", "image", "publishedAt", "deletedAt", "authorId", "seriesId", "updatedAt", "createdAt") VALUES
    (1, 'public-unassigned', 'Public unassigned', '', 1717243200000, NULL, 1, NULL, 1717243200000, 946684800000),
    (2, 'public-assigned', 'Public assigned', '', 1717329600000, NULL, 1, 10, 1717329600000, 946684800000),
    (3, 'hidden-post', 'Hidden post', '', 1717416000000, NULL, 1, NULL, 1717416000000, 946684800000),
    (4, 'draft-post', 'Draft post', '', NULL, NULL, 1, NULL, 1717502400000, 946684800000),
    (5, 'scheduled-post', 'Scheduled post', '', 4084344000000, NULL, 1, NULL, 1717588800000, 946684800000),
    (6, 'trashed-post', 'Trashed post', '', 1717675200000, 1717761600000, 1, NULL, 1717675200000, 946684800000),
    (7, 'assigned-hidden', 'Assigned hidden', '', 1717761600000, NULL, 1, 10, 1717761600000, 946684800000),
    (8, 'assigned-draft', 'Assigned draft', '', NULL, NULL, 1, 10, 1717848000000, 946684800000),
    (9, 'assigned-trash', 'Assigned trash', '', 1717934400000, 1718020800000, 1, 10, 1717934400000, 946684800000),
    (10, 'other-public', 'Other public', '', 1718020800000, NULL, 2, NULL, 1718020800000, 946684800000),
    (11, 'hidden-series-public', 'Hidden series public post', '', 1718107200000, NULL, 1, 11, 1718107200000, 946684800000),
    (12, 'public-unassigned-newest', 'Public unassigned newest', '', 1718193600000, NULL, 1, NULL, 1718193600000, 946684800000);
    UPDATE "Post" SET isHidden = 0 WHERE id = 1;
    UPDATE "Post" SET isHidden = 0 WHERE id = 2;
    UPDATE "Post" SET isHidden = 1 WHERE id = 3;
    UPDATE "Post" SET isHidden = 0 WHERE id = 4;
    UPDATE "Post" SET isHidden = 0 WHERE id = 5;
    UPDATE "Post" SET isHidden = 0 WHERE id = 6;
    UPDATE "Post" SET isHidden = 1 WHERE id = 7;
    UPDATE "Post" SET isHidden = 0 WHERE id = 8;
    UPDATE "Post" SET isHidden = 0 WHERE id = 9;
    UPDATE "Post" SET isHidden = 0 WHERE id = 10;
    UPDATE "Post" SET isHidden = 0 WHERE id = 11;
    UPDATE "Post" SET isHidden = 0 WHERE id = 12;
    INSERT INTO "PinnedPost" ("order", "createdAt", "postId", "userId") VALUES
    (0, 1717243200000, 1, 1),
    (1, 1717329600000, 3, 1),
    (2, 1717416000000, 6, 1),
    (3, 1717502400000, 4, 1),
    (4, 1717588800000, 5, 1);
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
  validateCsrf: (request) =>
    request.headers.origin === 'https://blog.example' &&
    request.headers.cookie?.includes(`csrftoken=${csrfToken}`) === true &&
    (request.headers['x-test-csrf'] === csrfToken ||
      (request.body as Record<string, unknown> | undefined)?.csrfmiddlewaretoken === csrfToken),
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
  assert.deepEqual(
    (available.json().body as Array<{ id: number }>).map((post) => post.id),
    [12, 1],
  );
  const selectedAvailable = await app.inject({ url: '/v1/series/valid-posts?seriesId=10', headers: signedIn(1) });
  assert.deepEqual(
    (selectedAvailable.json().body as Array<{ id: number }>).map((post) => post.id),
    [12, 9, 7, 2, 1, 8],
  );
  assert.equal(
    (await app.inject({ url: '/v1/series/valid-posts?seriesId=abc', headers: signedIn(1) })).json().errorCode,
    'error:IP',
  );

  const created = await app.inject({
    method: 'POST',
    url: '/v1/series',
    headers: jsonHeaders(1),
    payload: { name: 'New Series', url: 'writer-series', description: '**welcome**', postIds: [1, 2, 10, 999] },
  });
  assert.equal(created.json().status, 'DONE', created.body);
  assert.equal(created.json().body.postCount, 2);
  assert.match(created.json().body.url, /^writer-series-[0-9a-f]{8}$/);
  const newId = Number(created.json().body.id);
  const [stored] = await db.$queryRaw<
    Array<{ textHtml: string }>
  >`SELECT descriptionHtml AS textHtml FROM "Series" WHERE id = ${newId}`;
  assert.equal(stored.textHtml, '**welcome**');
  const [movedPost] = await db.$queryRaw<Array<{ seriesId: number | null }>>`SELECT seriesId FROM "Post" WHERE id = 2`;
  assert.equal(movedPost.seriesId, newId);
  const [foreignPost] = await db.$queryRaw<
    Array<{ seriesId: number | null }>
  >`SELECT seriesId FROM "Post" WHERE id = 10`;
  assert.equal(foreignPost.seriesId, null);

  const updated = await app.inject({
    method: 'PUT',
    url: `/v1/series/${newId}`,
    headers: jsonHeaders(1),
    payload: { name: 'Renamed', postIds: [] },
  });
  assert.equal(updated.json().body.name, 'Renamed');
  assert.equal(updated.json().body.postCount, 0);
  const foreignUpdate = await app.inject({
    method: 'PUT',
    url: `/v1/series/${newId}`,
    headers: jsonHeaders(2),
    payload: { name: 'Wrong owner' },
  });
  assert.equal(foreignUpdate.json().errorCode, 'error:NF');

  const ordered = await app.inject({
    method: 'PUT',
    url: '/v1/series/order',
    headers: jsonHeaders(1),
    payload: {
      order: [
        [10, 9],
        [20, 3],
      ],
    },
  });
  assert.equal(ordered.json().status, 'DONE');
  const tooWide = await app.inject({
    method: 'PUT',
    url: '/v1/series/order',
    headers: jsonHeaders(1),
    payload: { order: [[10, 3_000_000_000]] },
  });
  assert.equal(tooWide.json().status, 'DONE');
  assert.equal((await app.inject({ url: '/v1/setting/series', headers: signedIn(1) })).statusCode, 200);
  const [seriesOrder] = await db.$queryRaw<
    Array<{ order: number }>
  >`SELECT "order" AS "order" FROM "Series" WHERE id = 10`;
  const [otherOrder] = await db.$queryRaw<
    Array<{ order: number }>
  >`SELECT "order" AS "order" FROM "Series" WHERE id = 20`;
  assert.equal(seriesOrder.order, 9);
  assert.equal(otherOrder.order, 0);

  const deleted = await app.inject({ method: 'DELETE', url: `/v1/series/${newId}`, headers: signedIn(1) });
  assert.equal(deleted.json().status, 'DONE');
  assert.equal((await db.$queryRaw<Array<{ id: number }>>`SELECT id FROM "Series" WHERE id = ${newId}`).length, 0);

  const badCsrf = await app.inject({
    method: 'POST',
    url: '/v1/series',
    headers: jsonHeaders(1, false),
    payload: { name: 'No CSRF' },
  });
  assert.equal(badCsrf.statusCode, 403);
});

test('pinned APIs expose public rows, reserve trash, paginate, and guard author mutations', async () => {
  const publicRows = await app.inject('/v1/users/@writer/pinned-posts');
  assert.equal(publicRows.statusCode, 200);
  assert.deepEqual(
    publicRows.json().body.pinnedPosts.map((item: { post: { url: string } }) => item.post.url),
    ['public-unassigned'],
  );
  assert.equal(publicRows.json().body.maxCount, 6);

  const setting = await app.inject({ url: '/v1/setting/pinned-posts', headers: signedIn(1) });
  assert.equal(setting.json().body.pinnedPosts.length, 1);
  assert.equal(setting.json().body.reservedCount, 1);
  assert.equal((await app.inject('/v1/setting/pinned-posts')).json().errorCode, 'error:NL');

  const pinnable = await app.inject({ url: '/v1/setting/pinnable-posts?limit=2&page=99', headers: signedIn(1) });
  assert.equal(pinnable.json().body.page, 2);
  assert.equal(pinnable.json().body.lastPage, 2);
  assert.equal(pinnable.json().body.totalCount, 3);
  assert.deepEqual(
    pinnable.json().body.posts.map((post: { url: string }) => post.url),
    ['public-assigned'],
  );
  const invalidPage = await app.inject({ url: '/v1/setting/pinnable-posts?page=abc', headers: signedIn(1) });
  assert.equal(invalidPage.json().messageKey, 'pinned_posts.invalid_page');

  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/v1/users/@writer/pinned-posts',
        headers: jsonHeaders(2),
        payload: { postUrl: 'public-unassigned-newest' },
      })
    ).json().errorCode,
    'error:AT',
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/v1/users/@reader/pinned-posts',
        headers: jsonHeaders(3),
        payload: { postUrl: 'public-unassigned-newest' },
      })
    ).json().errorCode,
    'error:RJ',
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/v1/users/@writer/pinned-posts',
        payload: { postUrl: 'public-unassigned-newest' },
      })
    ).json().errorCode,
    'error:NL',
  );

  const added = await app.inject({
    method: 'POST',
    url: '/v1/setting/pinned-posts',
    headers: jsonHeaders(1),
    payload: { postUrl: 'public-unassigned-newest' },
  });
  assert.equal(added.json().status, 'DONE');
  const hidden = await app.inject({
    method: 'POST',
    url: '/v1/setting/pinned-posts',
    headers: jsonHeaders(1),
    payload: { postUrl: 'hidden-post' },
  });
  assert.equal(hidden.json().messageKey, 'pinned_posts.limit_reached');

  const reordered = await app.inject({
    method: 'PUT',
    url: '/v1/setting/pinned-posts/order',
    headers: jsonHeaders(1),
    payload: { postUrls: ['public-unassigned-newest'] },
  });
  assert.equal(reordered.json().status, 'DONE');
  const allOrders = await db.$queryRaw<Array<{ url: string; order: number }>>`
    SELECT post.slug AS url, pinned."order" AS "order" FROM "PinnedPost" AS pinned
      JOIN "Post" AS post ON post.id = pinned.postId WHERE pinned.userId = 1 ORDER BY pinned."order"
  `;
  assert.deepEqual(
    allOrders.map((row) => row.url),
    ['public-unassigned-newest', 'public-unassigned', 'hidden-post', 'trashed-post', 'draft-post', 'scheduled-post'],
  );

  const ownerMutation = await app.inject({
    method: 'POST',
    url: '/v1/users/@writer/pinned-posts',
    headers: jsonHeaders(1),
    payload: { postUrl: 'public-assigned' },
  });
  assert.equal(ownerMutation.json().messageKey, 'pinned_posts.limit_reached');
  const noCsrf = await app.inject({
    method: 'DELETE',
    url: '/v1/setting/pinned-posts',
    headers: jsonHeaders(1, false),
    payload: { postUrl: 'public-unassigned' },
  });
  assert.equal(noCsrf.statusCode, 403);
});

test('the pinned API removes rows', async () => {
  const removed = await app.inject({
    method: 'DELETE',
    url: '/v1/setting/pinned-posts',
    headers: jsonHeaders(1),
    payload: { postUrl: 'public-unassigned' },
  });
  assert.equal(removed.json().status, 'DONE', removed.body);
  const [remaining] = await db.$queryRaw<
    Array<{ count: number | bigint }>
  >`SELECT COUNT(*) AS count FROM "PinnedPost" WHERE userId = 1 AND postId = 1`;
  assert.equal(Number(remaining.count), 0);
});
