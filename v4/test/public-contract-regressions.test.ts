import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { seriesNavigation } from '../src/posts.js';
import { htmlToMarkdown } from '../src/public-discovery/markdown.js';
import {
  createMigratedDatabase, insertRow, seedEditor, seedPost, signIn,
  testCipherKey, testSecretKey, testSiteUrl,
} from './fixtures/migrated-database.js';

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, -1).replace('T', ' ');
const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, -1).replace('T', ' ');

async function publicApp(site: { seo: number; aeo: number } = { seo: 1, aeo: 1 }) {
  const fixture = await createMigratedDatabase();
  const { db } = fixture;
  seedEditor(db, 1, 'writer');
  insertRow(db, 'board_sitesetting', { id: 1, seo_enabled: site.seo, aeo_enabled: site.aeo });
  insertRow(db, 'board_series', { id: 1, owner_id: 1, name: 'Guide', url: 'guide', layout: 'list', hide: 0, created_date: daysAgo(2) });
  seedPost(db, 1, 1, 'part-one', { series_id: 1, title: 'Part one', published_date: daysAgo(3) });
  seedPost(db, 2, 1, 'part-two', { series_id: 1, title: 'Part two', published_date: daysAgo(2) });
  seedPost(db, 3, 1, 'part-three', { series_id: 1, title: 'Part three', published_date: daysAgo(1) });
  seedPost(db, 4, 1, 'hidden-part', { series_id: 1, title: 'Hidden part', published_date: daysAgo(2) });
  db.exec('UPDATE board_postconfig SET hide = 1 WHERE post_id = 4');
  seedPost(db, 5, 1, 'later-part', { series_id: 1, title: 'Later part', published_date: future });
  seedPost(db, 6, 1, 'trashed-part', { series_id: 1, title: 'Trashed part', published_date: daysAgo(2), deleted_date: daysAgo(1) });
  insertRow(db, 'board_staticpage', { id: 1, slug: 'about', title: 'About', content: '<p>About</p>', is_published: 1 });
  const app = await buildApp(fixture.path, testSiteUrl, { secretKey: testSecretKey, cipherKey: testCipherKey }, fixture.mediaRoot);
  await app.ready();
  return { ...fixture, app, async close() { await app.close(); await fixture.cleanup(); } };
}

test('sends the 3.x security headers and moves plain HTTP to the HTTPS site', async () => {
  const fixture = await createMigratedDatabase();
  const site = new URL('https://blex.test');
  const app = await buildApp(fixture.path, site, { secretKey: testSecretKey, cipherKey: testCipherKey }, fixture.mediaRoot);
  try {
    await app.ready();
    const { headers } = await app.inject({ url: '/robots.txt' });
    assert.equal(headers['x-frame-options'], 'DENY');
    assert.equal(headers['x-content-type-options'], 'nosniff');
    assert.equal(headers['referrer-policy'], 'same-origin');
    assert.equal(headers['cross-origin-opener-policy'], 'same-origin');
    assert.equal(headers['strict-transport-security'], 'max-age=31536000');
    const plain = await app.inject({ url: '/tags?page=2', headers: { 'x-forwarded-proto': 'http' } });
    assert.equal(plain.statusCode, 301);
    assert.equal(plain.headers.location, 'https://blex.test/tags?page=2');
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});

test('shows the public series path on a post', async () => {
  const fixture = await publicApp();
  try {
    const { body, statusCode } = await fixture.app.inject('/@writer/part-two');
    assert.equal(statusCode, 200);
    assert.match(body, /2 \/ 3/);
    assert.match(body, /읽는 중/);
    assert.ok(body.includes('href="/@writer/part-one"'));
    assert.ok(body.includes('href="/@writer/part-three"'));
    assert.ok(body.includes('href="/@writer/series/guide"'));
    for (const excluded of ['Hidden part', 'Later part', 'Trashed part']) assert.ok(!body.includes(excluded), excluded);
  } finally {
    await fixture.close();
  }
});

test('tells the author when a hidden post is outside the series list', async () => {
  const fixture = await publicApp();
  try {
    const { body, statusCode } = await fixture.app.inject({ url: '/@writer/hidden-part', headers: signIn(fixture.db, 1) });
    assert.equal(statusCode, 200);
    assert.match(body, /시리즈 목록에 표시되지 않습니다/);
    assert.ok(!body.includes('Part one'));
  } finally {
    await fixture.close();
  }
});

test('keeps the 3.x five-post series window around the current post', () => {
  const posts = Array.from({ length: 9 }, (_, index) => ({ id: index + 1, url: `p${index + 1}`, title: `P${index + 1}` }));
  const window = (id: number) => seriesNavigation(posts, id)?.entries.map((entry) => entry.index);
  assert.deepEqual(window(1), [1, 2, 3, 4, 5]);
  assert.deepEqual(window(3), [1, 2, 3, 4, 5]);
  assert.deepEqual(window(5), [3, 4, 5, 6, 7]);
  assert.deepEqual(window(7), [5, 6, 7, 8, 9]);
  assert.deepEqual(window(9), [5, 6, 7, 8, 9]);
  assert.equal(seriesNavigation(posts, 1)?.previous, null);
  assert.equal(seriesNavigation(posts, 9)?.next, null);
  assert.equal(seriesNavigation(posts, 99), null);
});

test('marks non-HTML public responses noindex when search indexing is off', async () => {
  const closed = await publicApp({ seo: 0, aeo: 1 });
  try {
    for (const url of ['/llms.txt', '/rss', '/@writer/part-one.md', '/@writer/part-one', '/']) {
      const response = await closed.app.inject(url);
      assert.equal(response.statusCode, 200, url);
      assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow', url);
    }
  } finally {
    await closed.close();
  }
  const open = await publicApp({ seo: 1, aeo: 1 });
  try {
    for (const url of ['/llms.txt', '/rss', '/@writer/part-one.md', '/@writer/part-one']) {
      assert.equal((await open.app.inject(url)).headers['x-robots-tag'], undefined, url);
    }
  } finally {
    await open.close();
  }
});

test('advertises Markdown for series and static pages only when AEO is on', async () => {
  const enabled = await publicApp({ seo: 1, aeo: 1 });
  try {
    for (const path of ['/@writer/series/guide', '/static/about']) {
      const response = await enabled.app.inject(path);
      const markdown = `${testSiteUrl.origin}${path}.md`;
      assert.equal(response.statusCode, 200, path);
      assert.ok(String(response.headers.link).includes(`<${markdown}>; rel="alternate"; type="text/markdown"`), path);
      assert.ok(String(response.headers.link).includes(`<${testSiteUrl.origin}/llms.txt>; rel="llms-txt"`), path);
      assert.equal(response.headers['x-llms-txt'], `${testSiteUrl.origin}/llms.txt`);
      assert.match(response.body, /<link rel="alternate" type="text\/markdown"/);
      assert.equal((await enabled.app.inject(`${path}.md`)).statusCode, 200, `${path}.md`);
    }
  } finally {
    await enabled.close();
  }
  const disabled = await publicApp({ seo: 1, aeo: 0 });
  try {
    const response = await disabled.app.inject('/@writer/series/guide');
    assert.equal(response.headers.link, undefined);
    assert.equal(response.headers['x-llms-txt'], undefined);
    assert.doesNotMatch(response.body, /type="text\/markdown"/);
  } finally {
    await disabled.close();
  }
});

test('advertises RSS feeds on listing and author pages unless SEO is off', async () => {
  const open = await publicApp({ seo: 1, aeo: 0 });
  try {
    const home = await open.app.inject('/');
    assert.match(home.body, /<link rel="alternate" type="application\/rss\+xml"[^>]+href="http:\/\/site\.test\/rss"/);
    for (const path of ['/@writer', '/@writer/posts', '/@writer/series', '/@writer/series/guide']) {
      assert.ok((await open.app.inject(path)).body.includes('href="http://site.test/rss/@writer"'), path);
    }
  } finally {
    await open.close();
  }
  const closed = await publicApp({ seo: 0, aeo: 0 });
  try {
    assert.doesNotMatch((await closed.app.inject('/@writer')).body, /application\/rss\+xml/);
  } finally {
    await closed.close();
  }
});

test('serves stored media URLs that contain duplicate slashes without opening private files', async () => {
  const fixture = await publicApp();
  try {
    await mkdir(join(fixture.mediaRoot, 'images/content/2021/10/25'), { recursive: true });
    await writeFile(join(fixture.mediaRoot, 'images/content/2021/10/25/legacy.png'), 'legacy-image');
    await mkdir(join(fixture.mediaRoot, '_work_logs'), { recursive: true });
    await writeFile(join(fixture.mediaRoot, '_work_logs/private.png'), 'private');
    const image = await fixture.app.inject('/resources/media/images/content/2021/10/25//legacy.png');
    assert.equal(image.statusCode, 200);
    assert.equal(image.body, 'legacy-image');
    for (const path of ['/resources/media//_work_logs/private.png', '/resources/media/_work_logs//private.png']) {
      assert.equal((await fixture.app.inject(path)).statusCode, 404, path);
    }
  } finally {
    await fixture.close();
  }
});

test('serves the legacy deleted-user image', async () => {
  const fixture = await publicApp();
  try {
    assert.equal((await fixture.app.inject('/resources/assets/images/ghost.jpg')).statusCode, 200);
    assert.equal((await fixture.app.inject('/resources/assets/images/other.jpg')).statusCode, 404);
  } finally {
    await fixture.close();
  }
});

test('keeps the 3.x search and feed metadata on public posts', async () => {
  const open = await publicApp({ seo: 1, aeo: 0 });
  try {
    const { body } = await open.app.inject('/@writer/part-one');
    const robots = 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
    assert.ok(body.includes(`<meta name="robots" content="${robots}"`));
    assert.ok(body.includes(`<meta name="googlebot" content="${robots}"`));
    assert.ok(body.includes('href="http://site.test/rss"'));
    assert.ok(body.includes('href="http://site.test/rss/@writer"'));
  } finally {
    await open.close();
  }
  const closed = await publicApp({ seo: 0, aeo: 0 });
  try {
    const { body } = await closed.app.inject('/@writer/part-one');
    assert.ok(body.includes('<meta name="robots" content="noindex,nofollow"'));
    assert.doesNotMatch(body, /application\/rss\+xml/);
  } finally {
    await closed.close();
  }
});

test('asks anonymous readers to log in through the shared modal controls', async () => {
  const fixture = await publicApp();
  try {
    seedEditor(fixture.db, 2, 'other');
    seedPost(fixture.db, 7, 2, 'other-post', { title: 'Other post', published_date: daysAgo(1) });
    insertRow(fixture.db, 'board_comment', { id: 1, post_id: 7, author_id: 1, text_md: 'c', text_html: 'c', created_date: daysAgo(1) });
    const post = (await fixture.app.inject('/@other/other-post')).body;
    for (const action of ['subscribe', 'like', 'comment', 'reply']) assert.match(post, new RegExp(`data-blex-login-prompt="${action}"`), action);
    assert.ok(post.includes('data-blex-login-next="/@other/other-post"'));
    assert.doesNotMatch(post, /action%3D|로그인하고 (구독|좋아요|답글)/);
    const author = (await fixture.app.inject('/@other')).body;
    assert.match(author, /data-blex-login-prompt="subscribe"/);
    assert.doesNotMatch(author, /로그인하고 새 글 구독/);
    assert.match((await fixture.app.inject('/')).body, /data-blex-login-prompt="like"/);
  } finally {
    await fixture.close();
  }
});

test('keeps the stylesheet of an administrator-written static page without its attributes', async () => {
  const fixture = await publicApp();
  try {
    fixture.db.prepare('UPDATE board_staticpage SET content = ? WHERE id = 1').run(
      '<style media="x" onload="bad()">.welcome { color: red; }</style><div class="welcome">Hello</div><script>bad()</script>',
    );
    const { body, statusCode } = await fixture.app.inject('/static/about');
    assert.equal(statusCode, 200);
    assert.ok(body.includes('<style>.welcome { color: red; }</style>'));
    assert.ok(body.includes('<div class="welcome">Hello</div>'));
    assert.doesNotMatch(body, /onload="bad|<script>bad/);
    fixture.db.prepare("UPDATE board_staticpage SET content = ? WHERE id = 1").run('<p onclick="evil()">Safe</p><a href="javascript:evil()">bad</a>');
    assert.doesNotMatch((await fixture.app.inject('/static/about')).body, /onclick=|javascript:evil/);
  } finally {
    await fixture.close();
  }
});

test('renders raw HTML in Markdown with the 3.x whitespace and sorted attributes', () => {
  const html = '<div style="padding: 1px" class="box">\n    <p>Text</p>\n    <pre>  keep\n    this</pre>\n</div>';
  assert.equal(htmlToMarkdown(html), '<div class="box" style="padding: 1px">\n<p>Text</p>\n<pre>  keep\n    this</pre>\n</div>');
  assert.equal(htmlToMarkdown('<blockquote>one\r\ntwo</blockquote>'), '> one\n> two');
  assert.equal(htmlToMarkdown('<pre>one<br>two</pre>'), '```\none\ntwo\n```');
  assert.equal(htmlToMarkdown('<img alt="<ruby> tag" class="x" src="/a.png">'), '<img alt="&lt;ruby&gt; tag" class="x" src="/a.png"/>');
  assert.equal(htmlToMarkdown('<p title=it\'s>one</p><p>two</p>'), 'one\n\ntwo');
  const started = Date.now();
  htmlToMarkdown('<br \'"><br \'>'.repeat(40_000));
  assert.ok(Date.now() - started < 3_000, 'unbalanced quotes must not make parsing quadratic');
});

test('shows public yearly and recent activity on the author page', async () => {
  const fixture = await publicApp();
  try {
    seedEditor(fixture.db, 2, 'reader');
    insertRow(fixture.db, 'board_comment', { id: 1, post_id: 1, author_id: 1, text_md: 'c', text_html: 'c', created_date: daysAgo(1) });
    insertRow(fixture.db, 'board_comment', { id: 2, post_id: 4, author_id: 1, text_md: 'c', text_html: 'c', created_date: daysAgo(1) });
    insertRow(fixture.db, 'board_post_likes', { post_id: 3, user_id: 1, created_date: daysAgo(1) });
    const { body, statusCode } = await fixture.app.inject('/@writer');
    assert.equal(statusCode, 200);
    assert.match(body, /연간 활동/);
    assert.match(body, /활동 내역/);
    assert.match(body, /지난 1년 활동/);
    assert.match(body, /data-heatmap-days=/);
    for (const label of ['새 포스트를 작성했어요', '시리즈를 만들었어요', '댓글을 남겼어요', '좋아요를 눌렀어요']) assert.ok(body.includes(label), label);
    for (const excluded of ['Hidden part', 'Later part', 'Trashed part']) assert.ok(!body.includes(excluded), excluded);
  } finally {
    await fixture.close();
  }
});
