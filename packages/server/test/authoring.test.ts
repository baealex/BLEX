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

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-authoring-'));
const databasePath = join(directory, 'Django authoring.sqlite3');
const database = new DatabaseSync(databasePath);
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
  CREATE TABLE board_series (
    id INTEGER PRIMARY KEY,
    "order" INTEGER NOT NULL DEFAULT 0,
    text_md TEXT NOT NULL DEFAULT '',
    text_html TEXT NOT NULL DEFAULT '',
    hide BOOLEAN NOT NULL DEFAULT 0,
    url TEXT NOT NULL UNIQUE,
    layout TEXT NOT NULL DEFAULT '',
    created_date DATETIME NOT NULL,
    updated_date DATETIME NOT NULL,
    owner_id INTEGER NOT NULL,
    name TEXT NOT NULL
  );
  CREATE TABLE board_form (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    is_public BOOLEAN NOT NULL DEFAULT 0,
    created_date DATETIME NOT NULL,
    updated_date DATETIME NOT NULL,
    user_id INTEGER NOT NULL
  );
  CREATE TABLE board_imagecache (
    id INTEGER PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    path TEXT NOT NULL UNIQUE,
    size INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER
  );
  CREATE TABLE board_post (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL UNIQUE,
    image TEXT NOT NULL DEFAULT '',
    image_hash TEXT NOT NULL DEFAULT '',
    read_time INTEGER NOT NULL DEFAULT 0,
    created_date DATETIME NOT NULL,
    updated_date DATETIME NOT NULL,
    author_id INTEGER NOT NULL,
    series_id INTEGER,
    meta_description TEXT NOT NULL DEFAULT '',
    published_date DATETIME,
    deleted_date DATETIME
  );
  CREATE TABLE board_postcontent (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL UNIQUE,
    content_html TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE board_postconfig (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL UNIQUE,
    hide BOOLEAN NOT NULL DEFAULT 0,
    advertise BOOLEAN NOT NULL DEFAULT 0,
    block_comment BOOLEAN NOT NULL DEFAULT 0,
    cover_layout TEXT NOT NULL DEFAULT 'default',
    cover_image_position TEXT NOT NULL DEFAULT 'right',
    cover_image_ratio TEXT NOT NULL DEFAULT 'auto'
  );
  CREATE TABLE board_postconfigmeta (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    created_date DATETIME NOT NULL,
    updated_date DATETIME NOT NULL,
    post_id INTEGER NOT NULL
  );
  CREATE TABLE board_tag (id INTEGER PRIMARY KEY, value TEXT NOT NULL UNIQUE);
  CREATE TABLE board_post_tags (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    UNIQUE(post_id, tag_id)
  );
  CREATE TABLE board_post_likes (
    id INTEGER PRIMARY KEY,
    created_date DATETIME NOT NULL,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL
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
  CREATE TABLE board_authorsubscription (
    id INTEGER PRIMARY KEY,
    subscriber_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    created_date DATETIME NOT NULL,
    UNIQUE(subscriber_id, author_id)
  );
  CREATE TABLE board_webhooksubscription (
    id INTEGER PRIMARY KEY,
    author_id INTEGER,
    scope TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1
  );
  CREATE TABLE board_notify (
    id INTEGER PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    content TEXT NOT NULL,
    message_key TEXT NOT NULL DEFAULT '',
    message_params TEXT NOT NULL DEFAULT '{}',
    created_date DATETIME NOT NULL,
    updated_date DATETIME NOT NULL,
    has_read BOOLEAN NOT NULL DEFAULT 0
  );
  CREATE TABLE board_userconfigmeta (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    created_date DATETIME NOT NULL,
    updated_date DATETIME NOT NULL
  );
  CREATE TABLE board_telegramsync (user_id INTEGER PRIMARY KEY, tid TEXT NOT NULL DEFAULT '');
  CREATE TABLE board_integrationsetting (
    id INTEGER PRIMARY KEY,
    telegram_enabled BOOLEAN NOT NULL DEFAULT 0,
    telegram_bot_token TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE blex_notification_delivery (
    notification_id INTEGER PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at BIGINT NOT NULL
  );
  CREATE TABLE blex_scheduled_publication (
    post_id INTEGER PRIMARY KEY,
    publish_at TEXT NOT NULL
  );
  CREATE TABLE blex_webhook_delivery (
    post_id INTEGER NOT NULL,
    channel_id INTEGER NOT NULL,
    available_at BIGINT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(post_id, channel_id)
  );
  CREATE TABLE board_sitesetting (id INTEGER PRIMARY KEY, site_name TEXT NOT NULL DEFAULT 'BLEX', logo_svg TEXT NOT NULL DEFAULT '',
    logo_svg_dark TEXT NOT NULL DEFAULT '', icon_manifest TEXT NOT NULL DEFAULT '{}', seo_enabled BOOLEAN NOT NULL DEFAULT 1, aeo_enabled BOOLEAN NOT NULL DEFAULT 0);
  CREATE TABLE board_staticpage (id INTEGER PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL, is_published BOOLEAN NOT NULL DEFAULT 0,
    show_in_footer BOOLEAN NOT NULL DEFAULT 0, "order" INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE board_sitebanner (id INTEGER PRIMARY KEY, position TEXT NOT NULL, content_html TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT 1,
    scope TEXT NOT NULL DEFAULT 'global', user_id INTEGER, "order" INTEGER NOT NULL DEFAULT 0, created_date TEXT);
  CREATE TABLE board_usernamechangelog (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    created_date DATETIME NOT NULL,
    user_id INTEGER NOT NULL
  );
  CREATE TABLE board_pinnedpost (id INTEGER PRIMARY KEY AUTOINCREMENT, "order" INTEGER NOT NULL DEFAULT 0, created_date TEXT, post_id INTEGER NOT NULL, user_id INTEGER NOT NULL);
  CREATE TABLE board_edithistory (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL,
    actor_id INTEGER,
    restored_from_id INTEGER,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    content TEXT NOT NULL,
    content_excerpt TEXT,
    description TEXT NOT NULL,
    tags TEXT NOT NULL,
    source_updated_date DATETIME,
    change_type TEXT NOT NULL,
    created_date DATETIME NOT NULL
  );

  INSERT INTO auth_user (id, username, first_name, is_active) VALUES (1, 'writer', 'Writer', 1), (2, 'other-writer', 'Other Writer', 1),
    (3, 'reader', 'Reader', 1), (4, 'inactive', 'Inactive', 0);
  INSERT INTO board_profile (id, user_id, avatar, role) VALUES (1, 1, 'writer.png', 'EDITOR'), (2, 2, '', 'EDITOR'),
    (3, 3, '', 'READER'), (4, 4, '', 'EDITOR');
  INSERT INTO board_series VALUES
    (1, 1, '', '', 0, 'learning', '', '${now}', '${now}', 1, 'Learning'),
    (2, 1, '', '', 0, 'other-series', '', '${now}', '${now}', 2, 'Other series');
  INSERT INTO board_form VALUES
    (1, 'Short form', '# Template body', 0, '${now}', '${now}', 1),
    (2, 'Another writer form', 'Private form body', 0, '${now}', '${now}', 2);
  INSERT INTO board_imagecache VALUES
    (1, 'cover-hash', 'images/content/2026/11/21/cover-test.jpg', 12, 1);
  INSERT INTO board_post VALUES
    (1, 'Existing', 'Existing subtitle', 'existing', '', '', 2, '${now}', '${now}', 1, 1, 'Existing description', '${now}', NULL),
    (2, 'Draft note', '', 'draft-note', '', '', 1, '${now}', '${now}', 1, 1, '', NULL, NULL),
    (3, 'Scheduled', '', 'scheduled', '', '', 1, '${now}', '${now}', 1, NULL, '', '2099-01-01 00:00:00.000000', NULL),
    (4, 'Hidden', '', 'hidden-post', '', '', 1, '${now}', '${now}', 1, NULL, '', '${now}', NULL),
    (5, 'Elapsed schedule', '', 'trashed-schedule', '', '', 1, '${now}', '${now}', 1, NULL, '', '${oneHourAgo}', '${twoHoursAgo}');
  INSERT INTO board_postcontent VALUES
    (1, 1, '<h2>Existing content</h2><p>Do not lose this.</p>'),
    (2, 2, '<p>Draft starts here.</p>'),
    (3, 3, '<p>Scheduled content.</p>'),
    (4, 4, '<p>Hidden content.</p>'),
    (5, 5, '<p>Elapsed schedule content.</p>');
  INSERT INTO board_edithistory VALUES
    (1, 1, 1, NULL, 'Old version', 'Old subtitle', '<p>Old body</p>', 'Old body', 'Old description', '["oldtag"]', '2020-01-02 03:04:05.123456', 'edit', '2020-01-02 03:04:05.123456'),
    (2, 1, NULL, NULL, '_NO_CHANGED_', '', '_NO_CHANGED_', '', '', '[]', NULL, 'legacy', '2021-01-02 03:04:05.000000');
  INSERT INTO board_postconfig VALUES
    (1, 1, 0, 0, 1, 'split', 'left', '4:3'),
    (2, 2, 0, 0, 0, 'default', 'right', 'auto'),
    (3, 3, 0, 0, 0, 'default', 'right', 'auto'),
    (4, 4, 1, 0, 0, 'default', 'right', 'auto'),
    (5, 5, 1, 0, 0, 'default', 'right', 'auto');
  INSERT INTO board_tag VALUES (1, 'legacy-tag');
  INSERT INTO board_post_tags VALUES (1, 1, 1);
  INSERT INTO board_post_likes VALUES (1, '${now}', 1, 3);
  INSERT INTO board_comment VALUES (1, 'hello', '<p>hello</p>', 0, 0, '${now}', 3, 1, NULL);
  INSERT INTO board_authorsubscription VALUES (1, 3, 1, '${now}');
  INSERT INTO blex_scheduled_publication VALUES (3, '2099-01-01 00:00:00.000000');
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
    meta_description: 'Existing description', content_html: '<h2>Existing content</h2><p>Do not lose this.</p>',
    cover_layout: 'split', cover_image_position: 'left', cover_image_ratio: '4:3', block_comment: 'false',
  };
  const boundary = 'blexboundary';
  const editHeaders = { ...writerHeaders, 'content-type': `multipart/form-data; boundary=${boundary}` };
  const editorForm = (fields: Record<string, string>) => `${Object.entries(fields)
    .map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`).join('')}--${boundary}--\r\n`;
  const metadataEdit = await app.inject({
    method: 'POST', url: '/v1/users/@writer/posts/existing', headers: editHeaders,
    payload: editorForm({ ...editFields, cover_image_url: '/resources/media/images/content/2026/11/21/cover-test.jpg' }),
  });
  assert.equal(metadataEdit.json().status, 'DONE', metadataEdit.body);
  const unchangedBody = await db.$queryRaw<Array<{ html: string }>>`
    SELECT content_html AS html FROM board_postcontent WHERE post_id = 1
  `;
  assert.equal(unchangedBody[0]?.html, '<h2>Existing content</h2><p>Do not lose this.</p>');
  const selectedCover = await db.$queryRaw<Array<{ image: string }>>`
    SELECT image FROM board_post WHERE id = 1
  `;
  assert.equal(selectedCover[0]?.image, 'images/content/2026/11/21/cover-test.jpg');

  const rejectedCover = await app.inject({
    method: 'POST', url: '/v1/users/@writer/posts/existing', headers: editHeaders,
    payload: editorForm({ ...editFields, title: 'Must not save', cover_image_url: 'https://external.example/cover.jpg' }),
  });
  assert.deepEqual([rejectedCover.statusCode, rejectedCover.json().status], [200, 'ERROR']);
  const afterRejectedCover = await db.$queryRaw<Array<{ title: string; image: string }>>`SELECT title, image FROM board_post WHERE id = 1`;
  assert.deepEqual(afterRejectedCover[0], { title: 'Existing', image: 'images/content/2026/11/21/cover-test.jpg' });
  const removeCover = await app.inject({
    method: 'POST', url: '/v1/users/@writer/posts/existing', headers: editHeaders,
    payload: editorForm({ ...editFields, remove_cover_image: 'on' }),
  });
  assert.equal(removeCover.json().status, 'DONE', removeCover.body);
  const removedCover = await db.$queryRaw<Array<{ image: string }>>`SELECT image FROM board_post WHERE id = 1`;
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
      meta_description: 'A saved description',
      text_md: '# Hello\n\nThis is **bold**.\n\n<script>bad()</script>',
      content_type: 'markdown',
      tag: 'TypeScript, Python',
      series: 'learning',
      block_comment: 'false',
      cover_layout: 'split',
      cover_image_position: 'left',
      cover_image_ratio: '4:3',
    }).toString(),
  });
  assert.deepEqual(response.json(), { status: 'DONE', body: { url: 'hello-world' } });

  const post = await db.$queryRaw<Array<{ id: number; publishedDate: string; seriesId: number; title: string; readTime: number }>>`
    SELECT id, CAST(published_date AS TEXT) AS publishedDate, series_id AS seriesId, title, read_time AS readTime
    FROM board_post WHERE url = 'hello-world'
  `;
  assert.equal(post[0]?.title, 'Markdown launch');
  assert.ok(post[0]?.publishedDate);
  assert.equal(post[0]?.seriesId, 1);
  assert.equal(post[0]?.readTime, 1);
  const content = await db.$queryRaw<Array<{ html: string }>>`
    SELECT content_html AS html FROM board_postcontent WHERE post_id = ${post[0]!.id}
  `;
  assert.match(content[0]!.html, /<h1>Hello<\/h1>/);
  assert.match(content[0]!.html, /<strong>bold<\/strong>/);
  assert.doesNotMatch(content[0]!.html, /<script/i);
  assert.match(content[0]!.html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  const config = await db.$queryRaw<Array<{ hide: number | bigint; coverLayout: string; blockComment: number | bigint }>>`
    SELECT CAST(hide AS INTEGER) AS hide, cover_layout AS coverLayout, CAST(block_comment AS INTEGER) AS blockComment
    FROM board_postconfig WHERE post_id = ${post[0]!.id}
  `;
  assert.equal(Number(config[0]?.hide), 0);
  assert.equal(config[0]?.coverLayout, 'split');
  assert.equal(Number(config[0]?.blockComment), 0);
  const tags = await db.$queryRaw<Array<{ value: string }>>`
    SELECT tag.value FROM board_tag AS tag JOIN board_post_tags AS link ON link.tag_id = tag.id WHERE link.post_id = ${post[0]!.id} ORDER BY tag.value
  `;
  assert.deepEqual(tags.map((tag) => tag.value), ['python', 'typescript']);
  const notifications = await db.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*) AS total FROM board_notify WHERE url = '/@writer/hello-world'
  `;
  assert.equal(Number(notifications[0]?.total), 1);
});

test('creates and reschedules future posts from the visible datetime-local field', async () => {
  const initialAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const create = await app.inject({
    method: 'POST', url: '/v1/posts', headers: { ...writerHeaders, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({
      title: 'Scheduled through editor', url: 'scheduled-through-editor',
      text_md: '# Ready later', content_type: 'markdown', reserved_date: initialAt,
    }).toString(),
  });
  assert.equal(create.json().status, 'DONE', create.body);
  const created = await db.$queryRaw<Array<{ id: number; published: string }>>`
    SELECT id, CAST(published_date AS TEXT) AS published FROM board_post WHERE url = 'scheduled-through-editor'
  `;
  assert.equal(created[0]?.published, initialAt.replace('T', ' ').replace('Z', ''));
  const initialQueue = await db.$queryRaw<Array<{ date: string }>>`
    SELECT publish_at AS date FROM blex_scheduled_publication WHERE post_id = ${created[0]!.id}
  `;
  assert.equal(initialQueue[0]?.date, created[0]?.published);

  const laterAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const reschedule = await app.inject({
    method: 'PUT', url: '/v1/users/@writer/posts/scheduled-through-editor?reserved_date=1',
    headers: { ...writerHeaders, 'content-type': 'application/json' },
    payload: { reserved_date: laterAt },
  });
  assert.equal(reschedule.json().status, 'DONE', reschedule.body);
  const queued = await db.$queryRaw<Array<{ date: string }>>`
    SELECT publish_at AS date FROM blex_scheduled_publication WHERE post_id = ${created[0]!.id}
  `;
  assert.equal(queued[0]?.date, laterAt.replace('T', ' ').replace('Z', ''));

  const hide = await app.inject({ method: 'PUT', url: '/v1/users/@writer/posts/scheduled-through-editor?hide=1', headers: writerHeaders });
  assert.equal(hide.json().body.isHide, true);
  assert.equal((await db.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*) AS total FROM blex_scheduled_publication WHERE post_id = ${created[0]!.id}
  `)[0]?.total, 0n);
  const unhide = await app.inject({ method: 'PUT', url: '/v1/users/@writer/posts/scheduled-through-editor?hide=1', headers: writerHeaders });
  assert.equal(unhide.json().body.isHide, false);
  const notifications = await db.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*) AS total FROM board_notify WHERE url = '/@writer/scheduled-through-editor'
  `;
  assert.equal(Number(notifications[0]?.total), 0);
});

test('serves legacy create/edit/view contracts and keeps an existing post configuration intact', async () => {
  const deniedAnonymous = await app.inject({ method: 'POST', url: '/v1/posts', headers: { 'x-test-csrf': 'good' }, payload: { title: 'No session' } });
  assert.equal(deniedAnonymous.statusCode, 404);
  const deniedReader = await app.inject({
    method: 'POST', url: '/v1/posts', headers: { 'x-user-id': '3', 'x-test-csrf': 'good', 'content-type': 'application/json' },
    payload: { title: 'Reader post', text_html: '# no', content_type: 'markdown' },
  });
  assert.equal(deniedReader.json().errorCode, 'error:RJ');
  const noCsrf = await app.inject({ method: 'POST', url: '/v1/posts', headers: { 'x-user-id': '1' }, payload: { title: 'No CSRF' } });
  assert.equal(noCsrf.statusCode, 403);

  const created = await app.inject({
    method: 'POST', url: '/v1/posts', headers: { ...writerHeaders, 'content-type': 'application/json' },
    payload: { title: 'API markdown', text_html: '# API\n\nA `code` sample', content_type: 'markdown', tag: 'api,one' },
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
    payload: { title: 'API markdown updated', text_html: '# Updated\n\n**new** body', content_type: 'markdown', tag: 'new_tag', series: 'learning', is_hide: false, is_advertise: false },
  });
  assert.deepEqual(edited.json(), { status: 'DONE', body: {} });
  const updatedPost = await db.$queryRaw<Array<{ title: string; seriesId: number | null }>>`
    SELECT title, series_id AS seriesId FROM board_post WHERE url = ${apiUrl}
  `;
  assert.equal(updatedPost[0]?.title, 'API markdown updated');
  assert.equal(updatedPost[0]?.seriesId, 1);
  const updatedContent = await db.$queryRaw<Array<{ html: string }>>`
    SELECT content_html AS html FROM board_postcontent WHERE post_id = (SELECT id FROM board_post WHERE url = ${apiUrl})
  `;
  assert.match(updatedContent[0]!.html, /<strong>new<\/strong>/);
  const updatedTags = await db.$queryRaw<Array<{ value: string }>>`
    SELECT tag.value FROM board_tag AS tag JOIN board_post_tags AS link ON link.tag_id = tag.id
    WHERE link.post_id = (SELECT id FROM board_post WHERE url = ${apiUrl}) ORDER BY tag.value
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
  await db.$executeRaw`INSERT INTO board_tag (value) VALUES ('popular') ON CONFLICT(value) DO NOTHING`;
  const popular = await db.$queryRaw<Array<{ id: number }>>`SELECT id FROM board_tag WHERE value = 'popular'`;
  await db.$executeRaw`INSERT INTO board_post_tags (post_id, tag_id) VALUES (3, ${popular[0]!.id}), (4, ${popular[0]!.id})`;

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
    SELECT CAST(post.deleted_date AS TEXT) AS deletedDate, CAST(config.hide AS INTEGER) AS hide
      FROM board_post AS post JOIN board_postconfig AS config ON config.post_id = post.id
     WHERE post.url = 'trashed-schedule'
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
    SELECT post.title, post.subtitle, post.meta_description AS description, content.content_html AS html
      FROM board_post AS post JOIN board_postcontent AS content ON content.post_id = post.id
     WHERE post.id = 1
  `;
  assert.deepEqual(fields[0], { title: 'Old version', subtitle: 'Old subtitle', description: 'Old description', html: '<p>Old body</p>' });
  const restoredTags = await db.$queryRaw<Array<{ value: string }>>`
    SELECT tag.value AS value FROM board_post_tags AS link JOIN board_tag AS tag ON tag.id = link.tag_id WHERE link.post_id = 1
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
  assert.match(history.body, /name="expected_updated_date"/);
  assert.match(history.body, /confirm_delete/);

  const timeline = await app.inject({ url: `${postPath}/timelapse`, headers: writerHeaders });
  assert.equal(timeline.statusCode, 200, timeline.body);
  assert.match(timeline.body, /작성 타임라인/);
  assert.match(timeline.body, /Existing/);
  assert.doesNotMatch(timeline.body, /<script>/i);
  assert.equal((await app.inject({ url: `${postPath}/timelapse`, headers: { 'x-user-id': '2' } })).statusCode, 404);

  const restoreCandidates = await db.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM board_edithistory WHERE post_id = 1 AND change_type = 'restore' ORDER BY id DESC LIMIT 1
  `;
  const restoreId = restoreCandidates[0]?.id;
  assert.ok(restoreId);
  const staleDelete = await app.inject({
    method: 'POST', url: `${historyPath}/${restoreId}/delete`,
    headers: { ...writerHeaders, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ confirm_delete: 'yes', expected_updated_date: '2001-01-01 00:00:00.000000' }).toString(),
  });
  assert.equal(staleDelete.statusCode, 303);
  assert.match(staleDelete.headers.location ?? '', /conflict=1/);

  const current = await db.$queryRaw<Array<{ updated: string }>>`SELECT CAST(updated_date AS TEXT) AS updated FROM board_post WHERE id = 1`;
  const restore = await app.inject({
    method: 'POST', url: `${historyPath}/${restoreId}/restore`,
    headers: { ...writerHeaders, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ expected_updated_date: current[0]!.updated }).toString(),
  });
  assert.equal(restore.statusCode, 303, restore.body);
  assert.match(restore.headers.location ?? '', /restored=1/);
  const restoredHistory = await app.inject({ url: restore.headers.location, headers: writerHeaders });
  assert.match(restoredHistory.body, /이 기록으로 복원했습니다\./);

  const afterRestore = await db.$queryRaw<Array<{ updated: string; title: string }>>`
    SELECT CAST(updated_date AS TEXT) AS updated, title FROM board_post WHERE id = 1
  `;
  assert.equal(afterRestore[0]?.title, 'Existing');
  const remove = await app.inject({
    method: 'POST', url: `${historyPath}/${restoreId}/delete`,
    headers: { ...writerHeaders, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ confirm_delete: 'yes', expected_updated_date: afterRestore[0]!.updated }).toString(),
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
    payload: { title: 'Draft from API', content: '# Private draft', content_type: 'markdown', tags: 'draft,notes' },
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
      title: 'Draft from API', url: slug, content_html: '<h1>Private draft</h1>', tag: 'draft, notes',
      meta_description: 'Private draft', cover_layout: 'default', cover_image_position: 'right',
      cover_image_ratio: 'auto', block_comment: 'false',
    },
  });
  assert.deepEqual(saveDraft.json(), { status: 'DONE', body: { url: slug } });
  const preview = await app.inject({ url: `/write/preview/${slug}`, headers: writerHeaders });
  assert.equal(preview.statusCode, 200, preview.body);

  const publish = await app.inject({
    method: 'POST', url: '/v1/posts', headers: { ...writerHeaders, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({
      draft_url: slug, title: 'Draft published', url: slug,
      text_md: '# Now public\n\nPublished **safely**.', content_type: 'markdown',
      tag: 'live', series: 'learning', block_comment: 'false', cover_layout: 'default',
      cover_image_position: 'right', cover_image_ratio: 'auto',
    }).toString(),
  });
  assert.deepEqual(publish.json(), { status: 'DONE', body: { url: slug } });
  const published = await db.$queryRaw<Array<{ published: string | null; title: string }>>`
    SELECT CAST(published_date AS TEXT) AS published, title FROM board_post WHERE url = ${slug}
  `;
  assert.ok(published[0]?.published);
  assert.equal(published[0]?.title, 'Draft published');
});

test('supports schedule cancel and publish-now, and soft-deletes an owned post', async () => {
  const cancel = await app.inject({ method: 'POST', url: '/v1/users/@writer/posts/scheduled/schedule/cancel', headers: writerHeaders });
  assert.deepEqual(cancel.json().body, { url: 'scheduled', status: 'draft' });
  const state = await db.$queryRaw<Array<{ published: string | null }>>`
    SELECT CAST(published_date AS TEXT) AS published FROM board_post WHERE url = 'scheduled'
  `;
  assert.equal(state[0]?.published, null);

  await db.$executeRaw`UPDATE board_post SET published_date = '2099-01-01 00:00:00.000000' WHERE url = 'scheduled'`;
  const publishNow = await app.inject({ method: 'POST', url: '/v1/users/@writer/posts/scheduled/schedule/publish-now', headers: writerHeaders });
  assert.equal(publishNow.json().body.status, 'published');
  const published = await db.$queryRaw<Array<{ published: string | null }>>`
    SELECT CAST(published_date AS TEXT) AS published FROM board_post WHERE url = 'scheduled'
  `;
  assert.ok(published[0]?.published);

  const trashed = await app.inject({ method: 'DELETE', url: '/v1/users/@writer/posts/existing', headers: writerHeaders });
  assert.equal(trashed.json().body.trashed, true);
  const deleted = await db.$queryRaw<Array<{ deleted: string | null }>>`
    SELECT CAST(deleted_date AS TEXT) AS deleted FROM board_post WHERE url = 'existing'
  `;
  assert.ok(deleted[0]?.deleted);
  assert.equal((await app.inject({ url: '/v1/users/@writer/posts/existing?mode=view' })).statusCode, 404);
});

test('exports ID-based PATCH persistence with preserved omissions and stale-write conflicts', async () => {
  await db.$executeRaw`INSERT INTO board_post_tags (post_id, tag_id) VALUES (2, 1)`;
  await db.$executeRaw`UPDATE board_post SET updated_date = '2020-01-02 03:04:05.123456' WHERE id = 2`;
  const before = await db.$queryRaw<Array<{ id: number; updatedAt: string }>>`
    SELECT id, CAST(updated_date AS TEXT) AS updatedAt FROM board_post WHERE id = 2
  `;
  const expected = before[0]!.updatedAt.replace(' ', 'T') + '+00:00';
  const saved = await updateAuthorPost(db, { id: 1, username: 'writer' }, before[0]!.id, {
    title: 'Patched by ID',
  }, expected);
  assert.equal(saved.id, 2);
  assert.equal(saved.url, 'draft-note');

  const preserved = await db.$queryRaw<Array<{ title: string; html: string; seriesId: number | null }>>`
    SELECT post.title, content.content_html AS html, post.series_id AS seriesId
      FROM board_post AS post JOIN board_postcontent AS content ON content.post_id = post.id
     WHERE post.id = 2
  `;
  assert.equal(preserved[0]?.title, 'Patched by ID');
  assert.equal(preserved[0]?.html, '<p>Draft starts here.</p>');
  assert.equal(preserved[0]?.seriesId, 1);
  assert.deepEqual(await db.$queryRaw<Array<{ value: string }>>`
    SELECT tag.value AS value FROM board_tag AS tag
      JOIN board_post_tags AS link ON link.tag_id = tag.id WHERE link.post_id = 2
  `, [{ value: 'legacy-tag' }]);

  await assert.rejects(
    updateAuthorPost(db, { id: 1, username: 'writer' }, 2, { title: 'Stale write' }, expected),
    (error: unknown) => error instanceof PostValidationError && error.errorCode === 'CF',
  );
  const current = await db.$queryRaw<Array<{ title: string }>>`SELECT title FROM board_post WHERE id = 2`;
  assert.equal(current[0]?.title, 'Patched by ID');
});
