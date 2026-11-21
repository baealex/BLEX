import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { after, beforeEach, test } from 'node:test';
import { readReaderPostView, registerReaderActions } from '../src/reader-actions/index.js';
import { installNotificationTables } from './fixtures/notifications.js';
import { ReaderActions } from '../src/reader-ui/index.js';
import { renderToStaticMarkup } from 'react-dom/server';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-reader-ui-'));
const databasePath = join(directory, 'synthetic-reader-ui.sqlite3');
const csrfToken = 'r'.repeat(43);

function createSchema() {
  const fixture = new DatabaseSync(databasePath);
  fixture.exec(`
    CREATE TABLE auth_user (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, first_name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT 1
    );
    CREATE TABLE board_profile (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE, bio TEXT NOT NULL DEFAULT '',
      avatar TEXT NOT NULL DEFAULT '', cover TEXT NOT NULL DEFAULT '', homepage TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'READER'
    );
    CREATE TABLE board_post (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL UNIQUE, author_id INTEGER NOT NULL,
      published_date DATETIME, deleted_date DATETIME
    );
    CREATE TABLE board_postconfig (
      id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL UNIQUE, hide BOOLEAN NOT NULL DEFAULT 0,
      block_comment BOOLEAN NOT NULL DEFAULT 0
    );
    CREATE TABLE board_post_likes (
      id INTEGER PRIMARY KEY, created_date DATETIME NOT NULL, post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL, UNIQUE(post_id, user_id)
    );
    CREATE TABLE board_comment (
      id INTEGER PRIMARY KEY, text_md TEXT NOT NULL, text_html TEXT NOT NULL, edited BOOLEAN NOT NULL DEFAULT 0,
      heart BOOLEAN NOT NULL DEFAULT 0, created_date DATETIME NOT NULL, author_id INTEGER,
      post_id INTEGER NOT NULL, parent_id INTEGER
    );
    CREATE TABLE board_comment_likes (
      id INTEGER PRIMARY KEY, comment_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
      UNIQUE(comment_id, user_id)
    );
    CREATE TABLE board_userlinkmeta (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, value TEXT NOT NULL,
      created_date DATETIME NOT NULL, updated_date DATETIME NOT NULL, user_id INTEGER NOT NULL, "order" INTEGER NOT NULL
    );
    CREATE TABLE board_authorsubscription (
      id INTEGER PRIMARY KEY, created_date DATETIME NOT NULL, author_id INTEGER NOT NULL,
      subscriber_id INTEGER NOT NULL, UNIQUE(subscriber_id, author_id)
    );
    CREATE TABLE board_authorsubscriptionlog (
      id INTEGER PRIMARY KEY, action TEXT NOT NULL, created_date DATETIME NOT NULL,
      author_id INTEGER NOT NULL, subscriber_id INTEGER NOT NULL
    );

    INSERT INTO auth_user VALUES (1, 'writer', 'Writer', 1), (2, 'reader', 'Reader', 1), (3, 'inactive', 'Inactive', 0);
    INSERT INTO board_profile VALUES
      (1, 1, 'Author bio', 'avatars/writer.png', 'covers/writer.png', 'javascript:alert(1)', 'EDITOR'),
      (2, 2, 'Reader bio', '', '', '', 'READER'),
      (3, 3, '', '', '', '', 'EDITOR');
    INSERT INTO board_post VALUES (1, 'Public post', 'public-post', 1, '2026-01-01 00:00:00', NULL);
    INSERT INTO board_postconfig VALUES (1, 1, 0, 0);
    INSERT INTO board_post_likes VALUES (1, '2026-01-01 00:00:00', 1, 2);
    INSERT INTO board_comment VALUES
      (10, 'Parent', '<p>Parent <strong>comment</strong></p><script>unsafe()</script>', 0, 0, '2026-01-02 00:00:00', 1, 1, NULL),
      (11, 'Reply', '<p>Reader reply</p>', 1, 0, '2026-01-03 00:00:00', 2, 1, 10),
      (12, 'Deleted', '<p>Ignore deleted body</p>', 0, 0, '2026-01-04 00:00:00', NULL, 1, NULL);
    INSERT INTO board_comment_likes VALUES (1, 10, 2);
    INSERT INTO board_userlinkmeta VALUES
      (1, 'github', 'https://github.com/writer', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 1, 1),
      (2, 'unsafe', 'javascript:alert(1)', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 1, 2);
    INSERT INTO board_authorsubscription VALUES (1, '2026-01-01 00:00:00', 1, 2);
  `);
  installNotificationTables(fixture);
  fixture.close();
}

function seed() {
  const fixture = new DatabaseSync(databasePath);
  fixture.exec(`
    DELETE FROM board_authorsubscriptionlog;
    DELETE FROM board_authorsubscription;
    DELETE FROM board_userlinkmeta;
    DELETE FROM board_comment_likes;
    DELETE FROM board_comment;
    DELETE FROM board_post_likes;
    DELETE FROM board_postconfig;
    DELETE FROM board_post;
    DELETE FROM board_profile;
    DELETE FROM auth_user;
    INSERT INTO auth_user VALUES (1, 'writer', 'Writer', 1), (2, 'reader', 'Reader', 1), (3, 'inactive', 'Inactive', 0);
    INSERT INTO board_profile VALUES
      (1, 1, 'Author bio', 'avatars/writer.png', 'covers/writer.png', 'javascript:alert(1)', 'EDITOR'),
      (2, 2, 'Reader bio', '', '', '', 'READER'),
      (3, 3, '', '', '', '', 'EDITOR');
    INSERT INTO board_post VALUES (1, 'Public post', 'public-post', 1, '2026-01-01 00:00:00', NULL);
    INSERT INTO board_postconfig VALUES (1, 1, 0, 0);
    INSERT INTO board_post_likes VALUES (1, '2026-01-01 00:00:00', 1, 2);
    INSERT INTO board_comment VALUES
      (10, 'Parent', '<p>Parent <strong>comment</strong></p><script>unsafe()</script>', 0, 0, '2026-01-02 00:00:00', 1, 1, NULL),
      (11, 'Reply', '<p>Reader reply</p>', 1, 0, '2026-01-03 00:00:00', 2, 1, 10),
      (12, 'Deleted', '<p>Ignore deleted body</p>', 0, 0, '2026-01-04 00:00:00', NULL, 1, NULL);
    INSERT INTO board_comment_likes VALUES (1, 10, 2);
    INSERT INTO board_userlinkmeta VALUES
      (1, 'github', 'https://github.com/writer', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 1, 1),
      (2, 'unsafe', 'javascript:alert(1)', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 1, 2);
    INSERT INTO board_authorsubscription VALUES (1, '2026-01-01 00:00:00', 1, 2);
  `);
  fixture.close();
}

createSchema();
const db = new PrismaClient({ datasourceUrl: `file:${databasePath}?connection_limit=1` });
const app = Fastify();
registerReaderActions(app, db, {
  currentUser: async (request) => {
    const value = request.headers['x-user-id'];
    const id = typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isSafeInteger(id) || id < 1) return null;
    const [user] = await db.$queryRaw<Array<{ username: string }>>`SELECT username FROM auth_user WHERE id = ${id} LIMIT 1`;
    return user ? { id, username: user.username } : null;
  },
  validateCsrf: (request) => {
    const body = request.body as Record<string, unknown> | undefined;
    return request.headers['x-test-csrf'] === 'valid' || body?.csrfmiddlewaretoken === csrfToken;
  },
});
await app.ready();

after(async () => {
  await app.close();
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

beforeEach(seed);

function form(fields: Array<[string, string]>) {
  return new URLSearchParams(fields).toString();
}

const signedInHeaders = {
  'x-user-id': '2',
  'x-test-csrf': 'valid',
  'content-type': 'application/x-www-form-urlencoded',
};

test('loads a safe reader view with comments, post likes and author subscription state', async () => {
  const anonymous = await readReaderPostView(db, 'public-post', null);
  assert.ok(anonymous);
  assert.equal(anonymous.viewerAuthenticated, false);
  assert.deepEqual(anonymous.postLike, { countLikes: 1, isLiked: false, canLike: false });
  assert.equal(anonymous.author.username, 'writer');
  assert.equal(anonymous.author.avatar, '/resources/media/avatars/writer.png');
  assert.equal(anonymous.author.cover, '/resources/media/covers/writer.png');
  assert.equal(anonymous.author.homepage, '');
  assert.deepEqual(anonymous.author.social.map((link) => link.name), ['github']);
  assert.deepEqual({ canSubscribe: anonymous.author.canSubscribe, isSubscribed: anonymous.author.isSubscribed }, {
    canSubscribe: true, isSubscribed: false,
  });
  assert.equal(anonymous.canComment, true);
  assert.equal(anonymous.comments.length, 2);
  assert.equal(anonymous.comments[0]?.replies?.[0]?.isMine, false);
  assert.doesNotMatch(anonymous.comments[0]?.renderedContent ?? '', /<script|unsafe/);

  const signedIn = await readReaderPostView(db, 'public-post', 2);
  assert.ok(signedIn);
  assert.equal(signedIn.viewerAuthenticated, true);
  assert.deepEqual(signedIn.postLike, { countLikes: 1, isLiked: true, canLike: true });
  assert.deepEqual({ canSubscribe: signedIn.author.canSubscribe, isSubscribed: signedIn.author.isSubscribed }, {
    canSubscribe: true, isSubscribed: true,
  });
  assert.equal(signedIn.comments[0]?.permissions.canLike, true);
  assert.equal(signedIn.comments[0]?.replies?.[0]?.permissions.canDelete, true);
  assert.equal(await readReaderPostView(db, 'missing', 2), null);
});

test('renders accessible SSR author, like, comment and subscription controls', async () => {
  const anonymousView = await readReaderPostView(db, 'public-post', null);
  assert.ok(anonymousView);
  const anonymousHtml = renderToStaticMarkup(ReaderActions({ view: anonymousView, csrfToken }));
  assert.match(anonymousHtml, /aria-label="writer 작성자 정보"/);
  assert.match(anonymousHtml, /로그인하고 구독/);
  assert.match(anonymousHtml, /로그인하고 좋아요/);
  assert.match(anonymousHtml, /로그인하고 댓글 남기기/);
  assert.match(anonymousHtml, /Parent <strong>comment<\/strong>/);
  assert.doesNotMatch(anonymousHtml, /<script|unsafe\(\)/);

  const signedInView = await readReaderPostView(db, 'public-post', 2);
  assert.ok(signedInView);
  const signedInHtml = renderToStaticMarkup(ReaderActions({ view: signedInView, csrfToken }));
  assert.match(signedInHtml, /action="\/like\/public-post"/);
  assert.match(signedInHtml, /action="\/v1\/users\/@writer\/subscription"/);
  assert.match(signedInHtml, /action="\/v1\/comments\?url=public-post"/);
  assert.match(signedInHtml, /name="csrfmiddlewaretoken" value="rrrr/);
  assert.match(signedInHtml, /구독 중 · 취소/);
  assert.match(signedInHtml, /댓글 등록/);
  assert.match(signedInHtml, /name="action" value="delete"/);
  assert.doesNotMatch(signedInHtml, /name="parent_id" value="11"/);
});

test('handles SSR form actions with local redirects for likes, comments and subscriptions', async () => {
  const like = await app.inject({
    method: 'POST', url: '/like/public-post', headers: signedInHeaders,
    payload: form([['csrfmiddlewaretoken', csrfToken], ['return_to', '/@writer/public-post#post-comments']]),
  });
  assert.equal(like.statusCode, 303);
  assert.equal(like.headers.location, '/@writer/public-post#post-comments');
  const [postLike] = await db.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM board_post_likes WHERE post_id = 1 AND user_id = 2`;
  assert.equal(Number(postLike?.count), 0);

  const commentLike = await app.inject({
    method: 'POST', url: '/v1/comments/10', headers: signedInHeaders,
    payload: form([['csrfmiddlewaretoken', csrfToken], ['like', 'like'], ['return_to', '/@writer/public-post#comment-10']]),
  });
  assert.equal(commentLike.statusCode, 303);
  assert.equal(commentLike.headers.location, '/@writer/public-post#comment-10');

  const comment = await app.inject({
    method: 'POST', url: '/v1/comments?url=public-post', headers: signedInHeaders,
    payload: form([['csrfmiddlewaretoken', csrfToken], ['comment_md', 'New comment'], ['return_to', '/@writer/public-post#post-comments']]),
  });
  assert.equal(comment.statusCode, 303);
  assert.match(comment.headers.location ?? '', /^\/@writer\/public-post#comment-\d+$/);

  const unsubscribe = await app.inject({
    method: 'POST', url: '/v1/users/@writer/subscription', headers: signedInHeaders,
    payload: form([['csrfmiddlewaretoken', csrfToken], ['action', 'unsubscribe'], ['return_to', '/@writer/public-post']]),
  });
  assert.equal(unsubscribe.statusCode, 303);
  assert.equal(unsubscribe.headers.location, '/@writer/public-post');
  const [subscription] = await db.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM board_authorsubscription WHERE subscriber_id = 2 AND author_id = 1`;
  assert.equal(Number(subscription?.count), 0);
});

test('rejects open redirects from enhanced form fields and keeps legacy API envelopes', async () => {
  const response = await app.inject({
    method: 'POST', url: '/like/public-post', headers: signedInHeaders,
    payload: form([['csrfmiddlewaretoken', csrfToken], ['return_to', '//evil.example/path']]),
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'done', count_likes: 0, has_liked: false });
});
