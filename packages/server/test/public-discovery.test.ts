import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import test from 'node:test';
import { registerPublicDiscovery } from '../src/features/discovery/feeds/index.js';
import { accountTables, createMigratedTables, migratedTableSql } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-discovery-'));
const databasePath = join(directory, 'synthetic legacy.sqlite3');
const fixture = new DatabaseSync(databasePath);
createMigratedTables(fixture, 'StaticPage', 'SiteSetting');
fixture.exec(`
  ${migratedTableSql(...accountTables)}
${migratedTableSql('Post', 'PostContent', 'Tag', '_PostToTag', 'PostRevision', 'PostLike', 'PinnedPost', 'PostShareLink', 'PostShareDailyCount', 'ScheduledPublication')}




  ${migratedTableSql('Series')}

  INSERT INTO "User" ("id", "username", "name", "email", "passwordHash", "joinedAt") VALUES
    (1, 'writer', 'Alex', '', '', 1577836800000);
  INSERT INTO "UsernameChange" ("id", "userId", "username", "createdAt") VALUES
    (1, 1, 'old-writer', 915148800000);
  INSERT INTO "Profile" ("userId", "bio", "avatar", "role") VALUES
    (1, 'Writer bio', '', 'EDITOR');
  INSERT INTO SiteSetting (id, seoEnabled, aeoEnabled, robotsTxtExtraRules, siteName, updatedAt) VALUES (1, 1, 1, 'User-agent: ExampleBot\nDisallow: /private/  \n', 'Custom Blog', 946684800000);
  INSERT INTO "Series" ("id", "ownerId", "name", "slug", "descriptionMarkdown", "descriptionHtml", "isHidden", "updatedAt") VALUES
    (1, 1, 'Public Series', 'public-series', 'Series summary.', '', 0, 946771200000);
  INSERT INTO "Series" ("id", "ownerId", "name", "slug", "descriptionMarkdown", "descriptionHtml", "isHidden", "updatedAt") VALUES
    (2, 1, 'Hidden Series', 'hidden-series', '', '', 1, 946771200000);
  INSERT INTO StaticPage (id, slug, title, content, isPublished, updatedAt) VALUES (1, 'about-ai', 'About AI', '<h2>About BLEX</h2><p>Static <strong>page</strong>.</p>', 1, ${Date.UTC(2000, 0, 3)});
  INSERT INTO StaticPage (id, slug, title, content, isPublished, updatedAt) VALUES (2, 'private', 'Private page', '<p>Do not expose</p>', 0, ${Date.UTC(2000, 0, 4)});

  INSERT INTO "Post" ("id", "authorId", "slug", "title", "subtitle", "publishedAt", "updatedAt", "deletedAt", "seriesId", "createdAt") VALUES
    (1, 1, 'public', 'Public Post', 'An optional subtitle', 946728000000, 947075400000, NULL, 1, 946684800000),
    (2, 1, 'hidden', 'Hidden Post', '', 946728000000, 947075400000, NULL, 1, 946684800000),
    (3, 1, 'draft', 'Draft Post', '', NULL, 947075400000, NULL, NULL, 946684800000),
    (4, 1, 'scheduled', 'Scheduled Post', '', 253370764800000, 947075400000, NULL, NULL, 946684800000),
    (5, 1, 'trashed', 'Trashed Post', '', 946728000000, 947075400000, 947116800000, NULL, 946684800000),
    (6, 1, 'series-hidden-post', 'Series hidden post', '', 946728000000, 947075400000, NULL, 1, 946684800000),
    (7, 1, 'hidden-series-post', 'Hidden series post', '', 946728000000, 947075400000, NULL, 2, 946684800000);
  UPDATE "Post" SET isHidden = 0 WHERE id = 1;
    UPDATE "Post" SET isHidden = 1 WHERE id = 2;
    UPDATE "Post" SET isHidden = 0 WHERE id = 3;
    UPDATE "Post" SET isHidden = 0 WHERE id = 4;
    UPDATE "Post" SET isHidden = 0 WHERE id = 5;
    UPDATE "Post" SET isHidden = 1 WHERE id = 6;
    UPDATE "Post" SET isHidden = 0 WHERE id = 7;
  INSERT INTO "PostContent" ("postId", "html") VALUES
    (1, '<h2>Outcome</h2><p>Agents <strong>parse</strong> links <a href="/source">source</a>.</p><script>unsafe()</script>'),
    (2, '<p>Hidden body</p>'),
    (6, '<p>Hidden series member</p>');
  INSERT INTO "Tag" ("id", "name") VALUES
    (1, 'agents');
  INSERT INTO "_PostToTag" ("A", "B") VALUES
    (1, 1);
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
  try {
    assert.equal((await app.inject('/llms.txt')).statusCode, 404);
    const privateRobots = await app.inject('/robots.txt');
    assert.match(privateRobots.body, /Disallow: \/llms\.txt/);
    assert.match(privateRobots.body, /Disallow: \/\*\.md/);
    assert.doesNotMatch(privateRobots.body, /Sitemap:/);
    assert.match(privateRobots.body, /Search indexing is disabled at runtime\./);
  } finally {
    await db.$executeRaw`UPDATE SiteSetting SET seoEnabled = 1, aeoEnabled = 1 WHERE id = 1`;
  }
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
