import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { after, beforeEach, test } from 'node:test';
import { readReaderPostView, registerReaderActions } from '../src/features/engagement/index.js';
import { installNotificationTables } from './fixtures/notifications.js';
import { ReaderActions } from '../src/platform/views.js';
import { renderToStaticMarkup } from 'react-dom/server';
import { accountTables, migratedTableSql } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-reader-ui-'));
const databasePath = join(directory, 'synthetic-reader-ui.sqlite3');
const csrfToken = 'r'.repeat(43);

function createSchema() {
  const fixture = new DatabaseSync(databasePath);
  fixture.exec(`
  ${migratedTableSql(...accountTables)}
${migratedTableSql('Series', 'Post', 'PostContent', 'Tag', '_PostToTag', 'PostRevision', 'PostLike', 'PinnedPost', 'PostShareLink', 'PostShareDailyCount')}


    ${migratedTableSql('Comment', 'CommentLike')}
    ${migratedTableSql('AuthorSubscription')}
    ${migratedTableSql('AuthorSubscriptionLog')}

    INSERT INTO "User" ("id", "username", "name", "isActive", "email", "passwordHash", "joinedAt") VALUES
    (1, 'writer', 'Writer', 1, '', '', 1577836800000),
    (2, 'reader', 'Reader', 1, '', '', 1577836800000),
    (3, 'inactive', 'Inactive', 0, '', '', 1577836800000);
    INSERT INTO "Profile" ("userId", "bio", "avatar", "cover", "homepage", "role") VALUES
    (1, 'Author bio', 'avatars/writer.png', 'covers/writer.png', 'javascript:alert(1)', 'EDITOR'),
    (2, 'Reader bio', '', '', '', 'READER'),
    (3, '', '', '', '', 'EDITOR');
    INSERT INTO "Post" ("id", "title", "slug", "authorId", "publishedAt", "deletedAt", "createdAt", "updatedAt") VALUES
    (1, 'Public post', 'public-post', 1, 1767225600000, NULL, 946684800000, 946684800000);
    UPDATE "Post" SET isHidden = 0, commentsBlocked = 0 WHERE id = 1;
    INSERT INTO "PostLike" ("createdAt", "postId", "userId") VALUES
    (1767225600000, 1, 2);
    INSERT INTO "Comment" ("id", "markdown", "html", "isEdited", "isHearted", "createdAt", "authorId", "postId", "parentId") VALUES
    (10, 'Parent', '<p>Parent <strong>comment</strong></p><script>unsafe()</script>', 0, 0, 1767312000000, 1, 1, NULL),
    (11, 'Reply', '<p>Reader reply</p>', 1, 0, 1767398400000, 2, 1, 10),
    (12, 'Deleted', '<p>Ignore deleted body</p>', 0, 0, 1767484800000, NULL, 1, NULL);
    INSERT INTO "CommentLike" ("commentId", "userId") VALUES
    (10, 2);
    INSERT INTO "SocialLink" ("id", "platform", "url", "createdAt", "updatedAt", "userId", "order") VALUES
    (1, 'github', 'https://github.com/writer', 1767225600000, 1767225600000, 1, 1),
    (2, 'unsafe', 'javascript:alert(1)', 1767225600000, 1767225600000, 1, 2);
    INSERT INTO "AuthorSubscription" ("id", "createdAt", "authorId", "subscriberId") VALUES
    (1, 1767225600000, 1, 2);
  `);
  installNotificationTables(fixture);
  fixture.close();
}

function seed() {
  const fixture = new DatabaseSync(databasePath);
  fixture.exec(`
    DELETE FROM "AuthorSubscriptionLog";
    DELETE FROM "AuthorSubscription";
    DELETE FROM "SocialLink";
    DELETE FROM "CommentLike";
    DELETE FROM "Comment";
    DELETE FROM "PostLike";
    
    DELETE FROM "Post";
    DELETE FROM "Profile";
    DELETE FROM "User";
    INSERT INTO "User" ("id", "username", "name", "isActive", "email", "passwordHash", "joinedAt") VALUES
    (1, 'writer', 'Writer', 1, '', '', 1577836800000),
    (2, 'reader', 'Reader', 1, '', '', 1577836800000),
    (3, 'inactive', 'Inactive', 0, '', '', 1577836800000);
    INSERT INTO "Profile" ("userId", "bio", "avatar", "cover", "homepage", "role") VALUES
    (1, 'Author bio', 'avatars/writer.png', 'covers/writer.png', 'javascript:alert(1)', 'EDITOR'),
    (2, 'Reader bio', '', '', '', 'READER'),
    (3, '', '', '', '', 'EDITOR');
    INSERT INTO "Post" ("id", "title", "slug", "authorId", "publishedAt", "deletedAt", "createdAt", "updatedAt") VALUES
    (1, 'Public post', 'public-post', 1, 1767225600000, NULL, 946684800000, 946684800000);
    UPDATE "Post" SET isHidden = 0, commentsBlocked = 0 WHERE id = 1;
    INSERT INTO "PostLike" ("createdAt", "postId", "userId") VALUES
    (1767225600000, 1, 2);
    INSERT INTO "Comment" ("id", "markdown", "html", "isEdited", "isHearted", "createdAt", "authorId", "postId", "parentId") VALUES
    (10, 'Parent', '<p>Parent <strong>comment</strong></p><script>unsafe()</script>', 0, 0, 1767312000000, 1, 1, NULL),
    (11, 'Reply', '<p>Reader reply</p>', 1, 0, 1767398400000, 2, 1, 10),
    (12, 'Deleted', '<p>Ignore deleted body</p>', 0, 0, 1767484800000, NULL, 1, NULL);
    INSERT INTO "CommentLike" ("commentId", "userId") VALUES
    (10, 2);
    INSERT INTO "SocialLink" ("id", "platform", "url", "createdAt", "updatedAt", "userId", "order") VALUES
    (1, 'github', 'https://github.com/writer', 1767225600000, 1767225600000, 1, 1),
    (2, 'unsafe', 'javascript:alert(1)', 1767225600000, 1767225600000, 1, 2);
    INSERT INTO "AuthorSubscription" ("id", "createdAt", "authorId", "subscriberId") VALUES
    (1, 1767225600000, 1, 2);
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
    const [user] = await db.$queryRaw<Array<{ username: string }>>`SELECT username FROM "User" WHERE id = ${id} LIMIT 1`;
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
  assert.match(anonymousHtml, /data-blex-login-prompt="subscribe"[^>]*>구독<\/a>/);
  assert.match(anonymousHtml, /data-blex-login-prompt="like"[^>]*>좋아요 · /);
  assert.match(anonymousHtml, /data-blex-login-prompt="comment"/);
  assert.match(anonymousHtml, /로그인하고 댓글 작성/);
  assert.doesNotMatch(anonymousHtml, /로그인하고 (구독|좋아요|답글)|action%3D/);
  assert.match(anonymousHtml, /Parent <strong>comment<\/strong>/);
  assert.doesNotMatch(anonymousHtml, /<script|unsafe\(\)/);

  const signedInView = await readReaderPostView(db, 'public-post', 2);
  assert.ok(signedInView);
  const signedInHtml = renderToStaticMarkup(ReaderActions({ view: signedInView, csrfToken }));
  assert.match(signedInHtml, /action="\/like\/public-post"/);
  assert.match(signedInHtml, /action="\/v1\/users\/@writer\/subscription"/);
  assert.match(signedInHtml, /action="\/v1\/comments\?url=public-post"/);
  assert.match(signedInHtml, /name="csrfmiddlewaretoken" value="rrrr/);
  assert.match(signedInHtml, /aria-pressed="true">구독 중<\/button>/);
  assert.match(signedInHtml, />댓글 작성<\/button>/);
  assert.match(signedInHtml, /aria-label="댓글 옵션 열기"/);
  assert.doesNotMatch(signedInHtml, /name="parentId" value="11"/);
});

test('handles SSR form actions with local redirects for likes, comments and subscriptions', async () => {
  const like = await app.inject({
    method: 'POST', url: '/like/public-post', headers: signedInHeaders,
    payload: form([['csrfmiddlewaretoken', csrfToken], ['returnTo', '/@writer/public-post#post-comments']]),
  });
  assert.equal(like.statusCode, 303);
  assert.equal(like.headers.location, '/@writer/public-post#post-comments');
  const [postLike] = await db.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM "PostLike" WHERE postId = 1 AND userId = 2`;
  assert.equal(Number(postLike?.count), 0);

  const commentLike = await app.inject({
    method: 'POST', url: '/v1/comments/10', headers: signedInHeaders,
    payload: form([['csrfmiddlewaretoken', csrfToken], ['like', 'like'], ['returnTo', '/@writer/public-post#comment-10']]),
  });
  assert.equal(commentLike.statusCode, 303);
  assert.equal(commentLike.headers.location, '/@writer/public-post#comment-10');

  const comment = await app.inject({
    method: 'POST', url: '/v1/comments?url=public-post', headers: signedInHeaders,
    payload: form([['csrfmiddlewaretoken', csrfToken], ['commentMd', 'New comment'], ['returnTo', '/@writer/public-post#post-comments']]),
  });
  assert.equal(comment.statusCode, 303);
  assert.match(comment.headers.location ?? '', /^\/@writer\/public-post#comment-\d+$/);

  const unsubscribe = await app.inject({
    method: 'POST', url: '/v1/users/@writer/subscription', headers: signedInHeaders,
    payload: form([['csrfmiddlewaretoken', csrfToken], ['action', 'unsubscribe'], ['returnTo', '/@writer/public-post']]),
  });
  assert.equal(unsubscribe.statusCode, 303);
  assert.equal(unsubscribe.headers.location, '/@writer/public-post');
  const [subscription] = await db.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM "AuthorSubscription" WHERE subscriberId = 2 AND authorId = 1`;
  assert.equal(Number(subscription?.count), 0);
});

test('rejects open redirects from enhanced form fields and keeps legacy API envelopes', async () => {
  const response = await app.inject({
    method: 'POST', url: '/like/public-post', headers: signedInHeaders,
    payload: form([['csrfmiddlewaretoken', csrfToken], ['returnTo', '//evil.example/path']]),
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'done', countLikes: 0, hasLiked: false });
});
