import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { createInitialDatabase, deployMigrations } from '../src/startup/migrations.js';
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

interface PublicComment {
  id: number;
  author: string;
  isMine: boolean;
  isDeleted: boolean;
  renderedContent: string;
  permissions: Record<string, boolean>;
}

const form = { 'content-type': 'application/x-www-form-urlencoded' };
const dayTotal = (days: Record<string, number>) => Object.values(days).reduce((sum, count) => sum + count, 0);

test('a deleted comment keeps its author in storage and stays deleted everywhere else', async () => {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  insertRow(fixture.db, 'User', { id: 2, username: 'reader', passwordHash: 'pbkdf2_sha256$fixture$r', isActive: 1 });
  insertRow(fixture.db, 'Profile', { userId: 2, role: 'READER' });
  insertRow(fixture.db, 'User', {
    id: 3,
    username: 'moderator',
    passwordHash: 'pbkdf2_sha256$fixture$m',
    isActive: 1,
    isStaff: 1,
  });
  insertRow(fixture.db, 'Profile', { userId: 3, role: 'READER' });
  seedPost(fixture.db, 10, 1, 'open-post');
  seedPost(fixture.db, 11, 1, 'quiet-post');
  const createdAt = Date.now();
  for (const [id, postId, text] of [
    [1, 10, 'removed by author'],
    [2, 10, 'removed by staff'],
    [3, 10, 'still here'],
    [4, 11, 'only comment'],
  ] as const) {
    insertRow(fixture.db, 'Comment', { id, postId, authorId: 2, markdown: text, html: `<p>${text}</p>`, createdAt });
  }
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  try {
    const reader = signIn(fixture.db, 2);
    const writer = signIn(fixture.db, 1);
    const staff = signIn(fixture.db, 3);

    const own = await app.inject({ method: 'DELETE', url: '/v1/comments/1', headers: reader });
    assert.equal(own.json().body.isDeleted, true);
    assert.equal(own.json().body.author, 'Ghost');
    assert.doesNotMatch(own.body, /removed by author/);
    const moderated = await app.inject({ method: 'DELETE', url: '/v1/admin/comments/2', headers: staff });
    assert.equal(moderated.json().status, 'DONE', moderated.body);
    await app.inject({ method: 'DELETE', url: '/v1/comments/4', headers: reader });

    const stored = fixture.db
      .prepare(
        'SELECT authorId, markdown, deletedAt IS NOT NULL AS deleted FROM "Comment" WHERE id IN (1, 2) ORDER BY id',
      )
      .all()
      .map((row) => ({ ...row }));
    assert.deepEqual(stored, [
      { authorId: 2, markdown: 'removed by author', deleted: 1 },
      { authorId: 2, markdown: 'removed by staff', deleted: 1 },
    ]);

    const page = async (headers: Record<string, string> = {}) => {
      const response = await app.inject({ url: '/v1/posts/open-post/comments', headers });
      assert.doesNotMatch(response.body, /removed by/);
      return response.json().body.comments as PublicComment[];
    };
    for (const comment of (await page()).filter(({ id }) => id !== 3)) {
      assert.equal(comment.isDeleted, true);
      assert.equal(comment.author, 'Ghost');
    }
    const asAuthor = (await page(reader)).find(({ id }) => id === 1);
    assert.equal(asAuthor?.isMine, false);
    assert.deepEqual(Object.values(asAuthor?.permissions ?? {}), [false, false, false, false]);

    assert.equal((await app.inject({ url: '/v1/comments/1', headers: reader })).statusCode, 404);
    const edit = await app.inject({
      method: 'PUT',
      url: '/v1/comments/1',
      headers: { ...reader, ...form },
      payload: 'comment=true&commentMd=rewritten',
    });
    assert.equal(edit.json().errorCode, 'error:AT');
    assert.equal(
      (await app.inject({ method: 'DELETE', url: '/v1/comments/1', headers: reader })).json().errorCode,
      'error:AT',
    );
    const like = await app.inject({
      method: 'PUT',
      url: '/v1/comments/1',
      headers: { ...writer, ...form },
      payload: 'like=true',
    });
    assert.equal(like.json().errorCode, 'error:RJ');
    const reply = await app.inject({
      method: 'POST',
      url: '/v1/comments?url=open-post',
      headers: { ...writer, ...form },
      payload: 'parentId=1&commentMd=hello',
    });
    assert.equal(reply.json().errorCode, 'error:RJ');
    assert.equal(
      (await app.inject({ method: 'DELETE', url: '/v1/admin/comments/2', headers: staff })).json().errorCode,
      'error:NF',
    );

    const mine = (await app.inject({ url: '/v1/comments/user', headers: reader })).json().body;
    assert.deepEqual(
      mine.comments.map((row: { content: string }) => row.content),
      ['<p>still here</p>'],
    );
    assert.equal(dayTotal((await app.inject({ url: '/v1/setting/heatmap', headers: reader })).json().body), 1);
    assert.equal(dayTotal((await app.inject('/v1/users/@reader/heatmap')).json().body), 1);
    const listed = (await app.inject({ url: '/v1/admin/comments', headers: staff })).json().body.comments;
    assert.deepEqual(
      listed.map(({ id }: { id: number }) => id),
      [3],
    );

    const mention = await app.inject({
      method: 'POST',
      url: '/v1/comments?url=quiet-post',
      headers: { ...writer, ...form },
      payload: 'commentMd=%40reader%20hello',
    });
    assert.equal(mention.json().status, 'DONE', mention.body);
    const mentioned = fixture.db
      .prepare(`SELECT COUNT(*) AS total FROM "Notification" WHERE userId = 2 AND messageKey = 'comment.mentioned'`)
      .get() as { total: number };
    assert.equal(mentioned.total, 0);
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});

test('upgrading a database leaves its comments unchanged and reads an authorless one as deleted', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blex-comment-upgrade-'));
  const path = join(directory, 'db.sqlite3');
  try {
    await createInitialDatabase(path);
    const before = new DatabaseSync(path);
    seedEditor(before, 1, 'writer');
    seedPost(before, 10, 1, 'open-post');
    insertRow(before, 'Comment', { id: 1, postId: 10, authorId: 1, markdown: 'live', html: '<p>live</p>' });
    insertRow(before, 'Comment', {
      id: 2,
      postId: 10,
      authorId: null,
      markdown: 'gone',
      html: '<p>gone</p>',
    });
    before.close();

    await deployMigrations(path);

    const after = new DatabaseSync(path);
    const rows = after
      .prepare('SELECT id, authorId, markdown, deletedAt FROM "Comment" ORDER BY id')
      .all()
      .map((row) => ({ ...row }));
    after.close();
    assert.deepEqual(rows, [
      { id: 1, authorId: 1, markdown: 'live', deletedAt: null },
      { id: 2, authorId: null, markdown: 'gone', deletedAt: null },
    ]);

    const app = await buildApp(path, testSiteUrl, { secretKey: testSecretKey, cipherKey: testCipherKey }, directory);
    try {
      const comments = (await app.inject('/v1/posts/open-post/comments')).json().body.comments as PublicComment[];
      const byId = new Map(comments.map((comment) => [comment.id, comment]));
      assert.equal(byId.get(1)?.isDeleted, false);
      assert.match(byId.get(1)?.renderedContent ?? '', /live/);
      assert.equal(byId.get(2)?.isDeleted, true);
      assert.doesNotMatch(byId.get(2)?.renderedContent ?? '', /gone/);
    } finally {
      await app.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
