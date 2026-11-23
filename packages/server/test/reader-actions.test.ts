import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import test from 'node:test';
import { encryptSecret } from '../src/features/auth/encrypted-secret.js';
import { registerReaderActions } from '../src/features/engagement/index.js';
import { accountTables, createMigratedTables, migratedTableSql } from './fixtures/migrated-database.js';
import { installNotificationTables } from './fixtures/notifications.js';

const readerCipherKey = '0123456789abcdef0123456789abcdef';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-reader-actions-'));
const databasePath = join(directory, 'synthetic reader actions.sqlite3');
const database = new DatabaseSync(databasePath);
createMigratedTables(database, 'IntegrationSetting');
database.exec(`
  ${migratedTableSql(...accountTables)}
${migratedTableSql('Series', 'Post', 'PostContent', 'Tag', '_PostToTag', 'PostRevision', 'PostLike', 'PinnedPost', 'PostShareLink', 'PostShareDailyCount')}


  ${migratedTableSql('Comment', 'CommentLike')}
    ${migratedTableSql('AuthorSubscription')}
  ${migratedTableSql('AuthorSubscriptionLog')}

  INSERT INTO "User" ("id", "username", "name", "isActive", "email", "passwordHash", "joinedAt") VALUES
    (1, 'writer', 'Writer Name', 1, '', '', 1577836800000),
    (2, 'reader', 'Reader Name', 1, '', '', 1577836800000),
    (3, 'inactive', 'Inactive', 0, '', '', 1577836800000),
    (4, 'second-writer', 'Second Writer', 1, '', '', 1577836800000),
    (5, 'other-reader', 'Other Reader', 1, '', '', 1577836800000);
  INSERT INTO "Profile" ("userId", "bio", "avatar", "role") VALUES
    (1, 'Writer bio', 'avatars/writer.png', 'EDITOR'),
    (2, 'Reader bio', '', 'READER'),
    (3, '', '', 'EDITOR'),
    (4, 'Second bio', 'https://images.example/second.png', 'EDITOR'),
    (5, 'Other reader bio', '', 'READER');
  INSERT INTO "Post" ("id", "title", "slug", "authorId", "publishedAt", "deletedAt", "createdAt", "updatedAt") VALUES
    (1, 'Public post', 'public-post', 1, 1767225600123, NULL, 946684800000, 946684800000),
    (2, 'Hidden post', 'hidden-post', 1, 1767225600123, NULL, 946684800000, 946684800000),
    (3, 'Draft post', 'draft-post', 1, NULL, NULL, 946684800000, 946684800000),
    (4, 'Blocked comments', 'blocked-comments', 1, 1767225600123, NULL, 946684800000, 946684800000),
    (5, 'Deleted post', 'deleted-post', 1, 1767225600123, 1767312000000, 946684800000, 946684800000);
  UPDATE "Post" SET isHidden = 0, commentsBlocked = 0 WHERE id = 1;
    UPDATE "Post" SET isHidden = 1, commentsBlocked = 0 WHERE id = 2;
    UPDATE "Post" SET isHidden = 0, commentsBlocked = 0 WHERE id = 3;
    UPDATE "Post" SET isHidden = 0, commentsBlocked = 1 WHERE id = 4;
    UPDATE "Post" SET isHidden = 0, commentsBlocked = 0 WHERE id = 5;
  INSERT INTO "Comment" ("id", "markdown", "html", "isEdited", "isHearted", "createdAt", "authorId", "postId", "parentId") VALUES
    (10, 'Writer parent', '<p>Writer parent</p><script>window.bad = true</script>', 0, 0, 1767225600123, 1, 1, NULL),
    (11, 'Reader reply', '<p>Reader reply</p>', 1, 0, 1767312000654, 2, 1, 10),
    (12, 'Deleted note', '<p>ignored after delete</p>', 0, 0, 1767398400000, NULL, 1, NULL),
    (13, 'Hidden comment', '<p>private</p>', 0, 0, 1767484800000, 2, 2, NULL),
    (14, 'Blocked comment', '<p>kept visible</p>', 0, 0, 1767571200000, 2, 4, NULL);
  INSERT INTO "CommentLike" ("commentId", "userId") VALUES
    (11, 1);
  INSERT INTO IntegrationSetting (id, telegramEnabled, telegramBotUsername, telegramBotToken, updatedAt) VALUES (1, 1, 'test_bot', '${encryptSecret('bot-token', readerCipherKey)}', 1767225600123);
  INSERT INTO "AuthorSubscription" ("id", "createdAt", "authorId", "subscriberId") VALUES
    (1, 1588345200654, 4, 2);
`);
installNotificationTables(database);
database.exec(`
  INSERT INTO TelegramConnection (userId, telegramId, createdAt) VALUES (2, 'telegram-id', 1767225600000);
  INSERT INTO "UserPreference" (userId, notifyPostLike, notifyPostComment, notifyMention) VALUES (1, 1, 1, 1);
`);
database.close();

const db = new PrismaClient({ datasourceUrl: `file:${databasePath}?connection_limit=1` });
const app = Fastify();
registerReaderActions(app, db, {
  cipherKey: readerCipherKey,
  currentUser: async (request) => {
    const rawId = request.headers['x-user-id'];
    const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
    if (!Number.isSafeInteger(id) || id < 1) return null;
    const rows = await db.$queryRaw<Array<{ username: string }>>`
      SELECT username FROM "User" WHERE id = ${id} LIMIT 1
    `;
    return rows[0] ? { id, username: rows[0].username } : null;
  },
  validateCsrf: (request) => request.headers['x-test-csrf'] === 'valid',
});
await app.ready();

test.after(async () => {
  await app.close();
  await db.$disconnect();
  await rm(directory, { recursive: true });
});

const signedIn = { 'x-user-id': '2', 'x-test-csrf': 'valid' };

test('returns the legacy raw post-like envelope and serializes concurrent toggles', async () => {
  const anonymous = await app.inject({ method: 'POST', url: '/like/public-post', headers: { 'x-test-csrf': 'valid' } });
  assert.equal(anonymous.statusCode, 401);
  assert.deepEqual(anonymous.json(), { status: 'error', message: 'Authentication required' });

  const first = await app.inject({ method: 'POST', url: '/like/public-post', headers: signedIn });
  assert.deepEqual(first.json(), { status: 'done', countLikes: 1, hasLiked: true });
  const toggles = await Promise.all([
    app.inject({ method: 'POST', url: '/like/public-post', headers: signedIn }),
    app.inject({ method: 'POST', url: '/like/public-post', headers: signedIn }),
  ]);
  assert.deepEqual(
    toggles.map((response) => response.json()).sort((left, right) => left.countLikes - right.countLikes),
    [
      { status: 'done', countLikes: 0, hasLiked: false },
      { status: 'done', countLikes: 1, hasLiked: true },
    ],
  );
  const rows = await db.$queryRaw<Array<{ count: number | bigint }>>`
    SELECT COUNT(*) AS count FROM "PostLike" WHERE postId = 1 AND userId = 2
  `;
  assert.equal(Number(rows[0]?.count), 1);

  assert.equal((await app.inject({ method: 'POST', url: '/like/hidden-post', headers: signedIn })).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: '/like/draft-post', headers: signedIn })).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: '/like/deleted-post', headers: signedIn })).statusCode, 404);
  assert.equal(
    (await app.inject({ method: 'POST', url: '/like/public-post', headers: { 'x-user-id': '2' } })).statusCode,
    403,
  );
});

test('serves anonymous and signed-in public comments with nested permissions and sanitization', async () => {
  const anonymous = await app.inject('/v1/posts/public-post/comments');
  assert.equal(anonymous.statusCode, 200, anonymous.body);
  const payload = anonymous.json();
  assert.deepEqual(payload.status, 'DONE');
  assert.equal(payload.body.canComment, true);
  assert.equal(payload.body.comments.length, 2);
  const parent = payload.body.comments[0];
  assert.equal(parent.author, 'writer');
  assert.equal(parent.authorImage, '/resources/media/avatars/writer.png');
  assert.equal(parent.replies.length, 1);
  assert.equal(parent.replies[0].countLikes, 1);
  assert.equal(parent.replies[0].isEdited, true);
  assert.equal(parent.permissions.canEdit, false);
  assert.equal(parent.permissions.canReply, false);
  assert.equal(parent.replies[0].permissions.canLike, false);
  assert.doesNotMatch(parent.renderedContent, /<script|window\.bad/);
  assert.equal(payload.body.comments[1].author, 'Ghost');
  assert.equal(payload.body.comments[1].isDeleted, true);
  assert.deepEqual(payload.body.comments[1].permissions, {
    canEdit: false,
    canDelete: false,
    canLike: false,
    canReply: false,
  });

  const viewer = await app.inject({ url: '/v1/posts/public-post/comments', headers: { 'x-user-id': '2' } });
  const viewerParent = viewer.json().body.comments[0];
  assert.equal(viewerParent.permissions.canLike, true);
  assert.equal(viewerParent.permissions.canReply, true);
  assert.equal(viewerParent.replies[0].isLiked, false);
  assert.equal(viewerParent.replies[0].isMine, true);
  assert.equal(viewerParent.replies[0].permissions.canEdit, true);
  const writerView = await app.inject({ url: '/v1/posts/public-post/comments', headers: { 'x-user-id': '1' } });
  assert.equal(writerView.json().body.comments[0].replies[0].isLiked, true);
  assert.equal(writerView.json().body.comments[0].replies[0].permissions.canLike, true);

  const hidden = await app.inject('/v1/posts/hidden-post/comments');
  assert.deepEqual(hidden.json().body, { canComment: false, comments: [] });
  const blocked = await app.inject('/v1/posts/blocked-comments/comments');
  assert.equal(blocked.json().body.canComment, false);
  assert.equal(blocked.json().body.comments.length, 1);
  assert.equal(blocked.json().body.comments[0].permissions.canReply, false);
});

test('creates and replies to comments through form and JSON bodies with plain-text escaping', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/comments?url=public-post',
    headers: { ...signedIn, 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'commentMd=Hello%0A%3Cscript%3Ebad()%3C%2Fscript%3E&parentId=10',
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().status, 'DONE');
  assert.equal(response.json().body.parentId, 10);
  assert.match(response.json().body.renderedContent, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(response.json().body.renderedContent, /<script/);
  const rows = await db.$queryRaw<Array<{ textMd: string; textHtml: string; parentId: number | null }>>`
    SELECT markdown AS textMd, html AS textHtml, parentId
    FROM "Comment" WHERE authorId = 2 ORDER BY id DESC LIMIT 1
  `;
  assert.equal(rows[0]?.textMd, 'Hello\n<script>bad()</script>');
  assert.equal(rows[0]?.textHtml, '<p>Hello<br>&lt;script&gt;bad()&lt;/script&gt;</p>');
  assert.equal(rows[0]?.parentId, 10);

  const json = await app.inject({
    method: 'POST',
    url: '/v1/comments?url=public-post',
    headers: { ...signedIn, 'content-type': 'application/json' },
    payload: { commentMd: '<em>plain text</em>' },
  });
  assert.match(json.json().body.renderedContent, /&lt;em&gt;plain text&lt;\/em&gt;/);

  const anonymous = await app.inject({
    method: 'POST',
    url: '/v1/comments?url=public-post',
    headers: { 'x-test-csrf': 'valid', 'content-type': 'application/json' },
    payload: { commentMd: 'No user' },
  });
  assert.equal(anonymous.json().errorCode, 'error:AT');
  const crossPostReply = await app.inject({
    method: 'POST',
    url: '/v1/comments?url=public-post',
    headers: { ...signedIn, 'content-type': 'application/json' },
    payload: { commentMd: 'wrong parent', parentId: '14' },
  });
  assert.equal(crossPostReply.json().errorCode, 'error:RJ');
  const blocked = await app.inject({
    method: 'POST',
    url: '/v1/comments?url=blocked-comments',
    headers: { ...signedIn, 'content-type': 'application/json' },
    payload: { commentMd: 'blocked' },
  });
  assert.equal(blocked.json().errorCode, 'error:RJ');
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/v1/comments?url=hidden-post',
        headers: { ...signedIn, 'content-type': 'application/json' },
        payload: { commentMd: 'private' },
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/v1/comments?url=public-post',
        headers: { 'x-user-id': '2', 'content-type': 'application/json' },
        payload: { commentMd: 'missing CSRF' },
      })
    ).statusCode,
    403,
  );
});

test('gets, edits, likes and soft-deletes comments with owner checks', async () => {
  const editGet = await app.inject({ url: '/v1/comments/11', headers: { 'x-user-id': '2' } });
  assert.deepEqual(editGet.json(), { status: 'DONE', body: { textMd: 'Reader reply' } });
  assert.equal(editGet.headers['cache-control'], 'private, no-store');
  const nonOwner = await app.inject({ url: '/v1/comments/11', headers: { 'x-user-id': '1' } });
  assert.equal(nonOwner.json().errorCode, 'error:AT');
  assert.equal((await app.inject({ url: '/v1/comments/13', headers: { 'x-user-id': '2' } })).statusCode, 404);

  const edit = await app.inject({
    method: 'PUT',
    url: '/v1/comments/11',
    headers: { ...signedIn, 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'comment=comment&commentMd=first%0A%3Cscript%3Ebad()%3C%2Fscript%3E',
  });
  assert.deepEqual(edit.json(), { status: 'DONE', body: {} });
  const changed = await db.$queryRaw<Array<{ textMd: string; textHtml: string; edited: number | bigint }>>`
    SELECT markdown AS textMd, html AS textHtml, CAST(isEdited AS INTEGER) AS edited
    FROM "Comment" WHERE id = 11
  `;
  assert.equal(changed[0]?.textMd, 'first\n<script>bad()</script>');
  assert.equal(changed[0]?.textHtml, '<p>first<br>&lt;script&gt;bad()&lt;/script&gt;</p>');
  assert.equal(Number(changed[0]?.edited), 1);
  const formEdit = await app.inject({
    method: 'POST',
    url: '/v1/comments/11',
    headers: { ...signedIn, 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'action=edit&commentMd=Edited+from+the+article&returnTo=%2F%40editor%2Fpublic',
  });
  assert.equal(formEdit.statusCode, 303);
  assert.equal(formEdit.headers.location, '/@editor/public#comment-11');
  assert.equal(
    (await app.inject({ url: '/v1/comments/11', headers: { 'x-user-id': '2' } })).json().body.textMd,
    'Edited from the article',
  );

  const like = await app.inject({
    method: 'PUT',
    url: '/v1/comments/10',
    headers: { ...signedIn, 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'like=like',
  });
  assert.deepEqual(like.json().body, { isLiked: true, countLikes: 1 });
  const unlike = await app.inject({
    method: 'PUT',
    url: '/v1/comments/10',
    headers: { ...signedIn, 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'like=like',
  });
  assert.deepEqual(unlike.json().body, { isLiked: false, countLikes: 0 });
  const concurrentLikes = await Promise.all([
    app.inject({
      method: 'PUT',
      url: '/v1/comments/10',
      headers: { ...signedIn, 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'like=like',
    }),
    app.inject({
      method: 'PUT',
      url: '/v1/comments/10',
      headers: { ...signedIn, 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'like=like',
    }),
  ]);
  assert.deepEqual(concurrentLikes.map((response) => response.json().body.countLikes).sort(), [0, 1]);
  const finalLikes = await db.$queryRaw<Array<{ count: number | bigint }>>`
    SELECT COUNT(*) AS count FROM "CommentLike" WHERE commentId = 10 AND userId = 2
  `;
  assert.equal(Number(finalLikes[0]?.count), 0);
  const selfLike = await app.inject({
    method: 'PUT',
    url: '/v1/comments/11',
    headers: { 'x-user-id': '2', 'x-test-csrf': 'valid', 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'like=like',
  });
  assert.equal(selfLike.json().errorCode, 'error:AT');
  const anonymousLike = await app.inject({
    method: 'PUT',
    url: '/v1/comments/10',
    headers: { 'x-test-csrf': 'valid', 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'like=like',
  });
  assert.equal(anonymousLike.json().errorCode, 'error:NL');

  const deleted = await app.inject({ method: 'DELETE', url: '/v1/comments/11', headers: signedIn });
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.equal(deleted.json().body.isDeleted, true);
  assert.deepEqual(deleted.json().body.permissions, {
    canEdit: false,
    canDelete: false,
    canLike: false,
    canReply: false,
  });
  const persisted = await db.$queryRaw<Array<{ authorId: number | null }>>`
    SELECT authorId FROM "Comment" WHERE id = 11
  `;
  assert.equal(persisted[0]?.authorId, null);
  const wrongOwnerDelete = await app.inject({ method: 'DELETE', url: '/v1/comments/10', headers: signedIn });
  assert.equal(wrongOwnerDelete.json().errorCode, 'error:AT');

  const malformedJson = await app.inject({
    method: 'PUT',
    url: '/v1/comments/10',
    headers: { ...signedIn, 'content-type': 'application/json' },
    payload: '[]',
  });
  assert.equal(malformedJson.statusCode, 404);
});

test('keeps subscriptions idempotent, logs only state changes, and reports account state', async () => {
  const anonymousState = await app.inject('/v1/users/@writer/subscription');
  assert.deepEqual(anonymousState.json(), { status: 'DONE', body: { canSubscribe: true, isSubscribed: false } });

  const subscribed = await Promise.all([
    app.inject({ method: 'POST', url: '/v1/users/@writer/subscription', headers: signedIn }),
    app.inject({ method: 'POST', url: '/v1/users/@writer/subscription', headers: signedIn }),
  ]);
  assert.ok(subscribed.every((response) => response.json().status === 'DONE'));
  assert.ok(subscribed.every((response) => response.json().body.isSubscribed === true));
  assert.ok(subscribed.every((response) => response.json().body.suggestTelegramConnection === false));
  const unconnected = await app.inject({
    method: 'POST',
    url: '/v1/users/@writer/subscription',
    headers: { 'x-user-id': '5', 'x-test-csrf': 'valid' },
  });
  assert.equal(unconnected.json().body.suggestTelegramConnection, true);
  const state = await app.inject({ url: '/v1/users/@writer/subscription', headers: { 'x-user-id': '2' } });
  assert.deepEqual(state.json().body, { canSubscribe: true, isSubscribed: true });

  const counts = await db.$queryRaw<Array<{ subscriptions: number | bigint; logs: number | bigint }>>`
    SELECT (SELECT COUNT(*) FROM "AuthorSubscription" WHERE subscriberId = 2 AND authorId = 1) AS subscriptions,
           (SELECT COUNT(*) FROM "AuthorSubscriptionLog" WHERE subscriberId = 2 AND authorId = 1) AS logs
  `;
  assert.equal(Number(counts[0]?.subscriptions), 1);
  assert.equal(Number(counts[0]?.logs), 1);

  const mine = await app.inject({ url: '/v1/subscriptions', headers: { 'x-user-id': '2' } });
  assert.equal(mine.json().body.subscriptions.length, 2);
  assert.equal(mine.json().body.isTelegramConnected, true);
  const newSubscription = mine.json().body.subscriptions[0];
  assert.equal(newSubscription.username, 'writer');
  assert.equal(newSubscription.name, 'Writer Name');
  assert.equal(newSubscription.avatar, '/resources/media/avatars/writer.png');
  assert.equal(newSubscription.isPublishing, true);
  assert.equal(newSubscription.subscribedDate, new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10));
  assert.equal(mine.json().body.subscriptions[1].username, 'second-writer');
  assert.equal(mine.json().body.subscriptions[1].subscribedDate, '2020-05-02');

  const removed = await app.inject({ method: 'DELETE', url: '/v1/users/@writer/subscription', headers: signedIn });
  assert.deepEqual(removed.json().body, { canSubscribe: true, isSubscribed: false });
  await app.inject({ method: 'DELETE', url: '/v1/users/@writer/subscription', headers: signedIn });
  const logRows = await db.$queryRaw<Array<{ action: string }>>`
    SELECT action FROM "AuthorSubscriptionLog" WHERE subscriberId = 2 AND authorId = 1 ORDER BY id
  `;
  assert.deepEqual(
    logRows.map((row) => row.action),
    ['subscribe', 'unsubscribe'],
  );
  assert.equal((await app.inject('/v1/subscriptions')).json().errorCode, 'error:NL');
});

test('rejects self, reader and unknown subscriptions while preserving public state lookup', async () => {
  const self = await app.inject({
    method: 'POST',
    url: '/v1/users/@writer/subscription',
    headers: { 'x-user-id': '1', 'x-test-csrf': 'valid' },
  });
  assert.equal(self.json().errorCode, 'error:RJ');
  const reader = await app.inject({ method: 'POST', url: '/v1/users/@reader/subscription', headers: { ...signedIn } });
  assert.equal(reader.json().errorCode, 'error:RJ');
  assert.equal((await app.inject('/v1/users/@inactive/subscription')).json().body.canSubscribe, false);
  assert.equal((await app.inject('/v1/users/@missing/subscription')).statusCode, 404);
  const anonymousPost = await app.inject({
    method: 'POST',
    url: '/v1/users/@writer/subscription',
    headers: { 'x-test-csrf': 'valid' },
  });
  assert.equal(anonymousPost.json().errorCode, 'error:NL');
  const noCsrf = await app.inject({
    method: 'DELETE',
    url: '/v1/users/@writer/subscription',
    headers: { 'x-user-id': '2' },
  });
  assert.equal(noCsrf.statusCode, 403);
});
