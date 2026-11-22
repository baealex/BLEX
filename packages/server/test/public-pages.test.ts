import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import test from 'node:test';
import { registerPublicPages } from '../src/public-pages/index.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-public-pages-'));
const databasePath = join(directory, 'Django public pages.sqlite3');
const database = new DatabaseSync(databasePath);
database.exec(`
  CREATE TABLE auth_user (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    first_name TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT 1
  );
  CREATE TABLE board_usernamechangelog (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    created_date DATETIME NOT NULL
  );
  CREATE TABLE board_profile (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    cover TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT '',
    homepage TEXT NOT NULL DEFAULT '',
    about_md TEXT NOT NULL DEFAULT '',
    about_html TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'READER'
  );
  CREATE TABLE board_userlinkmeta (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    created_date DATETIME NOT NULL,
    updated_date DATETIME NOT NULL,
    user_id INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE board_post (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL,
    image TEXT NOT NULL DEFAULT '',
    read_time INTEGER NOT NULL DEFAULT 0,
    created_date DATETIME NOT NULL,
    updated_date DATETIME NOT NULL,
    author_id INTEGER NOT NULL,
    series_id INTEGER,
    meta_description TEXT NOT NULL DEFAULT '',
    published_date DATETIME,
    deleted_date DATETIME
  );
  CREATE TABLE board_postconfig (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, hide BOOLEAN NOT NULL DEFAULT 0);
  CREATE TABLE board_postcontent (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, content_html TEXT NOT NULL DEFAULT '');
  CREATE TABLE board_post_likes (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, created_date DATETIME NOT NULL);
  CREATE TABLE board_comment (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, content TEXT NOT NULL DEFAULT '', author_id INTEGER, created_date DATETIME);
  CREATE TABLE board_series (
    id INTEGER PRIMARY KEY,
    "order" INTEGER NOT NULL DEFAULT 0,
    text_md TEXT NOT NULL DEFAULT '',
    text_html TEXT NOT NULL DEFAULT '',
    hide BOOLEAN NOT NULL DEFAULT 0,
    url TEXT NOT NULL,
    layout TEXT NOT NULL DEFAULT '',
    created_date DATETIME NOT NULL,
    updated_date DATETIME NOT NULL,
    owner_id INTEGER NOT NULL,
    name TEXT NOT NULL
  );
  CREATE TABLE board_tag (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE board_post_tags (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, tag_id INTEGER NOT NULL);
  CREATE TABLE board_pinnedpost (id INTEGER PRIMARY KEY, "order" INTEGER NOT NULL, created_date DATETIME NOT NULL, post_id INTEGER NOT NULL, user_id INTEGER NOT NULL);
  CREATE TABLE board_staticpage (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    meta_description TEXT NOT NULL DEFAULT '',
    is_published BOOLEAN NOT NULL DEFAULT 0,
    show_in_footer BOOLEAN NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_date DATETIME NOT NULL,
    updated_date DATETIME NOT NULL,
    author_id INTEGER,
    slug TEXT NOT NULL
  );
  CREATE TABLE board_sitesetting (
    id INTEGER PRIMARY KEY,
    site_name TEXT NOT NULL,
    logo_svg TEXT NOT NULL DEFAULT '',
    logo_svg_dark TEXT NOT NULL DEFAULT '',
    icon_manifest TEXT NOT NULL DEFAULT '{}',
    seo_enabled BOOLEAN NOT NULL DEFAULT 1,
    aeo_enabled BOOLEAN NOT NULL DEFAULT 0
  );
  CREATE TABLE board_sitenotice (
    id INTEGER PRIMARY KEY,
    scope TEXT NOT NULL,
    user_id INTEGER,
    title TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_date DATETIME NOT NULL,
    updated_date DATETIME NOT NULL,
    url TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE board_authorsubscription (
    id INTEGER PRIMARY KEY,
    created_date DATETIME NOT NULL,
    author_id INTEGER NOT NULL,
    subscriber_id INTEGER NOT NULL,
    UNIQUE(subscriber_id, author_id)
  );

  INSERT INTO auth_user VALUES (1, 'writer', 'Writer', 1), (2, 'reader', 'Reader', 1);
  INSERT INTO board_usernamechangelog VALUES (1, 1, 'old-writer', '2019-01-01 00:00:00');
  INSERT INTO board_profile VALUES
    (1, 1, 'A public author bio', '', 'images/writer.png', 'https://writer.example', '',
      '<p>About the writer <script>window.bad = true</script></p>', 'EDITOR'),
    (2, 2, '', '', '', '', '', '', 'READER');
  INSERT INTO board_userlinkmeta VALUES
    (1, 'GitHub', 'https://github.com/example-writer', '2020-01-01 00:00:00', '2020-01-01 00:00:00', 1, 1),
    (2, 'unsafe', 'javascript:alert(1)', '2020-01-01 00:00:00', '2020-01-01 00:00:00', 1, 2);
  INSERT INTO board_series VALUES
    (1, 1, 'First series description', '<p>First series description</p>', 0, 'public-series', '',
     '2020-01-01 00:00:00', '2020-01-02 00:00:00', 1, 'Public series'),
    (2, 2, 'Second series description', '<p>Second series description</p>', 0, 'other-series', '',
     '2020-01-03 00:00:00', '2020-01-04 00:00:00', 1, 'Other series'),
    (3, 3, 'Hidden series', '<p>Hidden series</p>', 1, 'hidden-series', '',
     '2020-01-01 00:00:00', '2020-01-01 00:00:00', 1, 'Hidden series');
  INSERT INTO board_post VALUES
    (1, 'Public new article', 'A useful subtitle', 'public-new', 'images/public-new.jpg', 4,
     '2020-02-01 00:00:00.123456', '2020-02-01 00:00:00.123456', 1, 1, 'Public description', '2020-02-01 00:00:00.123456', NULL),
    (2, 'Public older article', '', 'public-old', '', 2,
     '2020-01-01 00:00:00', '2020-01-01 00:00:00', 1, 2, '', '2020-01-01 00:00:00', NULL),
    (3, 'Reader public article', '', 'reader-public', '', 1,
     '2020-01-02 00:00:00', '2020-01-02 00:00:00', 2, NULL, '', '2020-01-02 00:00:00', NULL),
    (4, 'Hidden article', '', 'hidden-article', '', 1,
     '2020-01-04 00:00:00', '2020-01-04 00:00:00', 1, NULL, '', '2020-01-04 00:00:00', NULL),
    (5, 'Draft article', '', 'draft-article', '', 1,
     '2020-01-05 00:00:00', '2020-01-05 00:00:00', 1, NULL, '', NULL, NULL),
    (6, 'Scheduled article', '', 'scheduled-article', '', 1,
     '9999-01-01 00:00:00', '9999-01-01 00:00:00', 1, NULL, '', '9999-01-01 00:00:00', NULL),
    (7, 'Deleted article', '', 'deleted-article', '', 1,
     '2020-01-06 00:00:00', '2020-01-06 00:00:00', 1, NULL, '', '2020-01-06 00:00:00', '2020-02-01 00:00:00');
  INSERT INTO board_postconfig VALUES (1, 1, 0), (2, 2, 0), (3, 3, 0), (4, 4, 1), (5, 5, 0), (6, 6, 0), (7, 7, 0);
  INSERT INTO board_post_likes VALUES (1, 1, 2, '2020-02-02 00:00:00');
  INSERT INTO board_postcontent VALUES
    (1, 1, '<p>Orion body text</p>'),
    (2, 2, '<p>Earlier public content</p>'),
    (3, 3, '<p>Reader content</p>'),
    (4, 4, '<p>Private Orion content</p>');
  INSERT INTO board_tag VALUES (1, 'python'), (2, 'private-only'), (3, 'javascript'), (4, 'zebra');
  INSERT INTO board_post_tags VALUES (1, 1, 1), (2, 3, 1), (3, 4, 2), (4, 2, 3), (5, 1, 4);
  INSERT INTO board_staticpage VALUES
    (1, 'Getting started', '<h1>Guide</h1><script>window.bad = true</script><p>Read more.</p>',
     'A short guide', 1, 1, 1, '2020-01-01 00:00:00', '2020-01-02 00:00:00', 1, 'guide'),
    (2, 'Internal page', '<p>Not public</p>', '', 0, 0, 2, '2020-01-01 00:00:00', '2020-01-02 00:00:00', NULL, 'internal');
  INSERT INTO board_pinnedpost VALUES
    (1, 1, '2020-02-02 00:00:00', 1, 1),
    (2, 2, '2020-02-03 00:00:00', 4, 1),
    (3, 3, '2020-02-04 00:00:00', 5, 1);
  INSERT INTO board_sitenotice VALUES
    (1, 'global', NULL, 'Older site notice', 1, 0, '2020-01-01 00:00:00', '2020-01-01 00:00:00', '/news/older'),
    (2, 'global', NULL, 'Newest site notice', 1, 0, '2020-01-02 00:00:00', '2020-01-02 00:00:00', 'https://notice.example/new'),
    (3, 'global', NULL, 'Inactive site notice', 0, 0, '2020-01-03 00:00:00', '2020-01-03 00:00:00', '/news/inactive'),
    (4, 'user', 1, 'First author notice', 1, 1, '2020-01-04 00:00:00', '2020-01-04 00:00:00', '/@writer/about'),
    (5, 'user', 1, 'Second author notice', 1, 2, '2020-01-05 00:00:00', '2020-01-05 00:00:00', '/@writer/posts'),
    (6, 'user', 1, 'Unsafe author notice', 1, 3, '2020-01-06 00:00:00', '2020-01-06 00:00:00', 'javascript:alert(1)'),
    (7, 'user', 2, 'Reader-only notice', 1, 1, '2020-01-07 00:00:00', '2020-01-07 00:00:00', '/@reader');
  INSERT INTO board_authorsubscription VALUES (1, '2020-02-01 00:00:00', 1, 2);
  INSERT INTO board_sitesetting (id, site_name, logo_svg, logo_svg_dark, icon_manifest, seo_enabled)
    VALUES (1, 'BLEX Docs', 'brand/logo/default/synthetic.svg', 'brand/logo/dark/synthetic-dark.svg', '{}', 1);
`);
const bulkPosts = database.prepare(`
  INSERT INTO board_post (
    id, title, subtitle, url, image, read_time, created_date, updated_date,
    author_id, series_id, meta_description, published_date, deleted_date
  ) VALUES (?, ?, '', ?, '', 1, ?, ?, 1, ?, '', ?, NULL)
`);
const publicConfigs = database.prepare('INSERT INTO board_postconfig VALUES (?, ?, 0)');
const publicContents = database.prepare('INSERT INTO board_postcontent VALUES (?, ?, ?)');
for (let index = 1; index <= 25; index += 1) {
  const id = 100 + index;
  const published = `2019-12-${String(index).padStart(2, '0')} 00:00:00.123456`;
  const slug = `archive-post-${String(index).padStart(2, '0')}`;
  bulkPosts.run(id, `Archive post ${index}`, slug, published, published, null, published);
  publicConfigs.run(id, id);
  publicContents.run(id, id, `<p>Archive content ${index}</p>`);
}
for (let index = 1; index <= 10; index += 1) {
  const id = 200 + index;
  const published = `2019-11-${String(index).padStart(2, '0')} 00:00:00.654321`;
  const slug = `series-post-${String(index).padStart(2, '0')}`;
  bulkPosts.run(id, `Series post ${index}`, slug, published, published, 1, published);
  publicConfigs.run(id, id);
  publicContents.run(id, id, `<p>Series content ${index}</p>`);
}
database.close();

const db = new PrismaClient({ datasourceUrl: `file:${databasePath}?connection_limit=1` });
const app = Fastify();
registerPublicPages(app, db, new URL('https://blog.example'), {
  currentUser: async (request) => {
    const user = request.headers['x-test-user'];
    if (user === 'writer') return { id: 1, hasEditorRole: true };
    if (user === 'reader') return { id: 2, hasEditorRole: false };
    return null;
  },
});
await app.ready();

test.after(async () => {
  await app.close();
  await db.$disconnect();
  await rm(directory, { recursive: true });
});

test('renders the public home, tag cloud, and tag posts from visible published rows', async () => {
  const home = await app.inject('/');
  assert.equal(home.statusCode, 200, home.body);
  assert.match(home.body, /Public new article/);
  assert.match(home.body, /Public older article/);
  assert.match(home.body, /Reader public article/);
  assert.match(home.body, /src="\/resources\/media\/brand\/logo\/default\/synthetic\.svg"/);
  assert.match(home.body, /rel="icon" href="\/favicon\.ico"/);
  assert.match(home.body, /Newest site notice/);
  assert.match(home.body, /Older site notice/);
  assert.match(home.body, /data-notice-step="1"/);
  assert.doesNotMatch(home.body, /action="\/like\/public-new"/);
  assert.ok(home.body.indexOf('Newest site notice') < home.body.indexOf('Older site notice'));
  assert.doesNotMatch(home.body, /Inactive site notice|First author notice|Reader-only notice/);
  assert.ok(home.body.indexOf('Public new article') < home.body.indexOf('Public older article'));
  assert.doesNotMatch(home.body, /Hidden article|Draft article|Scheduled article|Deleted article/);
  assert.match(home.body, /rel="canonical" href="https:\/\/blog\.example\/"/);

  const headers = { 'x-test-user': 'reader', cookie: `csrftoken=${'a'.repeat(43)}` };
  const signedIn = await app.inject({ url: '/', headers });
  assert.match(signedIn.body, /action="\/like\/public-new".*?aria-label="좋아요 취소 \(1\)" aria-pressed="true"><svg[^>]*tabler-icon-heart[^>]*>.*?<\/svg><span>1<\/span>/);
  assert.equal(signedIn.headers['cache-control'], 'private, no-store');
  const interests = await app.inject({ url: '/interests', headers });
  assert.match(interests.body, /Public new article/);
  assert.doesNotMatch(interests.body, /Public older article/);

  const secondPage = await app.inject('/?page=2');
  assert.equal(secondPage.statusCode, 200, secondPage.body);
  assert.match(secondPage.body, /Archive post/);
  assert.match(secondPage.body, /rel="canonical" href="https:\/\/blog\.example\/\?page=2"/);
  assert.match(secondPage.body, /rel="prev" href="https:\/\/blog\.example\/"/);

  const tags = await app.inject('/tags');
  assert.equal(tags.statusCode, 200, tags.body);
  assert.match(tags.body, />python</);
  assert.doesNotMatch(tags.body, /private-only/);
  assert.match(tags.body, /2개 포스트에서 태그됨/);
  assert.ok(tags.body.indexOf('>python<') < tags.body.indexOf('>javascript<'));

  const byName = await app.inject('/tags?sort=name');
  assert.ok(byName.body.indexOf('>javascript<') < byName.body.indexOf('>python<'));
  const byRecent = await app.inject('/tags?sort=recent');
  assert.ok(byRecent.body.indexOf('>zebra<') < byRecent.body.indexOf('>javascript<'));

  const detail = await app.inject('/tag/python');
  assert.equal(detail.statusCode, 200, detail.body);
  assert.match(detail.body, /Public new article/);
  assert.match(detail.body, /Reader public article/);
  assert.equal((await app.inject('/tag/private-only')).statusCode, 404);
});

test('keeps tag search and sort usable while marking filtered pages noindex', async () => {
  const response = await app.inject('/tags?q=py&sort=name');
  assert.equal(response.statusCode, 200, response.body);
  assert.match(response.body, />python</);
  assert.match(response.body, /name="robots" content="noindex,follow"/);
  assert.match(response.body, /name="q" value="py"/);
  assert.match(response.body, /name="sort"/);
});

test('site SEO setting applies noindex,nofollow to public pages', async () => {
  await db.$executeRaw`UPDATE board_sitesetting SET seo_enabled = 0 WHERE id = 1`;
  try {
    const home = await app.inject('/');
    assert.match(home.body, /<meta name="robots" content="noindex,nofollow"/);
    assert.match(home.body, /<meta name="googlebot" content="noindex,nofollow"/);

    const filtered = await app.inject('/tags?q=py');
    assert.match(filtered.body, /<meta name="robots" content="noindex,nofollow"/);
    assert.match(filtered.body, /<meta name="googlebot" content="noindex,nofollow"/);
  } finally {
    await db.$executeRaw`UPDATE board_sitesetting SET seo_enabled = 1 WHERE id = 1`;
  }
});

test('searches the initial HTML with relevance and public visibility filters', async () => {
  const response = await app.inject('/search?q=Orion');
  assert.equal(response.statusCode, 200, response.body);
  assert.match(response.body, /Public new article/);
  assert.doesNotMatch(response.body, /Private Orion content|Hidden article/);
  assert.match(response.body, /name="robots" content="noindex,follow"/);
  assert.match(response.body, /rel="canonical" href="https:\/\/blog\.example\/search"/);
});

test('renders author overview and posts and redirects legacy author aliases', async () => {
  const overview = await app.inject('/@writer');
  assert.equal(overview.statusCode, 200, overview.body);
  assert.match(overview.body, /A public author bio/);
  assert.match(overview.body, /About the writer/);
  assert.match(overview.body, /href="https:\/\/github\.com\/example-writer"/);
  assert.doesNotMatch(overview.body, /href="javascript:/);
  assert.doesNotMatch(overview.body, /window\.bad/);
  assert.match(overview.body, /Public new article/);
  assert.match(overview.body, /rel="canonical" href="https:\/\/blog\.example\/@writer"/);

  const posts = await app.inject('/@writer/posts?q=Orion');
  assert.equal(posts.statusCode, 200, posts.body);
  assert.match(posts.body, /Public new article/);
  assert.doesNotMatch(posts.body, /Public older article|Hidden article|Draft article/);
  assert.match(posts.body, /name="robots" content="noindex,follow"/);

  const secondPostsPage = await app.inject('/@writer/posts?page=2');
  assert.equal(secondPostsPage.statusCode, 200, secondPostsPage.body);
  assert.match(secondPostsPage.body, /rel="canonical" href="https:\/\/blog\.example\/@writer\/posts\?page=2"/);
  assert.match(secondPostsPage.body, /rel="prev" href="https:\/\/blog\.example\/@writer\/posts"/);

  const alias = await app.inject('/@old-writer');
  assert.equal(alias.statusCode, 302);
  assert.equal(alias.headers.location, '/@writer');
});

test('renders scoped author notices, safe links, and subscription state', async () => {
  const anonymous = await app.inject('/@writer');
  assert.equal(anonymous.statusCode, 200, anonymous.body);
  assert.match(anonymous.body, /First author notice/);
  assert.match(anonymous.body, /Second author notice/);
  assert.ok(anonymous.body.indexOf('First author notice') < anonymous.body.indexOf('Second author notice'));
  assert.match(anonymous.body, /Unsafe author notice/);
  assert.doesNotMatch(anonymous.body, /Reader-only notice|Newest site notice|Inactive site notice/);
  assert.doesNotMatch(anonymous.body, /href="javascript:/);
  assert.match(anonymous.body, /data-blex-login-prompt="subscribe"/);
  assert.doesNotMatch(anonymous.body, /로그인하고 새 글 구독/);

  const token = 'a'.repeat(43);
  const reader = await app.inject({ url: '/@writer',
    headers: { 'x-test-user': 'reader', cookie: `csrftoken=${token}` },
  });
  assert.equal(reader.statusCode, 200, reader.body);
  assert.match(reader.body, /구독 중<\/button>/);
  assert.match(reader.body, /name="csrfmiddlewaretoken" value="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"/);
  assert.match(reader.body, /name="action" value="unsubscribe"/);
  assert.match(reader.headers['cache-control'] ?? '', /private, no-store/);
  assert.match(reader.headers.vary ?? '', /Cookie/);

  const owner = await app.inject({ url: '/@writer', headers: { 'x-test-user': 'writer' } });
  assert.equal(owner.statusCode, 200, owner.body);
  assert.match(owner.body, /고정 포스트 설정/);
  assert.doesNotMatch(owner.body, /\/subscription"|data-blex-login-prompt="subscribe"/);
  assert.match(owner.headers['cache-control'] ?? '', /private, no-store/);
});

test('serves the exact owner featured-posts partial with public posts only', async () => {
  const fragment = await app.inject('/@writer/partials/featured-posts');
  assert.equal(fragment.statusCode, 200, fragment.body);
  assert.match(fragment.headers['cache-control'] ?? '', /no-store/);
  assert.equal(fragment.headers['x-robots-tag'], 'noindex');
  assert.match(fragment.body, /data-featured-posts-section/);
  assert.match(fragment.body, /data-partial-url="\/@writer\/partials\/featured-posts"/);
  assert.match(fragment.body, /Public new article/);
  assert.doesNotMatch(fragment.body, /Hidden article|Draft article|Scheduled article|Deleted article/);
  assert.doesNotMatch(fragment.body, /Public older article/);

  const owner = await app.inject({ url: '/@writer/partials/featured-posts', headers: { 'x-test-user': 'writer' } });
  assert.match(owner.body, /고정 포스트 설정/);

  const readerAuthor = await app.inject('/@reader/partials/featured-posts');
  assert.equal(readerAuthor.statusCode, 204);
  assert.match(readerAuthor.headers['cache-control'] ?? '', /no-store/);
  assert.equal(readerAuthor.headers['x-robots-tag'], 'noindex');
  assert.equal((await app.inject('/@old-writer/partials/featured-posts')).statusCode, 404);
});

test('reader author post, series, and about pages follow legacy redirects', async () => {
  assert.equal((await app.inject('/@reader/posts')).headers.location, '/@reader/about');
  assert.equal((await app.inject('/@reader/series')).headers.location, '/@reader/about');
  const about = await app.inject('/@reader/about');
  assert.equal(about.statusCode, 302);
  assert.equal(about.headers.location, '/@reader');
});

test('lists only public series and renders public series detail in the selected order', async () => {
  const list = await app.inject('/@writer/series');
  assert.equal(list.statusCode, 200, list.body);
  assert.match(list.body, /Public series/);
  assert.match(list.body, /Other series/);
  assert.doesNotMatch(list.body, /Hidden series/);

  const newest = await app.inject('/@writer/series?sort=newest');
  assert.ok(newest.body.indexOf('Other series') < newest.body.indexOf('Public series'));
  const oldest = await app.inject('/@writer/series?sort=oldest');
  assert.ok(oldest.body.indexOf('Public series') < oldest.body.indexOf('Other series'));
  const mostPosts = await app.inject('/@writer/series?sort=posts');
  assert.ok(mostPosts.body.indexOf('Public series') < mostPosts.body.indexOf('Other series'));
  const filtered = await app.inject('/@writer/series?q=Other');
  assert.match(filtered.body, /Other series/);
  assert.doesNotMatch(filtered.body, /Public series/);
  assert.match(filtered.body, /name="robots" content="noindex,follow"/);

  const detail = await app.inject('/@writer/series/public-series');
  assert.equal(detail.statusCode, 200, detail.body);
  assert.match(detail.body, /Public new article/);
  assert.match(detail.body, /CollectionPage/);
  assert.match(detail.body, /rel="canonical" href="https:\/\/blog\.example\/@writer\/series\/public-series"/);
  assert.match(detail.body, /오래된순/);
  assert.match(detail.body, /최신순/);
  const ascendingSecondPage = await app.inject('/@writer/series/public-series?sort=asc&page=2');
  assert.equal(ascendingSecondPage.statusCode, 200, ascendingSecondPage.body);
  assert.match(ascendingSecondPage.body, /rel="canonical" href="https:\/\/blog\.example\/@writer\/series\/public-series\?sort=asc&amp;page=2"/);
  assert.match(ascendingSecondPage.body, /rel="prev"/);
  const oldSeriesAlias = await app.inject('/@old-writer/series/public-series');
  assert.equal(oldSeriesAlias.statusCode, 302);
  assert.equal(oldSeriesAlias.headers.location, '/@writer/series/public-series');
  assert.equal((await app.inject('/@writer/series/hidden-series')).statusCode, 404);
  assert.equal((await app.inject('/@writer/posts?page=9')).statusCode, 404);
});

test('renders published static pages with safe content and canonical metadata', async () => {
  const response = await app.inject('/static/guide');
  assert.equal(response.statusCode, 200, response.body);
  assert.match(response.body, /<h1>Guide<\/h1>/);
  assert.match(response.body, /A short guide/);
  assert.doesNotMatch(response.body, /window\.bad/);
  assert.match(response.body, /WebPage/);
  assert.match(response.body, /rel="canonical" href="https:\/\/blog\.example\/static\/guide"/);
  assert.equal((await app.inject('/static/internal')).statusCode, 404);
});
