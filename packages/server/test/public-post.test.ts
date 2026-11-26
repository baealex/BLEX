import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { buildApp } from '../src/app.js';
import { accountTables, createMigratedTables, migratedTableSql } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-test-'));
const databasePath = join(directory, 'synthetic posts.sqlite3');
const legacySlug = 'a'.repeat(69);
const database = new DatabaseSync(databasePath);
createMigratedTables(database, 'StaticPage', 'SiteBanner', 'SiteSetting');
database.exec(`
  ${migratedTableSql(...accountTables)}
${migratedTableSql('Post', 'PostContent', 'Tag', '_PostToTag', 'PostRevision', 'PostLike', 'PinnedPost', 'PostShareLink', 'PostShareDailyCount', 'ScheduledPublication')}


  ${migratedTableSql('Series')}


  INSERT INTO "User" ("id", "username", "passwordHash", "email", "joinedAt") VALUES
    (7, 'writer', 'test-only-password', '', 1577836800000),
    (8, 'other-writer', 'test-only-password', '', 1577836800000);
  INSERT INTO "UsernameChange" ("id", "userId", "username", "createdAt") VALUES
    (1, 7, 'old-writer', 1577836800000);
  INSERT INTO "Post" ("id", "authorId", "slug", "title", "description", "publishedAt", "deletedAt", "createdAt", "updatedAt") VALUES
    (1, 7, 'public', 'Public article', 'Public description', 946721042123, NULL, 946684800000, 946684800000),
    (2, 7, 'hidden', 'Hidden article', '', 946721042000, NULL, 946684800000, 946684800000),
    (3, 7, 'scheduled', 'Scheduled article', '', 253370801042000, NULL, 946684800000, 946684800000),
    (4, 7, 'draft', 'Draft article', '', NULL, NULL, 946684800000, 946684800000),
    (5, 7, 'trashed', 'Trashed article', '', 946721042000, 949399442000, 946684800000, 946684800000),
    (6, 7, 'no-config', 'No config', '', 946721042000, NULL, 946684800000, 946684800000),
    (7, 7, '${legacySlug}', 'Long legacy URL', '', 946721042000, NULL, 946684800000, 946684800000);
  UPDATE "Post" SET isHidden = 0 WHERE id = 1;
    UPDATE "Post" SET isHidden = 1 WHERE id = 2;
    UPDATE "Post" SET isHidden = 0 WHERE id = 3;
    UPDATE "Post" SET isHidden = 0 WHERE id = 4;
    UPDATE "Post" SET isHidden = 0 WHERE id = 5;
    UPDATE "Post" SET isHidden = 0 WHERE id = 7;
  INSERT INTO SiteSetting (id, siteName, aeoEnabled, seoEnabled, logoSvg, iconManifest, updatedAt) VALUES (1, 'Synthetic Site', 1, 0, 'brand/logo/default/hash/logo.svg', '{"ico":"brand/icon/default/hash/favicon.ico"}', 946684800000);
  INSERT INTO SiteBanner (id, userId, isActive, type, position, contentHtml, scope, "order", createdAt, updatedAt) VALUES
    (1, NULL, 1, 'horizontal', 'top', '<p onclick="evil()">Global banner</p><script>alert(1)</script>', 'global', 0, 946684800000, 946684800000),
    (2, 7, 1, 'sidebar', 'right', '<p>Author banner</p>', 'user', 0, 946684800000, 946684800000),
    (3, 8, 1, 'sidebar', 'right', '<p>Other banner</p>', 'user', 1, 946684800000, 946684800000),
    (4, NULL, 0, 'sidebar', 'left', '<p>Inactive banner</p>', 'global', 1, 946684800000, 946684800000);
  INSERT INTO "Tag" ("id", "name") VALUES
    (1, 'example-tag');
  INSERT INTO StaticPage (id, title, slug, isPublished, showInFooter, "order", updatedAt) VALUES
    (1, 'Footer link', 'in-footer', 1, 1, 0, 946684800000), (2, 'Private footer link', 'not-in-footer', 0, 1, 1, 946684800000);
  INSERT INTO "_PostToTag" ("A", "B") VALUES
    (1, 1);
  UPDATE "Post" SET subtitle = 'About the article', image = 'images/cover.png' WHERE id = 1;
  UPDATE "Post" SET coverLayout = 'split', coverImageRatio = '4:3', coverImagePosition = 'left' WHERE id = 1;
  INSERT INTO "PostContent" ("postId", "html") VALUES
    (1, '<p>Public article body</p><script>discard this</script>'),
    (2, '<p>Private article body</p>'),
    (7, '<h2 id="section">Section</h2><img data-src="/resources/media/image.png" alt="An image">'
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
  assert.ok(location);
  assert.ok(location.startsWith('/assets/ui/'));
  const asset = await app.inject(location);
  assert.equal(asset.statusCode, 200);
  assert.match(String(asset.headers['content-type']), /javascript/);
  assert.match(String(asset.headers['cache-control']), /immutable/);
});

test('applies the reader theme before the stylesheet paints', async () => {
  const page = await app.inject('/@writer/public');
  // A classic script ahead of the stylesheet runs before the first paint; the theme module runs after it.
  assert.match(
    page.body,
    /<script src="\/assets\/blex\/theme-init\.js"><\/script><link rel="stylesheet" href="\/assets\/blex\/theme\.css"/,
  );
  const script = await app.inject('/assets/blex/theme-init.js');
  assert.equal(script.statusCode, 200);
  assert.match(String(script.headers['content-type']), /javascript/);
  assert.equal(script.headers['cache-control'], 'no-cache');
  const run = (cookie: string, systemDark: boolean) => {
    const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    runInNewContext(script.body, {
      document: { cookie, documentElement: root },
      matchMedia: (query: string) => ({ matches: systemDark && query === '(prefers-color-scheme: dark)' }),
    });
    return [root.dataset.theme, root.style.colorScheme, root.dataset.themePreference];
  };
  // The preference stays for the site script, which records it once it runs.
  assert.deepEqual(run('', true), ['dark', 'dark', undefined]);
  assert.deepEqual(run('', false), ['light', 'light', undefined]);
  assert.deepEqual(run('other=1; blex_theme=light', true), ['light', 'light', undefined]);
  assert.deepEqual(run('blex_theme=dark; other=1', false), ['dark', 'dark', undefined]);
  assert.deepEqual(run('not_blex_theme=dark', false), ['light', 'light', undefined]);
});

test('does not expose a GraphQL endpoint', async () => {
  for (const url of ['/graphql', '/graphiql']) {
    assert.equal((await app.inject(url)).statusCode, 404, url);
    const response = await app.inject({
      method: 'POST',
      url,
      payload: { query: '{ __schema { queryType { name } } }' },
    });
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

test('redirects previous public post links, including posts imported without a settings row', async () => {
  const redirect = await app.inject('/@old-writer/public');
  assert.equal(redirect.statusCode, 302);
  assert.equal(redirect.headers.location, '/@writer/public');
  assert.equal((await app.inject('/@writer/no-config')).statusCode, 200);
  const imported = await app.inject('/@old-writer/no-config');
  assert.equal(imported.statusCode, 302);
  assert.equal(imported.headers.location, '/@writer/no-config');
});

test('accepts long legacy slugs and renders stored image, video, and supported embed sources', async () => {
  const response = await app.inject(`/@writer/${legacySlug}`);
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /<h2 id="section">Section<\/h2>/);
  assert.match(response.body, /<h3 id="같은-제목">같은 제목<\/h3><h3 id="같은-제목-1">같은 제목<\/h3>/);
  assert.match(response.body, /href="#section"[^>]*>Section<\/a>/);
  // The contents sheet and the mobile menu are named by their headings for screen readers.
  assert.match(response.body, /<dialog id="post-toc" aria-labelledby="post-toc-title"/);
  assert.match(response.body, /<h2 id="post-toc-title"/);
  assert.match(response.body, /<dialog id="blex-mobile-menu" aria-labelledby="blex-mobile-menu-title"/);
  assert.match(response.body, /id="blex-mobile-menu-title"/);
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
  assert.match(response.body, /<img src="\/resources\/media\/brand\/logo\/default\/hash\/logo\.svg"/);
  assert.match(response.body, /name="robots" content="noindex,nofollow"/);
  assert.match(response.body, /post-cover-split[^\"]*cover-left/);
  assert.match(response.body, /href="\/assets\/blex\/theme\.css"/);
  assert.match(
    response.body,
    /property="og:image" content="https:\/\/blog\.example\/resources\/media\/images\/cover\.png"/,
  );
  assert.match(response.body, /aspect-ratio:4 \/ 3/);
  assert.match(response.body, /Global banner/);
  assert.match(response.body, /example-tag/);
  assert.match(response.body, /Author banner/);
  assert.doesNotMatch(response.body, /onclick="evil|alert\(1\)/);
  assert.match(response.body, /href="\/static\/in-footer"[^>]*>Footer link/);
  assert.doesNotMatch(response.body, /Other banner|Inactive banner|Private footer link/);
  assert.match(String(response.headers.link ?? ''), /public\.md.*llms\.txt/);
  assert.doesNotMatch(response.body, /<script>discard|discard this/);
  assert.deepEqual(await readFile(databasePath), originalFile);
});

test('serves the default branding at its legacy resource URLs', async () => {
  for (const [path, type] of [
    ['/resources/logob.svg', 'svg'],
    ['/resources/logo512.png', 'png'],
  ]) {
    const icon = await app.inject(path);
    assert.equal(icon.statusCode, 200, path);
    assert.match(icon.headers['content-type'] ?? '', new RegExp(type));
  }
  assert.equal((await app.inject('/resources/non-public.sqlite3')).statusCode, 404);
});

test('requires the BLEX 4 schema before starting in writable mode', async () => {
  const unprepared = await buildApp(databasePath, new URL('https://blog.example'), {
    secretKey: 'synthetic-startup-test',
    cipherKey: '0123456789abcdef0123456789abcdef',
  });
  try {
    await assert.rejects(async () => {
      await unprepared.ready();
    }, /Apply the Prisma migrations.*BLEX 3\.x upgrade guide/);
  } finally {
    await unprepared.close();
  }
});
