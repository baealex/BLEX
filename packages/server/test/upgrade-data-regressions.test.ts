import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { PostValidationError, updateAuthorPost } from '../src/features/posts/authoring/index.js';
import {
  createMigratedDatabase,
  insertRow,
  seedEditor,
  seedPost,
  signIn,
  testCipherKey,
  testSecretKey,
  testSiteUrl,
} from './fixtures/migrated-database.js';

const djangoDeletedDate = '2026-02-01 03:04:05.123456';
const editor = { id: 1, username: 'writer' };
const legacyShareToken = '12345678123442348234123456789abc';
const publicShareToken = '12345678-1234-4234-8234-123456789abc';

async function migratedApp() {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedEditor(fixture.db, 2, 'reader');
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  await app.ready();
  const headers = signIn(fixture.db, 1);
  const count = (table: string, where: string) =>
    Number(
      (fixture.db.prepare(`SELECT COUNT(*) AS total FROM "${table}" WHERE ${where}`).get() as { total: number }).total,
    );
  return {
    ...fixture,
    app,
    headers,
    count,
    async close() {
      await app.close();
      await fixture.cleanup();
    },
  };
}

async function trashToken(fixture: Awaited<ReturnType<typeof migratedApp>>) {
  const listed = await fixture.app.inject({ url: '/v1/setting/trash-posts', headers: fixture.headers });
  assert.equal(listed.statusCode, 200, listed.body);
  return String(listed.json().body.posts[0].deletedDate);
}

test('permanently deletes a Django-era trashed post with the rows Django cascaded', async () => {
  const fixture = await migratedApp();
  try {
    const { db } = fixture;
    seedPost(db, 10, 1, 'trashed', { deletedAt: djangoDeletedDate });
    seedPost(db, 11, 1, 'kept');
    insertRow(db, 'Comment', { id: 1, postId: 10, authorId: 2, markdown: 'parent', html: 'parent' });
    insertRow(db, 'Comment', { id: 2, postId: 10, authorId: 2, parentId: 1, markdown: 'child', html: 'child' });
    insertRow(db, 'Comment', { id: 3, postId: 11, authorId: 2, markdown: 'other', html: 'other' });
    insertRow(db, 'Comment', { id: 4, postId: 11, authorId: 2, parentId: 2 });
    insertRow(db, 'Comment', { id: 5, postId: 11, authorId: 2, parentId: 4 });
    insertRow(db, 'CommentLike', { commentId: 2, userId: 1 });
    insertRow(db, 'CommentLike', { commentId: 3, userId: 1 });
    insertRow(db, 'CommentLike', { commentId: 5, userId: 1 });
    insertRow(db, 'Tag', { id: 1, name: 'kept-tag' });
    insertRow(db, '_PostToTag', { A: 10, B: 1 });
    insertRow(db, 'PostLike', { postId: 10, userId: 2 });
    insertRow(db, 'PinnedPost', { postId: 10, userId: 1 });
    insertRow(db, 'PostShareLink', { id: 1, postId: 10, token: 'a'.repeat(22) });
    insertRow(db, 'PostShareDailyCount', { linkId: 1, day: '2026-01-01', clicks: 1 });
    insertRow(db, 'PostRevision', { id: 1, postId: 10, type: 'edit' });
    insertRow(db, 'PostRevision', { id: 2, postId: 10, type: 'restore', restoredFromId: 1 });
    insertRow(db, 'PostRevision', { id: 3, postId: 11, type: 'restore', restoredFromId: 2 });

    const purge = (expected: string) =>
      fixture.app.inject({
        method: 'DELETE',
        url: `/v1/setting/trash-posts/trashed?expectedDeletedDate=${encodeURIComponent(expected)}`,
        headers: fixture.headers,
      });
    assert.equal((await purge('2026-02-01T03:04:06.000Z')).json().status, 'ERROR');
    assert.equal(fixture.count('Comment', 'id IN (1, 2, 4, 5)'), 4);

    const response = await purge(await trashToken(fixture));
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().status, 'DONE', response.body);

    assert.equal(fixture.count('Post', 'id = 10'), 0);
    for (const table of ['Comment', 'PostLike', 'PinnedPost', 'PostShareLink', 'PostRevision', 'PostContent']) {
      assert.equal(fixture.count(table, 'postId = 10'), 0, table);
    }
    assert.equal(fixture.count('Comment', 'id IN (4, 5)'), 0);
    assert.equal(fixture.count('CommentLike', 'commentId IN (2, 5)'), 0);
    assert.equal(fixture.count('PostShareDailyCount', 'linkId = 1'), 0);
    assert.equal(fixture.count('_PostToTag', 'A = 10'), 0);
    assert.equal(fixture.count('Comment', 'id = 3'), 1);
    assert.equal(fixture.count('CommentLike', 'commentId = 3'), 1);
    assert.equal(fixture.count('Tag', 'id = 1'), 1);
    assert.equal(fixture.count('Post', 'id = 11'), 1);
    assert.equal(fixture.count('PostRevision', 'id = 3 AND restoredFromId IS NULL'), 1);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    await fixture.close();
  }
});

test('restores a Django-era trashed post and still refuses a stale trash version', async () => {
  const fixture = await migratedApp();
  try {
    seedPost(fixture.db, 10, 1, 'trashed', { deletedAt: djangoDeletedDate });
    const restore = (expected: string) =>
      fixture.app.inject({
        method: 'POST',
        url: '/v1/setting/trash-posts/trashed/restore',
        headers: fixture.headers,
        payload: { expectedDeletedDate: expected },
      });
    assert.equal((await restore('2026-02-01T03:04:06.000Z')).json().status, 'ERROR');
    assert.equal(fixture.count('Post', 'id = 10 AND deletedAt IS NOT NULL'), 1);

    const restored = await restore(await trashToken(fixture));
    assert.equal(restored.json().status, 'DONE', restored.body);
    assert.equal(fixture.count('Post', 'id = 10 AND deletedAt IS NULL'), 1);
  } finally {
    await fixture.close();
  }
});

test('restores a revision of a post Django last updated with microseconds', async () => {
  const fixture = await migratedApp();
  try {
    seedPost(fixture.db, 10, 1, 'history', { updatedAt: djangoDeletedDate });
    insertRow(fixture.db, 'PostRevision', {
      id: 1,
      postId: 10,
      type: 'edit',
      title: 'Earlier',
      content: '<p>Earlier</p>',
      tags: '[]',
    });
    const list = await fixture.app.inject({
      url: '/v1/users/@writer/posts/history/revisions',
      headers: fixture.headers,
    });
    const restored = await fixture.app.inject({
      method: 'POST',
      url: '/v1/users/@writer/posts/history/revisions/1/restore',
      headers: fixture.headers,
      payload: { expectedUpdatedDate: list.json().body.currentUpdatedDate },
    });
    assert.equal(restored.json().status, 'DONE', restored.body);
    assert.equal(fixture.count('Post', `id = 10 AND title = 'Earlier'`), 1);
  } finally {
    await fixture.close();
  }
});

test('deletes a revision that a later restore points to', async () => {
  const fixture = await migratedApp();
  try {
    seedPost(fixture.db, 10, 1, 'history');
    insertRow(fixture.db, 'PostRevision', { id: 1, postId: 10, type: 'edit' });
    insertRow(fixture.db, 'PostRevision', { id: 2, postId: 10, type: 'restore', restoredFromId: 1 });
    const response = await fixture.app.inject({
      method: 'DELETE',
      url: '/v1/users/@writer/posts/history/revisions/1',
      headers: fixture.headers,
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(fixture.count('PostRevision', 'id = 1'), 0);
    assert.equal(fixture.count('PostRevision', 'id = 2 AND restoredFromId IS NULL'), 1);
  } finally {
    await fixture.close();
  }
});

test('keeps Django work log share links working and revocable', async () => {
  const fixture = await migratedApp();
  try {
    const { db } = fixture;
    insertRow(db, 'WorkLog', { id: 1, title: 'Log', ownerId: 1 });
    insertRow(db, 'WorkLogEntry', { id: 1, logId: 1, title: 'Entry', text: 'Shared entry', mediaType: 'text' });
    insertRow(db, 'WorkLogShare', { id: 1, token: legacyShareToken, headline: 'Shared', logId: 1 });
    insertRow(db, '_WorkLogEntryToWorkLogShare', { A: 1, B: 1 });

    const shared = await fixture.app.inject(`/work-logs/share/${publicShareToken}/`);
    assert.equal(shared.statusCode, 200, shared.body);
    assert.match(shared.body, /Shared entry/);

    const owner = await fixture.app.inject({ url: '/work-logs/1/', headers: fixture.headers });
    assert.ok(owner.body.includes(`/work-logs/share/${publicShareToken}/`), 'owner page links the public URL');

    const revoked = await fixture.app.inject({
      method: 'POST',
      url: `/work-logs/1/share/${publicShareToken}/revoke/`,
      headers: fixture.headers,
    });
    assert.ok(revoked.statusCode < 400, revoked.body);
    assert.equal(fixture.count('WorkLogShare', 'id = 1'), 0);
    assert.equal((await fixture.app.inject(`/work-logs/share/${publicShareToken}/`)).statusCode, 404);
  } finally {
    await fixture.close();
  }
});

test('stores new work log share tokens in the Django column format', async () => {
  const fixture = await migratedApp();
  try {
    insertRow(fixture.db, 'WorkLog', { id: 1, title: 'Log', ownerId: 1 });
    insertRow(fixture.db, 'WorkLogEntry', { id: 1, logId: 1, title: 'Entry', text: 'Shared entry', mediaType: 'text' });
    const created = await fixture.app.inject({
      method: 'POST',
      url: '/work-logs/1/share/',
      headers: { ...fixture.headers, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        action: 'publish',
        headline: 'New link',
        entries: '1',
        selected_entries: '1',
        entry_ids: '1',
      }).toString(),
    });
    assert.equal(created.statusCode, 302, created.body);
    const { token } = fixture.db.prepare('SELECT token FROM WorkLogShare').get() as { token: string };
    assert.match(token, /^[0-9a-f]{32}$/);
    const location = String(created.headers.location);
    assert.match(location, /^\/work-logs\/share\/[0-9a-f]{8}-[0-9a-f]{4}-/);
    assert.equal((await fixture.app.inject(location)).statusCode, 200);
  } finally {
    await fixture.close();
  }
});

test('removes reply cycles and threads deeper than a SQLite cascade across posts', async () => {
  const fixture = await migratedApp();
  try {
    const { db } = fixture;
    seedPost(db, 10, 1, 'trashed', { deletedAt: djangoDeletedDate });
    seedPost(db, 11, 1, 'kept');
    db.exec('BEGIN; PRAGMA defer_foreign_keys = ON');
    insertRow(db, 'Comment', { id: 1, postId: 10, authorId: 2 });
    for (let id = 2; id <= 1_500; id += 1)
      insertRow(db, 'Comment', { id, postId: id % 2 ? 10 : 11, authorId: 2, parentId: id - 1 });
    insertRow(db, 'Comment', { id: 2_000, postId: 10, authorId: 2, parentId: 2_001 });
    insertRow(db, 'Comment', { id: 2_001, postId: 11, authorId: 2, parentId: 2_000 });
    insertRow(db, 'Comment', { id: 2_002, postId: 10, authorId: 2, parentId: 2_002 });
    insertRow(db, 'Comment', { id: 2_003, postId: 11, authorId: 2 });
    insertRow(db, 'CommentLike', { commentId: 1_500, userId: 1 });
    insertRow(db, 'CommentLike', { commentId: 2_003, userId: 1 });
    db.exec('COMMIT');

    const token = await trashToken(fixture);
    const response = await fixture.app.inject({
      method: 'DELETE',
      url: `/v1/setting/trash-posts/trashed?expectedDeletedDate=${encodeURIComponent(token)}`,
      headers: fixture.headers,
    });
    assert.equal(response.json().status, 'DONE', response.body);
    assert.deepEqual(
      db
        .prepare('SELECT id FROM Comment')
        .all()
        .map((row) => row.id),
      [2_003],
    );
    assert.deepEqual(
      db
        .prepare('SELECT commentId FROM CommentLike')
        .all()
        .map((row) => row.commentId),
      [2_003],
    );
  } finally {
    await fixture.close();
  }
});

test('deletes a series and detaches its posts', async () => {
  const fixture = await migratedApp();
  try {
    insertRow(fixture.db, 'Series', { id: 5, ownerId: 1, name: 'Series', slug: 'series-five', layout: 'list' });
    seedPost(fixture.db, 10, 1, 'in-series', { seriesId: 5 });
    const response = await fixture.app.inject({ method: 'DELETE', url: '/v1/series/5', headers: fixture.headers });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().status, 'DONE', response.body);
    assert.equal(fixture.count('Series', 'id = 5'), 0);
    assert.equal(fixture.count('Post', 'id = 10 AND seriesId IS NULL'), 1);
  } finally {
    await fixture.close();
  }
});

test('applies Django empty title and content rules to API updates', async () => {
  const fixture = await migratedApp();
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}` });
  try {
    seedPost(fixture.db, 10, 1, 'published');
    seedPost(fixture.db, 11, 1, 'draft', { publishedAt: null });
    await assert.rejects(updateAuthorPost(db, editor, 10, { title: '' }), PostValidationError);
    await assert.rejects(updateAuthorPost(db, editor, 10, { content: '' }), PostValidationError);
    assert.equal(fixture.count('Post', `id = 10 AND title = 'published'`), 1);
    assert.equal(fixture.count('PostContent', `postId = 10 AND html = '<p>Body</p>'`), 1);

    await updateAuthorPost(db, editor, 10, { subtitle: 'Only subtitle' });
    assert.equal(fixture.count('Post', `id = 10 AND title = 'published' AND subtitle = 'Only subtitle'`), 1);

    await updateAuthorPost(db, editor, 11, { title: '', content: '' });
    assert.equal(fixture.count('Post', `id = 11 AND title = 'Untitled'`), 1);
    assert.equal(fixture.count('PostContent', `postId = 11 AND html = ''`), 1);
  } finally {
    await db.$disconnect();
    await fixture.close();
  }
});
