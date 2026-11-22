import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import test from 'node:test';
import {
  PostValidationError,
  registerAuthoring,
  updateAuthorPost,
} from '../src/features/posts/authoring/index.js';
import { markdownToHtml } from '../src/features/posts/authoring/markdown.js';
import { createMigratedTables, migratedTableSql, prismaDate } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-authoring-'));
const databasePath = join(directory, 'Django authoring.sqlite3');
const database = new DatabaseSync(databasePath);
createMigratedTables(database, 'FormTemplate', 'StaticPage', 'SiteBanner', 'UploadedImage', 'IntegrationSetting', 'SiteSetting',
  'Notification', 'NotificationDelivery', 'TelegramConnection', 'WebhookChannel', 'WebhookDelivery');
const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');
database.exec(`
  CREATE TABLE auth_user (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT 1,
    is_staff BOOLEAN NOT NULL DEFAULT 0
  );
  CREATE TABLE board_profile (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    avatar TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'READER',
    bio TEXT NOT NULL DEFAULT '',
    homepage TEXT NOT NULL DEFAULT ''
  );
  ${migratedTableSql('Series')}
${migratedTableSql('Post', 'PostContent', 'Tag', '_PostToTag', 'PostRevision', 'PostLike', 'PinnedPost', 'PostShareLink', 'PostShareDailyCount', 'ScheduledPublication')}






  ${migratedTableSql('Comment', 'CommentLike')}
  ${migratedTableSql('AuthorSubscription')}
  CREATE TABLE board_userconfigmeta (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    created_date DATETIME NOT NULL,
    updated_date DATETIME NOT NULL
  );

  CREATE TABLE board_usernamechangelog (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    created_date DATETIME NOT NULL,
    user_id INTEGER NOT NULL
  );



  INSERT INTO auth_user (id, username, first_name, is_active) VALUES (1, 'writer', 'Writer', 1), (2, 'other-writer', 'Other Writer', 1),
    (3, 'reader', 'Reader', 1), (4, 'inactive', 'Inactive', 0);
  INSERT INTO board_profile (id, user_id, avatar, role) VALUES (1, 1, 'writer.png', 'EDITOR'), (2, 2, '', 'EDITOR'),
    (3, 3, '', 'READER'), (4, 4, '', 'EDITOR');
  INSERT INTO "Series" ("id", "order", "descriptionMarkdown", "descriptionHtml", "isHidden", "slug", "layout", "createdAt", "updatedAt", "ownerId", "name") VALUES
    (1, 1, '', '', 0, 'learning', '', ${prismaDate(now)}, ${prismaDate(now)}, 1, 'Learning'),
    (2, 1, '', '', 0, 'other-series', '', ${prismaDate(now)}, ${prismaDate(now)}, 2, 'Other series');
  INSERT INTO FormTemplate (id, title, content, isPublic, createdAt, updatedAt, userId) VALUES
    (1, 'Short form', '# Template body', 0, ${Date.now()}, ${Date.now()}, 1),
    (2, 'Another writer form', 'Private form body', 0, ${Date.now()}, ${Date.now()}, 2);
  INSERT INTO UploadedImage (id, key, path, size, userId) VALUES
    (1, 'cover-hash', 'images/content/2026/11/21/cover-test.jpg', 12, 1);
  INSERT INTO "Post" ("id", "title", "subtitle", "slug", "image", "imageHash", "readTime", "createdAt", "updatedAt", "authorId", "seriesId", "description", "publishedAt", "deletedAt") VALUES
    (1, 'Existing', 'Existing subtitle', 'existing', '', '', 2, ${prismaDate(now)}, ${prismaDate(now)}, 1, 1, 'Existing description', ${prismaDate(now)}, NULL),
    (2, 'Draft note', '', 'draft-note', '', '', 1, ${prismaDate(now)}, ${prismaDate(now)}, 1, 1, '', NULL, NULL),
    (3, 'Scheduled', '', 'scheduled', '', '', 1, ${prismaDate(now)}, ${prismaDate(now)}, 1, NULL, '', 4070908800000, NULL),
    (4, 'Hidden', '', 'hidden-post', '', '', 1, ${prismaDate(now)}, ${prismaDate(now)}, 1, NULL, '', ${prismaDate(now)}, NULL),
    (5, 'Elapsed schedule', '', 'trashed-schedule', '', '', 1, ${prismaDate(now)}, ${prismaDate(now)}, 1, NULL, '', ${prismaDate(oneHourAgo)}, ${prismaDate(twoHoursAgo)});
  INSERT INTO "PostContent" ("postId", "html") VALUES
    (1, '<h2>Existing content</h2><p>Do not lose this.</p>'),
    (2, '<p>Draft starts here.</p>'),
    (3, '<p>Scheduled content.</p>'),
    (4, '<p>Hidden content.</p>'),
    (5, '<p>Elapsed schedule content.</p>');
  INSERT INTO "PostRevision" (id, postId, actorId, restoredFromId, title, subtitle, content, contentExcerpt, description, tags, sourceUpdatedAt, type, createdAt) VALUES
    (1, 1, 1, NULL, 'Old version', 'Old subtitle', '<p>Old body</p>', 'Old body', 'Old description', '["oldtag"]', ${prismaDate('2020-01-02 03:04:05.123456')}, 'edit', ${prismaDate('2020-01-02 03:04:05.123456')}),
    (2, 1, NULL, NULL, '_NO_CHANGED_', '', '_NO_CHANGED_', '', '', '[]', NULL, 'legacy', ${prismaDate('2021-01-02 03:04:05.000000')});
  UPDATE "Post" SET isHidden = 0, isAdvertised = 0, commentsBlocked = 1, coverLayout = 'split', coverImagePosition = 'left', coverImageRatio = '4:3' WHERE id = 1;
    UPDATE "Post" SET isHidden = 0, isAdvertised = 0, commentsBlocked = 0, coverLayout = 'default', coverImagePosition = 'right', coverImageRatio = 'auto' WHERE id = 2;
    UPDATE "Post" SET isHidden = 0, isAdvertised = 0, commentsBlocked = 0, coverLayout = 'default', coverImagePosition = 'right', coverImageRatio = 'auto' WHERE id = 3;
    UPDATE "Post" SET isHidden = 1, isAdvertised = 0, commentsBlocked = 0, coverLayout = 'default', coverImagePosition = 'right', coverImageRatio = 'auto' WHERE id = 4;
    UPDATE "Post" SET isHidden = 1, isAdvertised = 0, commentsBlocked = 0, coverLayout = 'default', coverImagePosition = 'right', coverImageRatio = 'auto' WHERE id = 5;
  INSERT INTO "Tag" ("id", "name") VALUES
    (1, 'legacy-tag');
  INSERT INTO "_PostToTag" ("A", "B") VALUES
    (1, 1);
  INSERT INTO "PostLike" ("createdAt", "postId", "userId") VALUES
    (${prismaDate(now)}, 1, 3);
  INSERT INTO "Comment" ("id", "markdown", "html", "isEdited", "isHearted", "createdAt", "authorId", "postId", "parentId") VALUES
    (1, 'hello', '<p>hello</p>', 0, 0, ${prismaDate(now)}, 3, 1, NULL);
  INSERT INTO "AuthorSubscription" ("id", "subscriberId", "authorId", "createdAt") VALUES
    (1, 3, 1, ${prismaDate(now)});
  INSERT INTO "ScheduledPublication" VALUES (3, '2099-01-01 00:00:00.000000');
`);
database.close();

const db = new PrismaClient({ datasourceUrl: `file:${databasePath}?connection_limit=1` });
const app = Fastify();
registerAuthoring(app, db, {
  siteUrl: new URL('https://blog.example'),
  currentUser: async (request) => {
    const rawId = request.headers['x-user-id'];
    const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
    if (!Number.isSafeInteger(id) || id < 1) return null;
    const rows = await db.$queryRaw<Array<{ username: string }>>`
      SELECT username FROM auth_user WHERE id = ${id} LIMIT 1
    `;
    return rows[0] ? { id, username: rows[0].username } : null;
  },
  validateCsrf: (request) => request.headers['x-test-csrf'] === 'good',
});
await app.ready();

test.after(async () => {
  await app.close();
  await db.$disconnect();
  await rm(directory, { recursive: true });
});

const writerHeaders = { 'x-user-id': '1', 'x-test-csrf': 'good', cookie: 'csrftoken=good' };

test('renders only same-site uploaded MP4 and WebM links as video embeds', () => {
  const mp4 = markdownToHtml('![A short clip](/resources/media/images/content/2026/11/21/clip.mp4)');
  assert.match(mp4, /<video[^>]*controls[^>]*>/);
  assert.match(mp4, /<source src="\/resources\/media\/images\/content\/2026\/11\/21\/clip\.mp4" type="video\/mp4"/);
  assert.match(mp4, /<figcaption>A short clip<\/figcaption>/);
  assert.doesNotMatch(mp4, /<p><\/p>/);
  const webm = markdownToHtml('![](\/resources\/media\/images\/content\/2026\/11\/21\/clip.webm)');
  assert.match(webm, /type="video\/webm"/);
  assert.doesNotMatch(markdownToHtml('![remote](https://media.example/clip.mp4)'), /<video/);
  assert.doesNotMatch(markdownToHtml('![traversal](/resources/media/%2e%2e/private/clip.mp4)'), /<video/);
});

test('gates editor URLs, rejects a bad cover without saving, and serves draft-only previews', async () => {
  const unauthorized = await app.inject({ url: '/write', headers: { 'x-user-id': '3' } });
  assert.equal(unauthorized.statusCode, 302);
  assert.equal(unauthorized.headers.location, '/');
  const anonymous = await app.inject('/write');
  assert.equal(anonymous.statusCode, 302);
  assert.equal(anonymous.headers.location, '/login');

  assert.equal((await app.inject({ url: '/@writer/existing/edit', headers: { 'x-user-id': '2' } })).statusCode, 404);

  const editFields = {
    title: 'Existing', url: 'existing', subtitle: 'Existing subtitle',
    metaDescription: 'Existing description', contentHtml: '<h2>Existing content</h2><p>Do not lose this.</p>',
    coverLayout: 'split', coverImagePosition: 'left', coverImageRatio: '4:3', blockComment: 'false',
  };
  const boundary = 'blexboundary';
  const editHeaders = { ...writerHeaders, 'content-type': `multipart/form-data; boundary=${boundary}` };
  const editorForm = (fields: Record<string, string>) => `${Object.entries(fields)
    .map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`).join('')}--${boundary}--\r\n`;
  const metadataEdit = await app.inject({
    method: 'POST', url: '/v1/users/@writer/posts/existing', headers: editHeaders,
    payload: editorForm({ ...editFields, coverImageUrl: '/resources/media/images/content/2026/11/21/cover-test.jpg' }),
  });
  assert.equal(metadataEdit.json().status, 'DONE', metadataEdit.body);
  const unchangedBody = await db.$queryRaw<Array<{ html: string }>>`
    SELECT html FROM "PostContent" WHERE postId = 1
  `;
  assert.equal(unchangedBody[0]?.html, '<h2>Existing content</h2><p>Do not lose this.</p>');
  const selectedCover = await db.$queryRaw<Array<{ image: string }>>`
    SELECT image FROM "Post" WHERE id = 1
  `;
  assert.equal(selectedCover[0]?.image, 'images/content/2026/11/21/cover-test.jpg');

  const rejectedCover = await app.inject({
    method: 'POST', url: '/v1/users/@writer/posts/existing', headers: editHeaders,
    payload: editorForm({ ...editFields, title: 'Must not save', coverImageUrl: 'https://external.example/cover.jpg' }),
  });
  assert.deepEqual([rejectedCover.statusCode, rejectedCover.json().status], [200, 'ERROR']);
  const afterRejectedCover = await db.$queryRaw<Array<{ title: string; image: string }>>`SELECT title, image FROM "Post" WHERE id = 1`;
  assert.deepEqual(afterRejectedCover[0], { title: 'Existing', image: 'images/content/2026/11/21/cover-test.jpg' });
  const removeCover = await app.inject({
    method: 'POST', url: '/v1/users/@writer/posts/existing', headers: editHeaders,
    payload: editorForm({ ...editFields, removeCoverImage: 'on' }),
  });
  assert.equal(removeCover.json().status, 'DONE', removeCover.body);
  const removedCover = await db.$queryRaw<Array<{ image: string }>>`SELECT image FROM "Post" WHERE id = 1`;
  assert.equal(removedCover[0]?.image, '');

  const preview = await app.inject({ url: '/write/preview/draft-note', headers: writerHeaders });
  assert.equal(preview.statusCode, 200, preview.body);
  assert.match(preview.body, /Draft starts here/);
  assert.match(preview.body, /noindex,nofollow/);
  assert.match(preview.body, /data-site-header/);
  assert.match(preview.body, /임시 포스트 미리보기/);
  assert.equal((await app.inject({ url: '/write/preview/scheduled', headers: writerHeaders })).statusCode, 404);
  assert.equal((await app.inject({ url: '/write/preview/draft-note', headers: { 'x-user-id': '2' } })).statusCode, 404);

});

test('creates a published Markdown post atomically with config, content, tags and series', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/posts',
    headers: { ...writerHeaders, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({
      title: 'Markdown launch',
      url: 'hello-world',
      subtitle: 'A small subtitle',
      metaDescription: 'A saved description',
      textMd: '# Hello\n\nThis is **bold**.\n\n<script>bad()</script>',
      contentType: 'markdown',
      tag: 'TypeScript, Python',
      series: 'learning',
      blockComment: 'false',
      coverLayout: 'split',
      coverImagePosition: 'left',
      coverImageRatio: '4:3',
    }).toString(),
  });
  assert.deepEqual(response.json(), { status: 'DONE', body: { url: 'hello-world' } });

  const post = await db.$queryRaw<Array<{ id: number; publishedDate: string; seriesId: number; title: string; readTime: number }>>`
    SELECT id, publishedAt AS publishedDate, seriesId, title, readTime
    FROM "Post" WHERE slug = 'hello-world'
  `;
  assert.equal(post[0]?.title, 'Markdown launch');
  assert.ok(post[0]?.publishedDate);
  assert.equal(post[0]?.seriesId, 1);
  assert.equal(post[0]?.readTime, 1);
  const content = await db.$queryRaw<Array<{ html: string }>>`
    SELECT html FROM "PostContent" WHERE postId = ${post[0]!.id}
  `;
  assert.match(content[0]!.html, /<h1>Hello<\/h1>/);
  assert.match(content[0]!.html, /<strong>bold<\/strong>/);
  assert.doesNotMatch(content[0]!.html, /<script/i);
  assert.match(content[0]!.html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  const config = await db.$queryRaw<Array<{ hide: number | bigint; coverLayout: string; blockComment: number | bigint }>>`
    SELECT CAST(isHidden AS INTEGER) AS hide, coverLayout, CAST(commentsBlocked AS INTEGER) AS blockComment
    FROM "Post" WHERE id = ${post[0]!.id}
  `;
  assert.equal(Number(config[0]?.hide), 0);
  assert.equal(config[0]?.coverLayout, 'split');
  assert.equal(Number(config[0]?.blockComment), 0);
  const tags = await db.$queryRaw<Array<{ value: string }>>`
    SELECT tag.name AS value FROM "Tag" AS tag JOIN "_PostToTag" AS link ON link.B = tag.id WHERE link.A = ${post[0]!.id} ORDER BY tag.name
  `;
  assert.deepEqual(tags.map((tag) => tag.value), ['python', 'typescript']);
  assert.equal(await db.notification.count({ where: { url: '/@writer/hello-world' } }), 1);
});

test('creates and reschedules future posts from the visible datetime-local field', async () => {
  const initialAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const create = await app.inject({
    method: 'POST', url: '/v1/posts', headers: { ...writerHeaders, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({
      title: 'Scheduled through editor', url: 'scheduled-through-editor',
      textMd: '# Ready later', contentType: 'markdown', reservedDate: initialAt,
    }).toString(),
  });
  assert.equal(create.json().status, 'DONE', create.body);
  const created = await db.$queryRaw<Array<{ id: number; published: string }>>`
    SELECT id, publishedAt AS published FROM "Post" WHERE slug = 'scheduled-through-editor'
  `;
  assert.equal(Number(created[0]?.published), Date.parse(initialAt));
  const initialQueue = await db.$queryRaw<Array<{ date: string }>>`
    SELECT publishAt AS date FROM "ScheduledPublication" WHERE postId = ${created[0]!.id}
  `;
  assert.equal(Number(initialQueue[0]?.date), Number(created[0]?.published));

  const laterAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const reschedule = await app.inject({
    method: 'PUT', url: '/v1/users/@writer/posts/scheduled-through-editor?reservedDate=1',
    headers: { ...writerHeaders, 'content-type': 'application/json' },
    payload: { reservedDate: laterAt },
  });
  assert.equal(reschedule.json().status, 'DONE', reschedule.body);
  const queued = await db.$queryRaw<Array<{ date: string }>>`
    SELECT publishAt AS date FROM "ScheduledPublication" WHERE postId = ${created[0]!.id}
  `;
  assert.equal(Number(queued[0]?.date), Date.parse(laterAt));

  const hide = await app.inject({ method: 'PUT', url: '/v1/users/@writer/posts/scheduled-through-editor?hide=1', headers: writerHeaders });
  assert.equal(hide.json().body.isHide, true);
  assert.equal((await db.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*) AS total FROM "ScheduledPublication" WHERE postId = ${created[0]!.id}
  `)[0]?.total, 0n);
  const unhide = await app.inject({ method: 'PUT', url: '/v1/users/@writer/posts/scheduled-through-editor?hide=1', headers: writerHeaders });
  assert.equal(unhide.json().body.isHide, false);
  assert.equal(await db.notification.count({ where: { url: '/@writer/scheduled-through-editor' } }), 0);
});

test('serves legacy create/edit/view contracts and keeps an existing post configuration intact', async () => {
  const deniedAnonymous = await app.inject({ method: 'POST', url: '/v1/posts', headers: { 'x-test-csrf': 'good' }, payload: { title: 'No session' } });
  assert.equal(deniedAnonymous.statusCode, 404);
  const deniedReader = await app.inject({
    method: 'POST', url: '/v1/posts', headers: { 'x-user-id': '3', 'x-test-csrf': 'good', 'content-type': 'application/json' },
    payload: { title: 'Reader post', textHtml: '# no', contentType: 'markdown' },
  });
  assert.equal(deniedReader.json().errorCode, 'error:RJ');
  const noCsrf = await app.inject({ method: 'POST', url: '/v1/posts', headers: { 'x-user-id': '1' }, payload: { title: 'No CSRF' } });
  assert.equal(noCsrf.statusCode, 403);

  const created = await app.inject({
    method: 'POST', url: '/v1/posts', headers: { ...writerHeaders, 'content-type': 'application/json' },
    payload: { title: 'API markdown', textHtml: '# API\n\nA `code` sample', contentType: 'markdown', tag: 'api,one' },
  });
  assert.equal(created.json().status, 'DONE', created.body);
  const apiUrl = created.json().body.url;
  const editMode = await app.inject({ url: `/v1/users/@writer/posts/${apiUrl}?mode=edit`, headers: { 'x-user-id': '1' } });
  assert.equal(editMode.json().status, 'DONE');
  assert.match(editMode.json().body.contentHtml, /<h1>API<\/h1>/);
  assert.deepEqual(editMode.json().body.tags, ['api', 'one']);
  const view = await app.inject({ url: `/v1/users/@writer/posts/${apiUrl}?mode=view` });
  assert.equal(view.json().status, 'DONE');
  assert.equal(view.json().body.countLikes, 0);
  assert.match(view.json().body.renderedContent, /<code>code<\/code>/);
  const hiddenView = await app.inject({ url: '/v1/users/@writer/posts/hidden-post?mode=view' });
  assert.equal(hiddenView.statusCode, 404);
  const wrongOwner = await app.inject({ url: `/v1/users/@writer/posts/${apiUrl}?mode=edit`, headers: { 'x-user-id': '2' } });
  assert.equal(wrongOwner.statusCode, 404);

  const edited = await app.inject({
    method: 'POST', url: `/v1/users/@writer/posts/${apiUrl}`,
    headers: { ...writerHeaders, 'content-type': 'application/json' },
    payload: { title: 'API markdown updated', textHtml: '# Updated\n\n**new** body', contentType: 'markdown', tag: 'new_tag', series: 'learning', isHide: false, isAdvertise: false },
  });
  assert.deepEqual(edited.json(), { status: 'DONE', body: {} });
  const updatedPost = await db.$queryRaw<Array<{ title: string; seriesId: number | null }>>`
    SELECT title, seriesId AS seriesId FROM "Post" WHERE slug = ${apiUrl}
  `;
  assert.equal(updatedPost[0]?.title, 'API markdown updated');
  assert.equal(updatedPost[0]?.seriesId, 1);
  const updatedContent = await db.$queryRaw<Array<{ html: string }>>`
    SELECT html FROM "PostContent" WHERE postId = (SELECT id FROM "Post" WHERE slug = ${apiUrl})
  `;
  assert.match(updatedContent[0]!.html, /<strong>new<\/strong>/);
  const updatedTags = await db.$queryRaw<Array<{ value: string }>>`
    SELECT tag.name AS value FROM "Tag" AS tag JOIN "_PostToTag" AS link ON link.B = tag.id
    WHERE link.A = (SELECT id FROM "Post" WHERE slug = ${apiUrl}) ORDER BY tag.name
  `;
  assert.deepEqual(updatedTags.map((tag) => tag.value), ['new', 'tag']);

  const hide = await app.inject({ method: 'PUT', url: `/v1/users/@writer/posts/${apiUrl}?hide=hide`, headers: writerHeaders });
  assert.deepEqual(hide.json().body, { isHide: true });
  assert.equal((await app.inject({ url: `/v1/users/@writer/posts/${apiUrl}?mode=view` })).statusCode, 404);
  const ownerView = await app.inject({ url: `/v1/users/@writer/posts/${apiUrl}?mode=view`, headers: { 'x-user-id': '1' } });
  assert.equal(ownerView.statusCode, 200);
  const unhide = await app.inject({ method: 'PUT', url: `/v1/users/@writer/posts/${apiUrl}?hide=hide`, headers: writerHeaders });
  assert.deepEqual(unhide.json().body, { isHide: false });
});

test('serves settings management lists, filters and restores expired scheduled trash', async () => {
  await db.$executeRaw`INSERT INTO "Tag" (name) VALUES ('popular') ON CONFLICT(name) DO NOTHING`;
  const popular = await db.$queryRaw<Array<{ id: number }>>`SELECT id FROM "Tag" WHERE name = 'popular'`;
  await db.$executeRaw`INSERT INTO "_PostToTag" (A, B) VALUES (3, ${popular[0]!.id}), (4, ${popular[0]!.id})`;

  const published = await app.inject({ url: '/v1/setting/posts?order=title', headers: { 'x-user-id': '1' } });
  assert.equal(published.json().status, 'DONE', published.body);
  assert.deepEqual(published.json().body.posts.map((post: { title: string }) => post.title), ['API markdown updated', 'Existing', 'Hidden', 'Markdown launch']);
  assert.equal(published.json().body.totalCount, 4);
  const hidden = await app.inject({ url: '/v1/setting/posts?visibility=hidden', headers: { 'x-user-id': '1' } });
  assert.deepEqual(hidden.json().body.posts.map((post: { url: string }) => post.url), ['hidden-post']);
  const invalidOrder = await app.inject({ url: '/v1/setting/posts?order=unknown', headers: { 'x-user-id': '1' } });
  assert.equal(invalidOrder.statusCode, 404);

  const tagManagement = await app.inject({ url: '/v1/setting/tag', headers: { 'x-user-id': '1' } });
  assert.deepEqual(tagManagement.json().body.tags[0], { name: 'popular', count: 2 });
  assert.equal(tagManagement.json().body.username, 'writer');
  assert.equal((await app.inject('/v1/setting/tag')).json().errorCode, 'error:NL');
  assert.equal((await app.inject({ url: '/v1/setting/tag', headers: { 'x-user-id': '3' } })).json().errorCode, 'error:RJ');

  const scheduled = await app.inject({ url: '/v1/setting/reserved-posts', headers: { 'x-user-id': '1' } });
  assert.deepEqual(scheduled.json().body.posts.map((post: { url: string }) => post.url), ['scheduled', 'scheduled-through-editor']);
  const drafts = await app.inject({ url: '/v1/drafts', headers: { 'x-user-id': '1' } });
  assert.ok(drafts.json().body.drafts.some((draft: { url: string }) => draft.url === 'draft-note'));
  const trash = await app.inject({ url: '/v1/setting/trash-posts?page=1', headers: { 'x-user-id': '1' } });
  assert.equal(trash.json().status, 'DONE', trash.body);
  assert.equal(trash.json().body.posts[0].sourceStatus, 'scheduled');
  assert.equal(trash.json().body.posts[0].scheduleElapsed, true);
  assert.equal(trash.json().body.retention.mode, 'manual');

  const expectedDeletedDate = trash.json().body.posts[0].deletedDate;
  const stale = await app.inject({
    method: 'POST', url: '/v1/setting/trash-posts/trashed-schedule/restore',
    headers: { ...writerHeaders, 'content-type': 'application/json' },
    payload: { expectedDeletedDate: '2001-01-01T00:00:00+00:00' },
  });
  assert.equal(stale.json().errorCode, 'error:RJ');
  const restore = await app.inject({
    method: 'POST', url: '/v1/setting/trash-posts/trashed-schedule/restore',
    headers: { ...writerHeaders, 'content-type': 'application/json' },
    payload: { expectedDeletedDate },
  });
  assert.deepEqual(restore.json().body, { url: 'trashed-schedule', status: 'published', restored: true });
  const restored = await db.$queryRaw<Array<{ deletedDate: string | null; hide: number }>>`
    SELECT deletedAt AS deletedDate, CAST(isHidden AS INTEGER) AS hide FROM "Post" WHERE slug = 'trashed-schedule'
  `;
  assert.equal(restored[0]?.deletedDate, null);
  assert.equal(Number(restored[0]?.hide), 1);
});

test('pages revision history, restores with version checks, deletes revisions and builds timelapse frames', async () => {
  const base = '/v1/users/@writer/posts/existing/revisions';
  const list = await app.inject({ url: base, headers: { 'x-user-id': '1' } });
  assert.equal(list.json().status, 'DONE', list.body);
  assert.deepEqual(list.json().body.pagination, { page: 1, limit: 20, totalCount: 2, lastPage: 1 });
  const summaries = list.json().body.revisions;
  assert.equal(summaries[0].changeType, 'legacy');
  assert.equal(summaries[0].canRestore, false);
  assert.equal(summaries[1].contentExcerpt, 'Old body');
  assert.equal(Object.hasOwn(summaries[0], 'contentHtml'), false);
  assert.equal((await app.inject({ url: base, headers: { 'x-user-id': '2' } })).statusCode, 404);
  assert.equal((await app.inject(base)).json().errorCode, 'error:NL');

  const detail = await app.inject({ url: `${base}/1`, headers: { 'x-user-id': '1' } });
  assert.equal(detail.json().body.revision.contentHtml, '<p>Old body</p>');
  assert.equal(detail.json().body.revision.contentText, 'Old body');
  const expected = list.json().body.currentUpdatedDate;
  const restored = await app.inject({
    method: 'POST', url: `${base}/1/restore`, headers: { ...writerHeaders, 'content-type': 'application/json' },
    payload: { expectedUpdatedDate: expected },
  });
  assert.equal(restored.json().body.restored, true, restored.body);
  const fields = await db.$queryRaw<Array<{ title: string; subtitle: string; description: string; html: string }>>`
    SELECT post.title, post.subtitle, post.description, content.html
      FROM "Post" AS post JOIN "PostContent" AS content ON content.postId = post.id
     WHERE post.id = 1
  `;
  assert.deepEqual(fields[0], { title: 'Old version', subtitle: 'Old subtitle', description: 'Old description', html: '<p>Old body</p>' });
  const restoredTags = await db.$queryRaw<Array<{ value: string }>>`
    SELECT tag.name AS value FROM "_PostToTag" AS link JOIN "Tag" AS tag ON tag.id = link.B WHERE link.A = 1
  `;
  assert.deepEqual(restoredTags.map((tag) => tag.value), ['oldtag']);

  const stale = await app.inject({
    method: 'POST', url: `${base}/1/restore`, headers: { ...writerHeaders, 'content-type': 'application/json' },
    payload: { expectedUpdatedDate: expected },
  });
  assert.equal(stale.json().errorCode, 'error:CF');
  const legacyRestore = await app.inject({
    method: 'POST', url: `${base}/2/restore`, headers: { ...writerHeaders, 'content-type': 'application/json' },
    payload: { expectedUpdatedDate: restored.json().body.updatedDate },
  });
  assert.equal(legacyRestore.json().errorCode, 'error:RJ');

  const noChange = await app.inject({
    method: 'POST', url: `${base}/1/restore`, headers: { ...writerHeaders, 'content-type': 'application/json' },
    payload: { expectedUpdatedDate: restored.json().body.updatedDate },
  });
  assert.equal(noChange.json().body.restored, false);
  const timelapse = await app.inject({ url: '/v1/users/@writer/posts/existing/timelapse', headers: { 'x-user-id': '1' } });
  assert.equal(timelapse.json().body.totalCount, 3);
  assert.deepEqual(timelapse.json().body.frames.map((frame: { title: string }) => frame.title), ['Old version', 'Existing', 'Old version']);
  assert.equal(timelapse.json().body.frames.at(-1).stage, 'published');

  const removed = await app.inject({ method: 'DELETE', url: `${base}/1`, headers: writerHeaders });
  assert.deepEqual(removed.json().body, { revisionId: 1, deleted: true });
  assert.equal((await app.inject({ url: `${base}/1`, headers: { 'x-user-id': '1' } })).statusCode, 404);
});

test('links editor to owner-only revision and timelapse pages with form restore and delete actions', async () => {
  const postPath = '/@writer/existing';
  const historyPath = `${postPath}/revisions`;
  const unauthorized = await app.inject({ url: historyPath, headers: { 'x-user-id': '2' } });
  assert.equal(unauthorized.statusCode, 404);
  assert.equal((await app.inject(historyPath)).headers.location, '/login');

  const history = await app.inject({ url: historyPath, headers: writerHeaders });
  assert.equal(history.statusCode, 200, history.body);
  assert.match(String(history.headers['x-robots-tag'] ?? ''), /noindex/);
  assert.match(history.body, /수정 기록/);
  assert.match(history.body, /이전 기록/);
  assert.match(history.body, /name="expectedUpdatedDate"/);
  assert.match(history.body, /confirmDelete/);

  const timeline = await app.inject({ url: `${postPath}/timelapse`, headers: writerHeaders });
  assert.equal(timeline.statusCode, 200, timeline.body);
  assert.match(timeline.body, /작성 타임라인/);
  assert.match(timeline.body, /Existing/);
  assert.doesNotMatch(timeline.body, /<script>/i);
  assert.equal((await app.inject({ url: `${postPath}/timelapse`, headers: { 'x-user-id': '2' } })).statusCode, 404);

  const restoreCandidates = await db.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "PostRevision" WHERE postId = 1 AND type = 'restore' ORDER BY id DESC LIMIT 1
  `;
  const restoreId = restoreCandidates[0]?.id;
  assert.ok(restoreId);
  const staleDelete = await app.inject({
    method: 'POST', url: `${historyPath}/${restoreId}/delete`,
    headers: { ...writerHeaders, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ confirmDelete: 'yes', expectedUpdatedDate: '2001-01-01 00:00:00.000000' }).toString(),
  });
  assert.equal(staleDelete.statusCode, 303);
  assert.match(staleDelete.headers.location ?? '', /conflict=1/);

  const current = await db.post.findMany({ where: { id: 1 }, select: { updatedAt: true } });
  const restore = await app.inject({
    method: 'POST', url: `${historyPath}/${restoreId}/restore`,
    headers: { ...writerHeaders, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ expectedUpdatedDate: current[0]!.updatedAt.toISOString() }).toString(),
  });
  assert.equal(restore.statusCode, 303, restore.body);
  assert.match(restore.headers.location ?? '', /restored=1/);
  const restoredHistory = await app.inject({ url: restore.headers.location, headers: writerHeaders });
  assert.match(restoredHistory.body, /이 기록으로 복원했습니다\./);

  const afterRestore = await db.post.findMany({ where: { id: 1 }, select: { updatedAt: true, title: true } });
  assert.equal(afterRestore[0]?.title, 'Existing');
  const remove = await app.inject({
    method: 'POST', url: `${historyPath}/${restoreId}/delete`,
    headers: { ...writerHeaders, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ confirmDelete: 'yes', expectedUpdatedDate: afterRestore[0]!.updatedAt.toISOString() }).toString(),
  });
  assert.equal(remove.statusCode, 303, remove.body);
  assert.match(remove.headers.location ?? '', /deleted=1/);
  const deletedHistory = await app.inject({ url: remove.headers.location, headers: writerHeaders });
  assert.match(deletedHistory.body, /수정 기록을 삭제했습니다\./);
  assert.doesNotMatch(deletedHistory.body, new RegExp(`/revisions/${restoreId}/delete`));
});

test('saves, previews, edits and publishes drafts while keeping only owner access', async () => {
  const created = await app.inject({
    method: 'POST', url: '/v1/drafts', headers: { ...writerHeaders, 'content-type': 'application/json' },
    payload: { title: 'Draft from API', content: '# Private draft', contentType: 'markdown', tags: 'draft,notes' },
  });
  assert.equal(created.json().status, 'DONE', created.body);
  const slug = created.json().body.url;
  const detail = await app.inject({ url: `/v1/drafts/${slug}`, headers: { 'x-user-id': '1' } });
  assert.equal(detail.json().body.url, slug);
  assert.match(detail.json().body.contentHtml, /<h1>Private draft<\/h1>/);
  const list = await app.inject({ url: '/v1/drafts', headers: { 'x-user-id': '1' } });
  assert.ok(list.json().body.drafts.some((draft: { url: string }) => draft.url === slug));
  assert.equal((await app.inject({ url: `/v1/drafts/${slug}`, headers: { 'x-user-id': '2' } })).statusCode, 404);

  const saveDraft = await app.inject({
    method: 'PUT', url: `/v1/drafts/${slug}`,
    headers: { ...writerHeaders, 'content-type': 'application/json' },
    payload: {
      title: 'Draft from API', url: slug, contentHtml: '<h1>Private draft</h1>', tag: 'draft, notes',
      metaDescription: 'Private draft', coverLayout: 'default', coverImagePosition: 'right',
      coverImageRatio: 'auto', blockComment: 'false',
    },
  });
  assert.deepEqual(saveDraft.json(), { status: 'DONE', body: { url: slug } });
  const preview = await app.inject({ url: `/write/preview/${slug}`, headers: writerHeaders });
  assert.equal(preview.statusCode, 200, preview.body);

  const publish = await app.inject({
    method: 'POST', url: '/v1/posts', headers: { ...writerHeaders, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({
      draftUrl: slug, title: 'Draft published', url: slug,
      textMd: '# Now public\n\nPublished **safely**.', contentType: 'markdown',
      tag: 'live', series: 'learning', blockComment: 'false', coverLayout: 'default',
      coverImagePosition: 'right', coverImageRatio: 'auto',
    }).toString(),
  });
  assert.deepEqual(publish.json(), { status: 'DONE', body: { url: slug } });
  const published = await db.$queryRaw<Array<{ published: string | null; title: string }>>`
    SELECT CAST(publishedAt AS TEXT) AS published, title FROM "Post" WHERE slug = ${slug}
  `;
  assert.ok(published[0]?.published);
  assert.equal(published[0]?.title, 'Draft published');
});

test('supports schedule cancel and publish-now, and soft-deletes an owned post', async () => {
  const cancel = await app.inject({ method: 'POST', url: '/v1/users/@writer/posts/scheduled/schedule/cancel', headers: writerHeaders });
  assert.deepEqual(cancel.json().body, { url: 'scheduled', status: 'draft' });
  const state = await db.$queryRaw<Array<{ published: string | null }>>`
    SELECT CAST(publishedAt AS TEXT) AS published FROM "Post" WHERE slug = 'scheduled'
  `;
  assert.equal(state[0]?.published, null);

  await db.post.update({ where: { slug: 'scheduled' }, data: { publishedAt: new Date(Date.UTC(2099, 0, 1)) } });
  const publishNow = await app.inject({ method: 'POST', url: '/v1/users/@writer/posts/scheduled/schedule/publish-now', headers: writerHeaders });
  assert.equal(publishNow.json().body.status, 'published');
  const published = await db.$queryRaw<Array<{ published: string | null }>>`
    SELECT CAST(publishedAt AS TEXT) AS published FROM "Post" WHERE slug = 'scheduled'
  `;
  assert.ok(published[0]?.published);

  const trashed = await app.inject({ method: 'DELETE', url: '/v1/users/@writer/posts/existing', headers: writerHeaders });
  assert.equal(trashed.json().body.trashed, true);
  const deleted = await db.$queryRaw<Array<{ deleted: string | null }>>`
    SELECT CAST(deletedAt AS TEXT) AS deleted FROM "Post" WHERE slug = 'existing'
  `;
  assert.ok(deleted[0]?.deleted);
  assert.equal((await app.inject({ url: '/v1/users/@writer/posts/existing?mode=view' })).statusCode, 404);
});

test('exports ID-based PATCH persistence with preserved omissions and stale-write conflicts', async () => {
  await db.$executeRaw`INSERT INTO "_PostToTag" (A, B) VALUES (2, 1)`;
  await db.$executeRaw`UPDATE "Post" SET updatedAt = ${Date.UTC(2020, 0, 2, 3, 4, 5, 123)} WHERE id = 2`;
  // A client that read the post from 3.x may still hold the six-digit version of this date.
  const expected = '2020-01-02T03:04:05.123456+00:00';
  const saved = await updateAuthorPost(db, { id: 1, username: 'writer' }, 2, {
    title: 'Patched by ID',
  }, expected);
  assert.equal(saved.id, 2);
  assert.equal(saved.url, 'draft-note');

  const preserved = await db.$queryRaw<Array<{ title: string; html: string; seriesId: number | null }>>`
    SELECT post.title, content.html, post.seriesId
      FROM "Post" AS post JOIN "PostContent" AS content ON content.postId = post.id
     WHERE post.id = 2
  `;
  assert.equal(preserved[0]?.title, 'Patched by ID');
  assert.equal(preserved[0]?.html, '<p>Draft starts here.</p>');
  assert.equal(preserved[0]?.seriesId, 1);
  assert.deepEqual(await db.$queryRaw<Array<{ value: string }>>`
    SELECT tag.name AS value FROM "Tag" AS tag
      JOIN "_PostToTag" AS link ON link.B = tag.id WHERE link.A = 2
  `, [{ value: 'legacy-tag' }]);

  await assert.rejects(
    updateAuthorPost(db, { id: 1, username: 'writer' }, 2, { title: 'Stale write' }, expected),
    (error: unknown) => error instanceof PostValidationError && error.errorCode === 'CF',
  );
  const current = await db.$queryRaw<Array<{ title: string }>>`SELECT title FROM "Post" WHERE id = 2`;
  assert.equal(current[0]?.title, 'Patched by ID');
});
