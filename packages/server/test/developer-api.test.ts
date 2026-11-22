import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import test from 'node:test';
import { registerDeveloperApi } from '../src/features/developer-api/index.js';
import { createMigratedTables, insertRow, migratedTableSql } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-developer-api-'));
const databasePath = join(directory, 'developer-api.sqlite3');
const database = new DatabaseSync(databasePath);
database.exec(`
  CREATE TABLE auth_user (
    id INTEGER PRIMARY KEY, username TEXT NOT NULL, first_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '', is_active BOOLEAN NOT NULL DEFAULT 1
  );
  CREATE TABLE board_profile (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, role TEXT NOT NULL);
  ${migratedTableSql('Series')}
  CREATE TABLE board_post (
    id INTEGER PRIMARY KEY, author_id INTEGER NOT NULL, series_id INTEGER, url TEXT NOT NULL,
    title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', meta_description TEXT NOT NULL DEFAULT '',
    published_date DATETIME, deleted_date DATETIME, created_date DATETIME NOT NULL,
    updated_date DATETIME NOT NULL, read_time INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE board_postconfig (
    id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, hide BOOLEAN NOT NULL DEFAULT 0,
    advertise BOOLEAN NOT NULL DEFAULT 0, cover_layout TEXT NOT NULL DEFAULT 'default',
    cover_image_position TEXT NOT NULL DEFAULT 'right', cover_image_ratio TEXT NOT NULL DEFAULT 'auto'
  );
  CREATE TABLE board_postcontent (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, content_html TEXT NOT NULL DEFAULT '');
  CREATE TABLE board_tag (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE board_post_tags (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, tag_id INTEGER NOT NULL);

  INSERT INTO auth_user VALUES
    (1, 'writer', 'Writer', 'writer@example.test', 1),
    (2, 'other', 'Other', 'other@example.test', 1),
    (3, 'reader', 'Reader', 'reader@example.test', 1),
    (4, 'inactive', 'Inactive', 'inactive@example.test', 0);
  INSERT INTO board_profile VALUES (1, 1, 'EDITOR'), (2, 2, 'EDITOR'), (3, 3, 'READER'), (4, 4, 'EDITOR');
`);
createMigratedTables(database, 'DeveloperToken');

function insertToken(id: number, prefix: string, userId: number, scopes: string[], options: {
  revokedAt?: number;
  expiresAt?: number;
} = {}) {
  const rawToken = `blex_pat_${prefix}_test-secret`;
  const tokenHash = createHash('sha256').update(rawToken, 'utf8').digest('hex');
  insertRow(database, 'DeveloperToken', {
    id, name: `Token ${id}`, tokenPrefix: prefix, tokenHash, scopes: JSON.stringify(scopes),
    expiresAt: options.expiresAt ?? null, revokedAt: options.revokedAt ?? null, userId,
  });
  return rawToken;
}

const readToken = insertToken(1, 'abcdef123456', 1, ['posts:read']);
const noScopeToken = insertToken(2, 'scope00000001', 1, []);
const revokedToken = insertToken(3, 'revoked000001', 1, ['posts:read'], { revokedAt: Date.UTC(2025, 0, 1) });
const expiredToken = insertToken(4, 'expired000001', 1, ['posts:read'], { expiresAt: Date.UTC(2025, 0, 1) });
const readerToken = insertToken(5, 'reader0000001', 3, ['posts:read']);
const inactiveToken = insertToken(6, 'inactive00001', 4, ['posts:read']);
const otherToken = insertToken(7, 'other00000001', 2, ['posts:read']);

database.exec(`
  INSERT INTO "Series" ("id", "ownerId", "name", "slug", "descriptionMarkdown", "isHidden", "order", "createdAt", "updatedAt", "createdAtMicroseconds", "updatedAtMicroseconds") VALUES
    (10, 1, 'Writer Series', 'writer-series', 'A series description', 1, 2, 1577934245000, 1580702706000, 0, 0),
    (20, 2, 'Other Series', 'other-series', '', 0, 1, 1577934245000, 1580702706000, 0, 0);
  INSERT INTO board_post VALUES
    (1, 1, 10, 'draft-needle', 'Draft Needle', 'A draft', 'description', NULL, NULL, '2020-01-01 00:00:00', '2025-01-01 00:00:09.123456', 3),
    (2, 2, 20, 'other-draft', 'Other Draft', '', '', NULL, NULL, '2020-01-01 00:00:00', '2025-01-01 00:00:08', 1),
    (3, 1, 10, 'public', 'Public article', '', 'public description', '2020-01-01 00:00:00', NULL, '2020-01-01 00:00:00', '2025-01-01 00:00:07', 5),
    (4, 1, NULL, 'hidden', 'Hidden article', '', '', '2020-01-01 00:00:00', NULL, '2020-01-01 00:00:00', '2025-01-01 00:00:06', 2),
    (5, 1, NULL, 'scheduled', 'Scheduled article', '', '', '2099-01-01 00:00:00', NULL, '2020-01-01 00:00:00', '2025-01-01 00:00:05', 1),
    (6, 1, 10, 'trashed', 'Trashed article', '', '', '2020-01-01 00:00:00', '2025-01-01 00:00:00', '2020-01-01 00:00:00', '2025-01-01 00:00:04', 1),
    (7, 1, 10, 'trashed-draft', 'Trashed draft', '', '', NULL, '2025-01-01 00:00:00', '2020-01-01 00:00:00', '2025-01-01 00:00:03', 1),
    (8, 1, NULL, 'no-config', 'No config article', '', '', '2020-01-01 00:00:00', NULL, '2020-01-01 00:00:00', '2025-01-01 00:00:02', 1),
    (9, 1, NULL, 'hidden-trashed', 'Hidden trashed article', '', '', '2020-01-01 00:00:00', '2025-01-01 00:00:00', '2020-01-01 00:00:00', '2025-01-01 00:00:01', 1),
    (10, 1, NULL, 'another-draft', 'Another draft', '', '', NULL, NULL, '2020-01-01 00:00:00', '2025-01-02 00:00:00', 1);
  INSERT INTO board_postconfig VALUES
    (1, 1, 0, 1, 'split', 'left', '16:9'), (2, 2, 0, 0, 'default', 'right', 'auto'),
    (3, 3, 0, 0, 'default', 'right', 'auto'), (4, 4, 1, 0, 'overlay', 'right', '4:3'),
    (5, 5, 0, 0, 'default', 'right', 'auto'), (6, 6, 0, 0, 'default', 'right', 'auto'),
    (7, 7, 0, 0, 'default', 'right', 'auto'), (9, 9, 1, 0, 'default', 'right', 'auto');
  INSERT INTO board_postcontent VALUES
    (1, 1, '<p>needle in the content</p>'), (2, 2, '<p>other content</p>'),
    (3, 3, '<p>public content</p>'), (4, 4, '<p>hidden content</p>');
  INSERT INTO board_tag VALUES (1, 'api'), (2, 'shared'), (3, 'other-only'), (4, 'trashed-only');
  INSERT INTO board_post_tags VALUES
    (1, 1, 1), (2, 1, 2), (3, 2, 3), (4, 3, 1), (5, 3, 2), (6, 6, 4), (7, 7, 4);
`);
database.close();

const prisma = new PrismaClient({ datasourceUrl: `file:${databasePath}?connection_limit=1` });
await prisma.$executeRaw`PRAGMA query_only = ON`;
const app = Fastify();
registerDeveloperApi(app, prisma);
await app.ready();

test.after(async () => {
  await app.close();
  await prisma.$disconnect();
  await rm(directory, { recursive: true });
});

function get(path: string, token?: string) {
  return app.inject({
    method: 'GET',
    url: path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

test('returns the legacy account and token schema without requiring a read scope', async () => {
  const response = await get('/api/developer/v1/me', noScopeToken);
  assert.equal(response.statusCode, 200, response.body);
  assert.match(response.headers['content-type'] ?? '', /^application\/json; charset=utf-8$/);
  assert.deepEqual(response.json(), {
    data: {
      user: {
        id: 1, username: 'writer', name: 'Writer', email: 'writer@example.test', is_editor: true,
      },
      token: {
        id: 2, name: 'Token 2', token_prefix: 'scope00000001', scopes: [],
      },
    },
  });
});

test('rejects missing, malformed, unknown, revoked, expired, inactive, and non-editor credentials', async () => {
  const cases: Array<[string, string | undefined, number, string]> = [
    ['missing', undefined, 401, 'auth.missing_token'],
    ['malformed', 'blex_pat_not-a-bearer-token', 401, 'auth.invalid_token'],
    ['unknown', 'blex_pat_unknown000001_test-secret', 401, 'auth.invalid_token'],
    ['bad secret', readToken.replace('test-secret', 'wrong-secret'), 401, 'auth.invalid_token'],
    ['revoked', revokedToken, 401, 'auth.invalid_token'],
    ['expired', expiredToken, 401, 'auth.invalid_token'],
    ['inactive account', inactiveToken, 401, 'auth.inactive_user'],
    ['reader account', readerToken, 403, 'auth.editor_required'],
  ];

  for (const [label, token, statusCode, code] of cases) {
    const response = await get('/api/developer/v1/me', token);
    assert.equal(response.statusCode, statusCode, label);
    assert.equal(response.json().error.code, code, label);
    assert.ok(response.json().error.message, label);
  }

  const wrongScheme = await app.inject({
    method: 'GET', url: '/api/developer/v1/me', headers: { authorization: `Basic ${readToken}` },
  });
  assert.equal(wrongScheme.statusCode, 401);
  assert.equal(wrongScheme.json().error.code, 'auth.missing_token');
});

test('lists only the token owner’s posts with legacy fields, ordering, pagination, and status rules', async () => {
  const response = await get('/api/developer/v1/posts?status=published', readToken);
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().data.pagination, { page: 1, limit: 20, total: 1 });
  const [post] = response.json().data.posts;
  assert.equal(post.id, 3);
  assert.equal(post.status, 'published');
  assert.equal(post.public_url, '/@writer/public');
  assert.deepEqual(post.tags, ['api', 'shared']);
  assert.deepEqual(post.series, {
    id: 10, name: 'Writer Series', url: 'writer-series',
  });
  assert.equal(post.is_hidden, false);
  assert.equal(post.cover_layout, 'default');
  assert.equal(post.published_at, '2020-01-01T00:00:00+00:00');

  const drafts = await get('/api/developer/v1/posts?status=draft&page=2&limit=1', readToken);
  assert.equal(drafts.statusCode, 200, drafts.body);
  assert.deepEqual(drafts.json().data.pagination, { page: 2, limit: 1, total: 2 });
  assert.equal(drafts.json().data.posts[0].id, 1);
  assert.equal(drafts.json().data.posts[0].status, 'draft');

  const hidden = await get('/api/developer/v1/posts?status=hidden', readToken);
  assert.deepEqual(hidden.json().data.posts.map((item: { id: number }) => item.id), [4]);

  const clamped = await get('/api/developer/v1/posts?page=0&limit=500', readToken);
  assert.equal(clamped.statusCode, 200, clamped.body);
  assert.deepEqual(clamped.json().data.pagination, { page: 1, limit: 100, total: 6 });
  assert.ok(clamped.json().data.posts.every((item: { id: number }) => item.id !== 2));
});

test('search filters by case-insensitive content, tags, status, and series with OR tag matching', async () => {
  const found = await get('/api/developer/v1/posts/search?q=NEEDLE&tag=missing,shared&status=draft&series_id=10', readToken);
  assert.equal(found.statusCode, 200, found.body);
  assert.deepEqual(found.json().data.pagination, { page: 1, limit: 20, total: 1 });
  assert.equal(found.json().data.posts[0].id, 1);

  const escapedWildcard = await get('/api/developer/v1/posts/search?q=%25', readToken);
  assert.equal(escapedWildcard.statusCode, 200, escapedWildcard.body);
  assert.equal(escapedWildcard.json().data.pagination.total, 0);

  const invalidStatus = await get('/api/developer/v1/posts?status=trashed', readToken);
  assert.equal(invalidStatus.statusCode, 400);
  assert.equal(invalidStatus.json().error.code, 'post.invalid_status');

  const invalidSeries = await get('/api/developer/v1/posts/search?series_id=not-a-number', readToken);
  assert.equal(invalidSeries.statusCode, 400);
  assert.equal(invalidSeries.json().error.code, 'request.invalid_series_id');
});

test('returns post details to the owner, including draft content, and hides cross-owner IDs as not found', async () => {
  const response = await get('/api/developer/v1/posts/1', readToken);
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().data, {
    id: 1,
    title: 'Draft Needle',
    subtitle: 'A draft',
    url: 'draft-needle',
    public_url: '/@writer/draft-needle',
    status: 'draft',
    tags: ['api', 'shared'],
    series: { id: 10, name: 'Writer Series', url: 'writer-series' },
    is_hidden: false,
    is_advertise: true,
    cover_layout: 'split',
    cover_image_position: 'left',
    cover_image_ratio: '16:9',
    created_at: '2020-01-01T00:00:00+00:00',
    updated_at: '2025-01-01T00:00:09.123456+00:00',
    published_at: null,
    description: 'description',
    content: '<p>needle in the content</p>',
    content_html: '<p>needle in the content</p>',
    rendered_html: '<p>needle in the content</p>',
    read_time: 3,
  });

  const otherOwner = await get('/api/developer/v1/posts/2', readToken);
  assert.equal(otherOwner.statusCode, 404);
  assert.deepEqual(otherOwner.json().error, { code: 'post.not_found', message: '포스트를 찾을 수 없습니다.', fields: null });

  const missing = await get('/api/developer/v1/posts/999', readToken);
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, 'post.not_found');

  const trashed = await get('/api/developer/v1/posts/7', readToken);
  assert.equal(trashed.statusCode, 404);
  assert.equal(trashed.json().error.code, 'post.not_found');
});

test('lists only owned non-trashed tags and series with matching post counts', async () => {
  const tags = await get('/api/developer/v1/tags', readToken);
  assert.equal(tags.statusCode, 200, tags.body);
  assert.deepEqual(tags.json().data.tags, [
    { name: 'api', post_count: 2 },
    { name: 'shared', post_count: 2 },
  ]);

  const series = await get('/api/developer/v1/series', readToken);
  assert.equal(series.statusCode, 200, series.body);
  assert.deepEqual(series.json().data.series, [{
    id: 10,
    name: 'Writer Series',
    url: 'writer-series',
    description: 'A series description',
    is_hidden: true,
    post_count: 2,
    created_at: '2020-01-02T03:04:05+00:00',
    updated_at: '2020-02-03T04:05:06+00:00',
  }]);
});

test('requires posts:read on every read route except /me', async () => {
  for (const path of [
    '/api/developer/v1/posts',
    '/api/developer/v1/posts/search',
    '/api/developer/v1/posts/1',
    '/api/developer/v1/tags',
    '/api/developer/v1/series',
  ]) {
    const response = await get(path, noScopeToken);
    assert.equal(response.statusCode, 403, path);
    assert.equal(response.json().error.code, 'auth.insufficient_scope', path);
  }
});
