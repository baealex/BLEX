import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import test from 'node:test';
import { encryptDjangoSecret } from '../src/features/auth/django-secret.js';
import { registerReaderActions } from '../src/features/engagement/index.js';
import { installNotificationTables } from './fixtures/notifications.js';

const readerCipherKey = '0123456789abcdef0123456789abcdef';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-reader-actions-'));
const databasePath = join(directory, 'Django reader actions.sqlite3');
const database = new DatabaseSync(databasePath);
database.exec(`
  CREATE TABLE auth_user (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT 1
  );
  CREATE TABLE board_profile (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    bio TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'READER'
  );
  CREATE TABLE board_post (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    author_id INTEGER NOT NULL,
    published_date DATETIME,
    deleted_date DATETIME
  );
  CREATE TABLE board_postconfig (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL UNIQUE,
    hide BOOLEAN NOT NULL DEFAULT 0,
    block_comment BOOLEAN NOT NULL DEFAULT 0
  );
  CREATE TABLE board_post_likes (
    id INTEGER PRIMARY KEY,
    created_date DATETIME NOT NULL,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    UNIQUE(post_id, user_id)
  );
  CREATE TABLE board_comment (
    id INTEGER PRIMARY KEY,
    text_md TEXT NOT NULL,
    text_html TEXT NOT NULL,
    edited BOOLEAN NOT NULL DEFAULT 0,
    heart BOOLEAN NOT NULL DEFAULT 0,
    created_date DATETIME NOT NULL,
    author_id INTEGER,
    post_id INTEGER NOT NULL,
    parent_id INTEGER
  );
  CREATE TABLE board_comment_likes (
    id INTEGER PRIMARY KEY,
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    UNIQUE(comment_id, user_id)
  );
  CREATE TABLE board_authorsubscription (
    id INTEGER PRIMARY KEY,
    created_date DATETIME NOT NULL,
    author_id INTEGER NOT NULL,
    subscriber_id INTEGER NOT NULL,
    UNIQUE(subscriber_id, author_id)
  );
  CREATE TABLE board_authorsubscriptionlog (
    id INTEGER PRIMARY KEY,
    action TEXT NOT NULL,
    created_date DATETIME NOT NULL,
    author_id INTEGER NOT NULL,
    subscriber_id INTEGER NOT NULL
  );
  CREATE TABLE board_integrationsetting (
    id INTEGER PRIMARY KEY,
    telegram_enabled BOOLEAN NOT NULL DEFAULT 0,
    telegram_bot_username TEXT NOT NULL DEFAULT '',
    telegram_bot_token TEXT NOT NULL DEFAULT '',
    updated_date DATETIME NOT NULL
  );
  CREATE TABLE board_telegramsync (
    id INTEGER PRIMARY KEY,
    auth_token TEXT NOT NULL DEFAULT '',
    auth_token_exp DATETIME NOT NULL DEFAULT '2026-01-01 00:00:00',
    created_date DATETIME NOT NULL DEFAULT '2026-01-01 00:00:00',
    user_id INTEGER NOT NULL UNIQUE,
    tid TEXT NOT NULL DEFAULT ''
  );

  INSERT INTO auth_user VALUES
    (1, 'writer', 'Writer Name', 1),
    (2, 'reader', 'Reader Name', 1),
    (3, 'inactive', 'Inactive', 0),
    (4, 'second-writer', 'Second Writer', 1),
    (5, 'other-reader', 'Other Reader', 1);
  INSERT INTO board_profile VALUES
    (1, 1, 'Writer bio', 'avatars/writer.png', 'EDITOR'),
    (2, 2, 'Reader bio', '', 'READER'),
    (3, 3, '', '', 'EDITOR'),
    (4, 4, 'Second bio', 'https://images.example/second.png', 'EDITOR'),
    (5, 5, 'Other reader bio', '', 'READER');
  INSERT INTO board_post VALUES
    (1, 'Public post', 'public-post', 1, '2026-01-01 00:00:00.123456', NULL),
    (2, 'Hidden post', 'hidden-post', 1, '2026-01-01 00:00:00.123456', NULL),
    (3, 'Draft post', 'draft-post', 1, NULL, NULL),
    (4, 'Blocked comments', 'blocked-comments', 1, '2026-01-01 00:00:00.123456', NULL),
    (5, 'Deleted post', 'deleted-post', 1, '2026-01-01 00:00:00.123456', '2026-01-02 00:00:00');
  INSERT INTO board_postconfig VALUES
    (1, 1, 0, 0), (2, 2, 1, 0), (3, 3, 0, 0), (4, 4, 0, 1), (5, 5, 0, 0);
  INSERT INTO board_comment VALUES
    (10, 'Writer parent', '<p>Writer parent</p><script>window.bad = true</script>', 0, 0, '2026-01-01 00:00:00.123456', 1, 1, NULL),
    (11, 'Reader reply', '<p>Reader reply</p>', 1, 0, '2026-01-02 00:00:00.654321', 2, 1, 10),
    (12, 'Deleted note', '<p>ignored after delete</p>', 0, 0, '2026-01-03 00:00:00', NULL, 1, NULL),
    (13, 'Hidden comment', '<p>private</p>', 0, 0, '2026-01-04 00:00:00', 2, 2, NULL),
    (14, 'Blocked comment', '<p>kept visible</p>', 0, 0, '2026-01-05 00:00:00', 2, 4, NULL);
  INSERT INTO board_comment_likes VALUES (1, 11, 1);
  INSERT INTO board_integrationsetting VALUES (1, 1, 'test_bot', '${encryptDjangoSecret('bot-token', readerCipherKey)}', '2026-01-01 00:00:00.123456');
  INSERT INTO board_authorsubscription VALUES (1, '2020-05-01 15:00:00.654321', 4, 2);
  INSERT INTO board_telegramsync VALUES (1, '', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 2, 'telegram-id');
`);
installNotificationTables(database);
database.exec(`
  INSERT INTO board_userconfigmeta (user_id, name, value, created_date, updated_date) VALUES
    (1, 'NOTIFY_POSTS_LIKE', 'true', '2000-01-01', '2000-01-01'),
    (1, 'NOTIFY_POSTS_COMMENT', 'true', '2000-01-01', '2000-01-01'),
    (1, 'NOTIFY_MENTION', 'true', '2000-01-01', '2000-01-01');
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
      SELECT username FROM auth_user WHERE id = ${id} LIMIT 1
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
  assert.deepEqual(first.json(), { status: 'done', count_likes: 1, has_liked: true });
  const toggles = await Promise.all([
    app.inject({ method: 'POST', url: '/like/public-post', headers: signedIn }),
    app.inject({ method: 'POST', url: '/like/public-post', headers: signedIn }),
  ]);
  assert.deepEqual(toggles.map((response) => response.json()).sort((left, right) => left.count_likes - right.count_likes), [
    { status: 'done', count_likes: 0, has_liked: false },
    { status: 'done', count_likes: 1, has_liked: true },
  ]);
  const rows = await db.$queryRaw<Array<{ count: number | bigint }>>`
    SELECT COUNT(*) AS count FROM board_post_likes WHERE post_id = 1 AND user_id = 2
  `;
  assert.equal(Number(rows[0]?.count), 1);

  assert.equal((await app.inject({ method: 'POST', url: '/like/hidden-post', headers: signedIn })).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: '/like/draft-post', headers: signedIn })).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: '/like/deleted-post', headers: signedIn })).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: '/like/public-post', headers: { 'x-user-id': '2' } })).statusCode, 403);
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
    canEdit: false, canDelete: false, canLike: false, canReply: false,
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
    payload: 'comment_md=Hello%0A%3Cscript%3Ebad()%3C%2Fscript%3E&parent_id=10',
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().status, 'DONE');
  assert.equal(response.json().body.parentId, 10);
  assert.match(response.json().body.renderedContent, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(response.json().body.renderedContent, /<script/);
  const rows = await db.$queryRaw<Array<{ textMd: string; textHtml: string; parentId: number | null }>>`
    SELECT text_md AS textMd, text_html AS textHtml, parent_id AS parentId
    FROM board_comment WHERE author_id = 2 ORDER BY id DESC LIMIT 1
  `;
  assert.equal(rows[0]?.textMd, 'Hello\n<script>bad()</script>');
  assert.equal(rows[0]?.textHtml, '<p>Hello<br>&lt;script&gt;bad()&lt;/script&gt;</p>');
  assert.equal(rows[0]?.parentId, 10);

  const json = await app.inject({
    method: 'POST',
    url: '/v1/comments?url=public-post',
    headers: { ...signedIn, 'content-type': 'application/json' },
    payload: { comment_md: '<em>plain text</em>' },
  });
  assert.match(json.json().body.renderedContent, /&lt;em&gt;plain text&lt;\/em&gt;/);

  const anonymous = await app.inject({
    method: 'POST', url: '/v1/comments?url=public-post',
    headers: { 'x-test-csrf': 'valid', 'content-type': 'application/json' }, payload: { comment_md: 'No user' },
  });
  assert.equal(anonymous.json().errorCode, 'error:AT');
  const crossPostReply = await app.inject({
    method: 'POST', url: '/v1/comments?url=public-post',
    headers: { ...signedIn, 'content-type': 'application/json' }, payload: { comment_md: 'wrong parent', parent_id: '14' },
  });
  assert.equal(crossPostReply.json().errorCode, 'error:RJ');
  const blocked = await app.inject({
    method: 'POST', url: '/v1/comments?url=blocked-comments',
    headers: { ...signedIn, 'content-type': 'application/json' }, payload: { comment_md: 'blocked' },
  });
  assert.equal(blocked.json().errorCode, 'error:RJ');
  assert.equal((await app.inject({
    method: 'POST', url: '/v1/comments?url=hidden-post',
    headers: { ...signedIn, 'content-type': 'application/json' }, payload: { comment_md: 'private' },
  })).statusCode, 404);
  assert.equal((await app.inject({
    method: 'POST', url: '/v1/comments?url=public-post',
    headers: { 'x-user-id': '2', 'content-type': 'application/json' }, payload: { comment_md: 'missing CSRF' },
  })).statusCode, 403);
});

test('gets, edits, likes and soft-deletes comments with owner checks', async () => {
  const editGet = await app.inject({ url: '/v1/comments/11', headers: { 'x-user-id': '2' } });
  assert.deepEqual(editGet.json(), { status: 'DONE', body: { textMd: 'Reader reply' } });
  assert.equal(editGet.headers['cache-control'], 'private, no-store');
  const nonOwner = await app.inject({ url: '/v1/comments/11', headers: { 'x-user-id': '1' } });
  assert.equal(nonOwner.json().errorCode, 'error:AT');
  assert.equal((await app.inject({ url: '/v1/comments/13', headers: { 'x-user-id': '2' } })).statusCode, 404);

  const edit = await app.inject({
    method: 'PUT', url: '/v1/comments/11',
    headers: { ...signedIn, 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'comment=comment&comment_md=first%0A%3Cscript%3Ebad()%3C%2Fscript%3E',
  });
  assert.deepEqual(edit.json(), { status: 'DONE', body: {} });
  const changed = await db.$queryRaw<Array<{ textMd: string; textHtml: string; edited: number | bigint }>>`
    SELECT text_md AS textMd, text_html AS textHtml, CAST(edited AS INTEGER) AS edited
    FROM board_comment WHERE id = 11
  `;
  assert.equal(changed[0]?.textMd, 'first\n<script>bad()</script>');
  assert.equal(changed[0]?.textHtml, '<p>first<br>&lt;script&gt;bad()&lt;/script&gt;</p>');
  assert.equal(Number(changed[0]?.edited), 1);
  const formEdit = await app.inject({ method: 'POST', url: '/v1/comments/11',
    headers: { ...signedIn, 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'action=edit&comment_md=Edited+from+the+article&return_to=%2F%40editor%2Fpublic',
  });
  assert.equal(formEdit.statusCode, 303);
  assert.equal(formEdit.headers.location, '/@editor/public#comment-11');
  assert.equal((await app.inject({ url: '/v1/comments/11', headers: { 'x-user-id': '2' } })).json().body.textMd, 'Edited from the article');

  const like = await app.inject({
    method: 'PUT', url: '/v1/comments/10',
    headers: { ...signedIn, 'content-type': 'application/x-www-form-urlencoded' }, payload: 'like=like',
  });
  assert.deepEqual(like.json().body, { isLiked: true, countLikes: 1 });
  const unlike = await app.inject({
    method: 'PUT', url: '/v1/comments/10',
    headers: { ...signedIn, 'content-type': 'application/x-www-form-urlencoded' }, payload: 'like=like',
  });
  assert.deepEqual(unlike.json().body, { isLiked: false, countLikes: 0 });
  const concurrentLikes = await Promise.all([
    app.inject({
      method: 'PUT', url: '/v1/comments/10',
      headers: { ...signedIn, 'content-type': 'application/x-www-form-urlencoded' }, payload: 'like=like',
    }),
    app.inject({
      method: 'PUT', url: '/v1/comments/10',
      headers: { ...signedIn, 'content-type': 'application/x-www-form-urlencoded' }, payload: 'like=like',
    }),
  ]);
  assert.deepEqual(concurrentLikes.map((response) => response.json().body.countLikes).sort(), [0, 1]);
  const finalLikes = await db.$queryRaw<Array<{ count: number | bigint }>>`
    SELECT COUNT(*) AS count FROM board_comment_likes WHERE comment_id = 10 AND user_id = 2
  `;
  assert.equal(Number(finalLikes[0]?.count), 0);
  const selfLike = await app.inject({
    method: 'PUT', url: '/v1/comments/11',
    headers: { 'x-user-id': '2', 'x-test-csrf': 'valid', 'content-type': 'application/x-www-form-urlencoded' }, payload: 'like=like',
  });
  assert.equal(selfLike.json().errorCode, 'error:AT');
  const anonymousLike = await app.inject({
    method: 'PUT', url: '/v1/comments/10',
    headers: { 'x-test-csrf': 'valid', 'content-type': 'application/x-www-form-urlencoded' }, payload: 'like=like',
  });
  assert.equal(anonymousLike.json().errorCode, 'error:NL');

  const deleted = await app.inject({ method: 'DELETE', url: '/v1/comments/11', headers: signedIn });
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.equal(deleted.json().body.isDeleted, true);
  assert.deepEqual(deleted.json().body.permissions, {
    canEdit: false, canDelete: false, canLike: false, canReply: false,
  });
  const persisted = await db.$queryRaw<Array<{ authorId: number | null }>>`
    SELECT author_id AS authorId FROM board_comment WHERE id = 11
  `;
  assert.equal(persisted[0]?.authorId, null);
  const wrongOwnerDelete = await app.inject({ method: 'DELETE', url: '/v1/comments/10', headers: signedIn });
  assert.equal(wrongOwnerDelete.json().errorCode, 'error:AT');

  const malformedJson = await app.inject({
    method: 'PUT', url: '/v1/comments/10',
    headers: { ...signedIn, 'content-type': 'application/json' }, payload: '[]',
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
    method: 'POST', url: '/v1/users/@writer/subscription',
    headers: { 'x-user-id': '5', 'x-test-csrf': 'valid' },
  });
  assert.equal(unconnected.json().body.suggestTelegramConnection, true);
  const state = await app.inject({ url: '/v1/users/@writer/subscription', headers: { 'x-user-id': '2' } });
  assert.deepEqual(state.json().body, { canSubscribe: true, isSubscribed: true });

  const counts = await db.$queryRaw<Array<{ subscriptions: number | bigint; logs: number | bigint }>>`
    SELECT (SELECT COUNT(*) FROM board_authorsubscription WHERE subscriber_id = 2 AND author_id = 1) AS subscriptions,
           (SELECT COUNT(*) FROM board_authorsubscriptionlog WHERE subscriber_id = 2 AND author_id = 1) AS logs
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
    SELECT action FROM board_authorsubscriptionlog WHERE subscriber_id = 2 AND author_id = 1 ORDER BY id
  `;
  assert.deepEqual(logRows.map((row) => row.action), ['subscribe', 'unsubscribe']);
  assert.equal((await app.inject('/v1/subscriptions')).json().errorCode, 'error:NL');
});

test('rejects self, reader and unknown subscriptions while preserving public state lookup', async () => {
  const self = await app.inject({ method: 'POST', url: '/v1/users/@writer/subscription', headers: { 'x-user-id': '1', 'x-test-csrf': 'valid' } });
  assert.equal(self.json().errorCode, 'error:RJ');
  const reader = await app.inject({ method: 'POST', url: '/v1/users/@reader/subscription', headers: { ...signedIn } });
  assert.equal(reader.json().errorCode, 'error:RJ');
  assert.equal((await app.inject('/v1/users/@inactive/subscription')).json().body.canSubscribe, false);
  assert.equal((await app.inject('/v1/users/@missing/subscription')).statusCode, 404);
  const anonymousPost = await app.inject({ method: 'POST', url: '/v1/users/@writer/subscription', headers: { 'x-test-csrf': 'valid' } });
  assert.equal(anonymousPost.json().errorCode, 'error:NL');
  const noCsrf = await app.inject({ method: 'DELETE', url: '/v1/users/@writer/subscription', headers: { 'x-user-id': '2' } });
  assert.equal(noCsrf.statusCode, 403);
});
