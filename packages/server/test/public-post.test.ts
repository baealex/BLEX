import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { createMigratedTables } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-test-'));
const databasePath = join(directory, 'Django posts.sqlite3');
const legacySlug = 'a'.repeat(69);
const database = new DatabaseSync(databasePath);
createMigratedTables(database, 'StaticPage', 'SiteBanner');
database.exec(`
  CREATE TABLE auth_user (id INTEGER PRIMARY KEY, username TEXT, password TEXT);
  CREATE TABLE board_profile (user_id INTEGER PRIMARY KEY, avatar TEXT);
  CREATE TABLE board_usernamechangelog (id INTEGER PRIMARY KEY, user_id INTEGER, username TEXT);
  CREATE TABLE board_post (
    id INTEGER PRIMARY KEY, author_id INTEGER, url TEXT, title TEXT, meta_description TEXT,
    published_date DATETIME, deleted_date DATETIME, subtitle TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '',
    updated_date DATETIME NOT NULL DEFAULT '2000-01-01 10:04:02', series_id INTEGER, read_time INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE board_postconfig (id INTEGER PRIMARY KEY, post_id INTEGER UNIQUE, hide BOOLEAN,
    cover_layout TEXT NOT NULL DEFAULT 'default', cover_image_ratio TEXT NOT NULL DEFAULT 'auto', cover_image_position TEXT NOT NULL DEFAULT 'right');
  CREATE TABLE board_postcontent (id INTEGER PRIMARY KEY, post_id INTEGER UNIQUE, content_html TEXT);
  CREATE TABLE board_sitesetting (id INTEGER PRIMARY KEY, site_name TEXT, aeo_enabled BOOLEAN, seo_enabled BOOLEAN,
    logo_svg TEXT, logo_svg_dark TEXT, icon_manifest TEXT);
  CREATE TABLE board_series (id INTEGER PRIMARY KEY, name TEXT, url TEXT, hide BOOLEAN, owner_id INTEGER);
  CREATE TABLE board_post_tags (post_id INTEGER, tag_id INTEGER);
  CREATE TABLE board_tag (id INTEGER PRIMARY KEY, value TEXT);
  INSERT INTO auth_user VALUES (7, 'writer', 'test-only-password'), (8, 'other-writer', 'test-only-password');
  INSERT INTO board_usernamechangelog VALUES (1, 7, 'old-writer');
  INSERT INTO board_post (id, author_id, url, title, meta_description, published_date, deleted_date) VALUES
    (1, 7, 'public', 'Public article', 'Public description', '2000-01-01 10:04:02.123456', NULL),
    (2, 7, 'hidden', 'Hidden article', '', '2000-01-01 10:04:02', NULL),
    (3, 7, 'scheduled', 'Scheduled article', '', '9999-01-01 10:04:02', NULL),
    (4, 7, 'draft', 'Draft article', '', NULL, NULL),
    (5, 7, 'trashed', 'Trashed article', '', '2000-01-01 10:04:02', '2000-02-01 10:04:02'),
    (6, 7, 'no-config', 'No config', '', '2000-01-01 10:04:02', NULL),
    (7, 7, '${legacySlug}', 'Long legacy URL', '', '2000-01-01 10:04:02', NULL);
  INSERT INTO board_postconfig (id, post_id, hide) VALUES (1, 1, 0), (2, 2, 1), (3, 3, 0), (4, 4, 0), (5, 5, 0), (7, 7, 0);
  INSERT INTO board_sitesetting VALUES (1, 'Synthetic Site', 1, 0, 'brand/logo/default/hash/logo.svg', '', '{"ico":"brand/icon/default/hash/favicon.ico"}');
  INSERT INTO SiteBanner (id, userId, isActive, type, position, contentHtml, scope, "order", createdAt, updatedAt) VALUES
    (1, NULL, 1, 'horizontal', 'top', '<p>Global banner</p>', 'global', 0, 946684800000, 946684800000),
    (2, 7, 1, 'sidebar', 'right', '<p>Author banner</p>', 'user', 0, 946684800000, 946684800000),
    (3, 8, 1, 'sidebar', 'right', '<p>Other banner</p>', 'user', 1, 946684800000, 946684800000),
    (4, NULL, 0, 'sidebar', 'left', '<p>Inactive banner</p>', 'global', 1, 946684800000, 946684800000);
  INSERT INTO board_tag VALUES (1, 'example-tag');
  INSERT INTO StaticPage (id, title, slug, isPublished, showInFooter, "order", updatedAt) VALUES
    (1, 'Footer link', 'in-footer', 1, 1, 0, 946684800000), (2, 'Private footer link', 'not-in-footer', 0, 1, 1, 946684800000);
  INSERT INTO board_post_tags VALUES (1, 1);
  UPDATE board_post SET subtitle = 'About the article', image = 'images/cover.png' WHERE id = 1;
  UPDATE board_postconfig SET cover_layout = 'split', cover_image_ratio = '4:3', cover_image_position = 'left' WHERE post_id = 1;
  INSERT INTO board_postcontent VALUES
    (1, 1, '<p>Public article body</p><script>discard this</script>'),
    (2, 2, '<p>Private article body</p>'),
    (7, 7, '<h2 id="section">Section</h2><img data-src="/resources/media/image.png" alt="An image">'
      || '<h3>같은 제목</h3><h3>같은 제목</h3>'
      || '<video controls><source data-src="/resources/media/video.mp4" type="video/mp4"></video>'
      || '<iframe src="https://www.youtube-nocookie.com/embed/Example_01"></iframe>'
      || '<iframe src="https://example.invalid/embed/Unknown"></iframe>');
`);
database.close();

const originalFile = await readFile(databasePath);
const app = await buildApp(databasePath, new URL('https://blog.example'));

test.after(async () => {
  await app.close();
  await rm(directory, { recursive: true });
});

test('serves the shared application entry in read-only mode', async () => {
  const redirect = await app.inject('/assets/blex/app.js');
  assert.equal(redirect.statusCode, 302);
  const location = redirect.headers.location;
  assert.ok(location && location.startsWith('/assets/ui/'));
  const asset = await app.inject(location);
  assert.equal(asset.statusCode, 200);
  assert.match(String(asset.headers['content-type']), /javascript/);
  assert.match(String(asset.headers['cache-control']), /immutable/);
});

test('does not expose a GraphQL endpoint', async () => {
  for (const url of ['/graphql', '/graphiql']) {
    assert.equal((await app.inject(url)).statusCode, 404, url);
    const response = await app.inject({ method: 'POST', url, payload: { query: '{ __schema { queryType { name } } }' } });
    assert.equal(response.statusCode, 404, url);
  }
  const page = await app.inject({ url: '/graphql', headers: { accept: 'text/html' } });
  assert.equal(page.statusCode, 404);
  assert.match(String(page.headers['content-type']), /^text\/html/);
});

test('hides posts that are not public from public pages', async () => {
  for (const slug of ['hidden', 'scheduled', 'draft', 'trashed', 'missing']) {
    assert.equal((await app.inject(`/@writer/${slug}`)).statusCode, 404, slug);
    assert.equal((await app.inject(`/@old-writer/${slug}`)).statusCode, 404, slug);
  }

  assert.equal((await app.inject('/@someone-else/public')).statusCode, 404);
});

test('redirects previous public post links and preserves direct reads for older posts without settings', async () => {
  const redirect = await app.inject('/@old-writer/public');
  assert.equal(redirect.statusCode, 302);
  assert.equal(redirect.headers.location, '/@writer/public');
  assert.equal((await app.inject('/@writer/no-config')).statusCode, 200);
  assert.equal((await app.inject('/@old-writer/no-config')).statusCode, 404);
});

test('accepts long legacy slugs and renders stored image, video, and supported embed sources', async () => {
  const response = await app.inject(`/@writer/${legacySlug}`);
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /<h2 id="section">Section<\/h2>/);
  assert.match(response.body, /<h3 id="같은-제목">같은 제목<\/h3><h3 id="같은-제목-1">같은 제목<\/h3>/);
  assert.match(response.body, /href="#section"[^>]*>Section<\/a>/);
  assert.match(response.body, /<img[^>]+src="\/resources\/media\/image\.png"[^>]+loading="lazy"/);
  assert.match(response.body, /<source[^>]+src="\/resources\/media\/video\.mp4"/);
  assert.match(response.body, /src="https:\/\/www\.youtube-nocookie\.com\/embed\/Example_01"/);
  assert.doesNotMatch(response.body, /example\.invalid\/embed\/Unknown|data-src/);
});

test('includes the body and share metadata in the initial React HTML response', async () => {
  const response = await app.inject('/@writer/public');
  assert.equal(response.statusCode, 200, response.body);
  assert.match(response.headers['content-type'] ?? '', /^text\/html/);
  assert.match(response.body, /<h1[^>]*>Public article<\/h1>/);
  assert.match(response.body, /<p>Public article body<\/p>/);
  assert.match(response.body, /property="og:url" content="https:\/\/blog\.example\/@writer\/public"/);
  const jsonLd = response.body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(jsonLd);
  const article = JSON.parse(jsonLd);
  assert.equal(article['@type'], 'BlogPosting');
  assert.equal(article.mainEntityOfPage['@id'], 'https://blog.example/@writer/public');
  assert.equal(article.headline, 'Public article');
  assert.match(response.body, /Public article - writer \| Synthetic Site/);
  assert.match(response.body, /href="\/resources\/media\/brand\/icon\/default\/hash\/favicon\.ico"/);
  assert.match(response.body, /aria-label="Synthetic Site"><img src="\/resources\/media\/brand\/logo\/default\/hash\/logo\.svg"/);
  assert.match(response.body, /name="robots" content="noindex,nofollow"/);
  assert.match(response.body, /post-cover-split[^\"]*cover-left/);
  assert.match(response.body, /blog-post-content[^\"]*" itemProp="articleBody"|blog-post-content[^\"]*" itemprop="articleBody"/);
  assert.match(response.body, /post-action-dock/);
  assert.match(response.body, /href="\/assets\/blex\/theme\.css"/);
  assert.match(response.body, /property="og:image" content="https:\/\/blog\.example\/resources\/media\/images\/cover\.png"/);
  assert.match(response.body, /aspect-ratio:4 \/ 3/);
  assert.match(response.body, /Global banner.*Public article body.*#<\/span>example-tag/);
  assert.match(response.body, /Author banner/);
  assert.match(response.body, /href="\/static\/in-footer"[^>]*>Footer link/);
  assert.doesNotMatch(response.body, /Other banner|Inactive banner|Private footer link/);
  assert.match(String(response.headers.link ?? ''), /public\.md.*llms\.txt/);
  assert.doesNotMatch(response.body, /<script>discard|discard this/);
  assert.deepEqual(await readFile(databasePath), originalFile);
});

test('serves the default branding at its legacy resource URLs', async () => {
  for (const [path, type] of [['/resources/logob.svg', 'svg'], ['/resources/logo512.png', 'png']]) {
    const icon = await app.inject(path);
    assert.equal(icon.statusCode, 200, path);
    assert.match(icon.headers['content-type'] ?? '', new RegExp(type));
  }
  assert.equal((await app.inject('/resources/non-public.sqlite3')).statusCode, 404);
});

test('requires the BLEX 4 schema before starting in writable mode', async () => {
  const unprepared = await buildApp(databasePath, new URL('https://blog.example'), {
    secretKey: 'synthetic-startup-test', cipherKey: '0123456789abcdef0123456789abcdef',
  });
  try {
    await assert.rejects(async () => { await unprepared.ready(); }, /Apply the Prisma migrations.*BLEX 3\.x upgrade guide/);
  } finally {
    await unprepared.close();
  }
});
