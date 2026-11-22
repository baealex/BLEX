import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import test from 'node:test';
import { registerPublicDiscovery } from '../src/features/discovery/feeds/index.js';
import { createMigratedTables, migratedTableSql } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-discovery-'));
const databasePath = join(directory, 'synthetic legacy.sqlite3');
const fixture = new DatabaseSync(databasePath);
createMigratedTables(fixture, 'StaticPage', 'SiteSetting');
fixture.exec(`
  CREATE TABLE auth_user (id INTEGER PRIMARY KEY, username TEXT, first_name TEXT);
  CREATE TABLE board_usernamechangelog (id INTEGER PRIMARY KEY, user_id INTEGER, username TEXT, created_date DATETIME);
  CREATE TABLE board_profile (id INTEGER PRIMARY KEY, user_id INTEGER, bio TEXT, avatar TEXT, role TEXT);
  CREATE TABLE board_post (
    id INTEGER PRIMARY KEY, author_id INTEGER, url TEXT, title TEXT, subtitle TEXT,
    published_date DATETIME, updated_date DATETIME, deleted_date DATETIME, series_id INTEGER
  );
  CREATE TABLE board_postconfig (id INTEGER PRIMARY KEY, post_id INTEGER, hide BOOLEAN);
  CREATE TABLE board_postcontent (id INTEGER PRIMARY KEY, post_id INTEGER, content_html TEXT);
  CREATE TABLE board_post_tags (id INTEGER PRIMARY KEY, post_id INTEGER, tag_id INTEGER);
  CREATE TABLE board_tag (id INTEGER PRIMARY KEY, value TEXT);
  ${migratedTableSql('Series')}

  INSERT INTO auth_user VALUES (1, 'writer', 'Alex');
  INSERT INTO board_usernamechangelog VALUES (1, 1, 'old-writer', '1999-01-01 00:00:00');
  INSERT INTO board_profile VALUES (1, 1, 'Writer bio', '', 'EDITOR');
  INSERT INTO SiteSetting (id, seoEnabled, aeoEnabled, robotsTxtExtraRules, siteName, updatedAt) VALUES (1, 1, 1, 'User-agent: ExampleBot\nDisallow: /private/  \n', 'Custom Blog', 946684800000);
  INSERT INTO "Series" ("id", "ownerId", "name", "slug", "descriptionMarkdown", "descriptionHtml", "isHidden", "updatedAt", "updatedAtMicroseconds") VALUES
    (1, 1, 'Public Series', 'public-series', 'Series summary.', '', 0, 946771200000, 0);
  INSERT INTO "Series" ("id", "ownerId", "name", "slug", "descriptionMarkdown", "descriptionHtml", "isHidden", "updatedAt", "updatedAtMicroseconds") VALUES
    (2, 1, 'Hidden Series', 'hidden-series', '', '', 1, 946771200000, 0);
  INSERT INTO StaticPage (id, slug, title, content, isPublished, updatedAt) VALUES (1, 'about-ai', 'About AI', '<h2>About BLEX</h2><p>Static <strong>page</strong>.</p>', 1, ${Date.UTC(2000, 0, 3)});
  INSERT INTO StaticPage (id, slug, title, content, isPublished, updatedAt) VALUES (2, 'private', 'Private page', '<p>Do not expose</p>', 0, ${Date.UTC(2000, 0, 4)});

  INSERT INTO board_post VALUES
    (1, 1, 'public', 'Public Post', 'An optional subtitle', '2000-01-01 12:00:00', '2000-01-05 12:30:00', NULL, 1),
    (2, 1, 'hidden', 'Hidden Post', '', '2000-01-01 12:00:00', '2000-01-05 12:30:00', NULL, 1),
    (3, 1, 'draft', 'Draft Post', '', NULL, '2000-01-05 12:30:00', NULL, NULL),
    (4, 1, 'scheduled', 'Scheduled Post', '', '9999-01-01 00:00:00', '2000-01-05 12:30:00', NULL, NULL),
    (5, 1, 'trashed', 'Trashed Post', '', '2000-01-01 12:00:00', '2000-01-05 12:30:00', '2000-01-06 00:00:00', NULL),
    (6, 1, 'series-hidden-post', 'Series hidden post', '', '2000-01-01 12:00:00', '2000-01-05 12:30:00', NULL, 1),
    (7, 1, 'hidden-series-post', 'Hidden series post', '', '2000-01-01 12:00:00', '2000-01-05 12:30:00', NULL, 2);
  INSERT INTO board_postconfig VALUES (1, 1, 0), (2, 2, 1), (3, 3, 0), (4, 4, 0), (5, 5, 0), (6, 6, 1), (7, 7, 0);
  INSERT INTO board_postcontent VALUES
    (1, 1, '<h2>Outcome</h2><p>Agents <strong>parse</strong> links <a href="/source">source</a>.</p><script>unsafe()</script>'),
    (2, 2, '<p>Hidden body</p>'),
    (6, 6, '<p>Hidden series member</p>');
  INSERT INTO board_tag VALUES (1, 'agents');
  INSERT INTO board_post_tags VALUES (1, 1, 1);
`);
fixture.close();

const db = new PrismaClient({ datasourceUrl: `file:${databasePath}?connection_limit=1` });
const app = Fastify();
registerPublicDiscovery(app, db, new URL('https://blog.example'));
await app.ready();

test.after(async () => {
  await app.close();
  await db.$disconnect();
  await rm(directory, { recursive: true });
});

test('serves the site discovery file and respects runtime robots settings', async () => {
  const llms = await app.inject('/llms.txt');
  assert.equal(llms.statusCode, 200);
  assert.equal(llms.headers['content-type'], 'text/plain; charset=utf-8');
  assert.equal(llms.headers['x-estimated-tokens'], String(Math.ceil(llms.body.length / 4)));
  assert.match(llms.body, /^# Custom Blog/m);
  assert.match(llms.body, /> Custom Blog recent public posts\./);
  assert.match(llms.body, /\[Posts sitemap\]\(https:\/\/blog\.example\/posts\/sitemap\.xml\)/);
  assert.match(llms.body, /@\{username\}\/\{post_url\}\.md/);
  assert.doesNotMatch(llms.body, /Public Post|Hidden Post|writer/);

  const robots = await app.inject('/robots.txt');
  assert.equal(robots.statusCode, 200);
  assert.match(robots.body, /# AI agent entry point: https:\/\/blog\.example\/llms\.txt/);
  assert.match(robots.body, /Sitemap: https:\/\/blog\.example\/sitemap\.xml/);
  assert.match(robots.body, /Disallow: \/admin-settings\//);
  assert.match(robots.body, /# Custom rules\nUser-agent: ExampleBot\nDisallow: \/private\/\n/);

  await db.$executeRaw`UPDATE SiteSetting SET seoEnabled = 0, aeoEnabled = 0 WHERE id = 1`;
  assert.equal((await app.inject('/llms.txt')).statusCode, 404);
  const privateRobots = await app.inject('/robots.txt');
  assert.match(privateRobots.body, /Disallow: \/llms\.txt/);
  assert.match(privateRobots.body, /Disallow: \/\*\.md/);
  assert.doesNotMatch(privateRobots.body, /Sitemap:/);
  assert.match(privateRobots.body, /Search indexing is disabled at runtime\./);
  await db.$executeRaw`UPDATE SiteSetting SET seoEnabled = 1, aeoEnabled = 1 WHERE id = 1`;
});

test('publishes sitemap sections and excludes non-public content everywhere', async () => {
  const index = await app.inject('/sitemap.xml');
  assert.equal(index.statusCode, 200, index.body);
  assert.equal(index.headers['x-robots-tag'], 'noindex, nofollow');
  assert.match(index.body, /<sitemapindex xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  for (const section of ['site', 'user', 'posts', 'series', 'staticpages']) {
    assert.match(index.body, new RegExp(`https:\/\/blog\\.example\/${section}\/sitemap\\.xml`));
  }

  const posts = await app.inject('/posts/sitemap.xml');
  assert.equal(posts.statusCode, 200);
  assert.match(posts.headers['last-modified'] ?? '', /Wed, 05 Jan 2000 12:30:00 GMT/);
  assert.match(posts.body, /https:\/\/blog\.example\/@writer\/public/);
  for (const hidden of ['hidden', 'draft', 'scheduled', 'trashed', 'series-hidden-post']) {
    assert.doesNotMatch(posts.body, new RegExp(`/${hidden}(?:<|&)`), hidden);
  }

  const series = await app.inject('/series/sitemap.xml');
  assert.match(series.body, /@writer\/series\/public-series/);
  assert.doesNotMatch(series.body, /hidden-series/);
  const staticPages = await app.inject('/staticpages/sitemap.xml');
  assert.match(staticPages.body, /<lastmod>2000-01-03T00:00:00\.000Z<\/lastmod>/);
  assert.match(staticPages.body, /\/static\/about-ai/);
  assert.doesNotMatch(staticPages.body, /\/static\/private/);
  assert.equal((await app.inject('/unknown/sitemap.xml')).statusCode, 404);
  assert.equal((await app.inject('/posts/sitemap.xml?p=0')).statusCode, 404);
  assert.equal((await app.inject('/posts/sitemap.xml?p=not-a-number')).statusCode, 404);
});

test('serves site and author feeds with public item dates and renamed-author redirects', async () => {
  const siteFeed = await app.inject('/rss');
  assert.equal(siteFeed.statusCode, 200);
  assert.equal(siteFeed.headers['content-type'], 'application/xml; charset=utf-8');
  assert.match(siteFeed.body, /<title>Custom Blog<\/title>/);
  assert.match(siteFeed.body, /<title>Public Post<\/title>/);
  assert.match(siteFeed.body, /<pubDate>Sat, 01 Jan 2000 12:00:00 GMT<\/pubDate>/);
  assert.doesNotMatch(siteFeed.body, /Hidden Post|Draft Post|Scheduled Post|Trashed Post|unsafe\(\)/);

  const authorFeed = await app.inject('/rss/@writer');
  assert.equal(authorFeed.statusCode, 200);
  assert.match(authorFeed.body, /<title>writer \(Alex\)<\/title>/);
  assert.match(authorFeed.body, /<image>/);
  assert.match(authorFeed.body, /Writer bio/);
  const renamed = await app.inject('/rss/@old-writer?from=legacy');
  assert.equal(renamed.statusCode, 302);
  assert.equal(renamed.headers.location, '/rss/@writer?from=legacy');
  assert.equal((await app.inject('/rss/@missing-user')).statusCode, 404);
});

test('serves public Markdown exports, converts HTML, and hides private content', async () => {
  const post = await app.inject('/@writer/public.md');
  assert.equal(post.statusCode, 200);
  assert.equal(post.headers['content-type'], 'text/markdown; charset=utf-8');
  assert.equal(post.headers['x-estimated-tokens'], String(Math.ceil(post.body.length / 4)));
  assert.match(post.body, /# Public Post\n\nAn optional subtitle/);
  assert.match(post.body, /Author: @writer/);
  assert.match(post.body, /Published: 2000-01-01/);
  assert.match(post.body, /Source: https:\/\/blog\.example\/@writer\/public/);
  assert.match(post.body, /Tags: agents/);
  assert.match(post.body, /## Outcome\n\nAgents \*\*parse\*\* links \[source\]\(\/source\)\./);
  assert.doesNotMatch(post.body, /<h2>|unsafe\(\)/);

  const oldUsername = await app.inject('/@old-writer/public.md');
  assert.equal(oldUsername.statusCode, 302);
  assert.equal(oldUsername.headers.location, '/@writer/public.md');
  for (const slug of ['hidden', 'draft', 'scheduled', 'trashed', 'missing']) {
    assert.equal((await app.inject(`/@writer/${slug}.md`)).statusCode, 404, slug);
  }

  const series = await app.inject('/@writer/series/public-series.md');
  assert.equal(series.statusCode, 200);
  assert.match(series.body, /# Public Series/);
  assert.match(series.body, /Series summary\./);
  assert.match(series.body, /\[Public Post\]\(https:\/\/blog\.example\/@writer\/public\.md\)/);
  assert.doesNotMatch(series.body, /Hidden Post|Series hidden post/);
  assert.equal((await app.inject('/@writer/series/hidden-series.md')).statusCode, 404);

  const staticPage = await app.inject('/static/about-ai.md');
  assert.match(staticPage.body, /^- Updated: 2000-01-03$/m);
  assert.equal(staticPage.statusCode, 200);
  assert.match(staticPage.body, /# About AI/);
  assert.match(staticPage.body, /## About BLEX/);
  assert.match(staticPage.body, /Static \*\*page\*\*\./);
  assert.equal((await app.inject('/static/private.md')).statusCode, 404);
});
