import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import {
  createMigratedDatabase,
  insertRow,
  seedEditor,
  seedPost,
  signIn,
  testCipherKey,
  testSecretKey,
  testSiteUrl,
} from './fixtures/migrated-database.js';

interface DiscoveryData {
  page: string;
  tagName?: string;
  likes?: { csrfToken: string };
  notices?: Array<{ title: string; href: string | null }>;
  posts?: Array<{ title: string; liked: boolean }>;
}

const scriptPattern = /<script type="application\/json" id="blex-discovery-page-data">(.*?)<\/script>/s;

function pageData(html: string): DiscoveryData {
  const match = scriptPattern.exec(html);
  assert.ok(match, 'the page carries its client data');
  assert.doesNotMatch(match[1], /[<>]/, 'embedded JSON cannot close its script');
  return JSON.parse(match[1]) as DiscoveryData;
}

async function discoveryApp() {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedEditor(fixture.db, 2, 'liker');
  fixture.db.prepare('UPDATE "User" SET email = ? WHERE id = 1').run('writer-private@example.test');
  seedPost(fixture.db, 10, 1, 'tagged', { title: 'Tagged post' });
  fixture.db.prepare('UPDATE "PostContent" SET html = ? WHERE postId = 10').run('<p>unique_body_marker</p>');
  insertRow(fixture.db, 'Tag', { id: 1, name: 'alpha' });
  fixture.db.prepare('INSERT INTO "_PostToTag" ("A", "B") VALUES (10, 1)').run();
  insertRow(fixture.db, 'PostLike', { postId: 10, userId: 2 });
  for (const [id, title, url] of [
    [1, 'First notice', '/news/first'],
    [2, 'Second notice', 'javascript:alert(1)'],
  ] as const) {
    insertRow(fixture.db, 'SiteNotice', { id, scope: 'global', title, url, isActive: 1, order: id });
  }
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  return {
    app,
    fixture,
    async close() {
      await app.close();
      await fixture.cleanup();
    },
  };
}

test('discovery pages hydrate from a public view without a signed-out CSRF value', async () => {
  const { app, fixture, close } = await discoveryApp();
  try {
    const visitorToken = 'v'.repeat(43);
    for (const url of ['/', '/tags', '/tag/alpha']) {
      const { body, statusCode } = await app.inject({ url, headers: { cookie: `csrftoken=${visitorToken}` } });
      assert.equal(statusCode, 200);
      assert.ok(!body.includes(visitorToken), `${url} leaves the visitor token out of its HTML`);
      const serialized = JSON.stringify(pageData(body));
      assert.doesNotMatch(serialized, /writer-private|unique_body_marker|authorId|passwordHash/);
    }

    const home = await app.inject('/');
    const data = pageData(home.body);
    assert.deepEqual(
      data.notices?.map(({ title, href }) => [title, href]),
      [
        ['First notice', '/news/first'],
        ['Second notice', null],
      ],
    );
    assert.equal(home.body.match(/data-notice-slide=""/g)?.length, 2, 'every notice stays in the server HTML');
    assert.doesNotMatch(home.body, /data-notice-slide=""[^>]*hidden/);

    const headers = signIn(fixture.db, 2);
    const signedIn = pageData((await app.inject({ url: '/tag/alpha', headers })).body);
    assert.equal(signedIn.likes?.csrfToken, /csrftoken=([^;]+)/.exec(headers.cookie)?.[1]);
    assert.equal(signedIn.posts?.[0].liked, true);
  } finally {
    await close();
  }
});

test('authored content cannot forge discovery page data', async () => {
  const { app, fixture, close } = await discoveryApp();
  const forged = '</script><script type="application/json" id="blex-discovery-page-data">{"page":"tag"}</script>';
  fixture.db.prepare('UPDATE "Post" SET title = ? WHERE id = 10').run(forged);
  fixture.db.prepare('UPDATE "SiteNotice" SET title = ? WHERE id = 1').run(forged);
  try {
    const { body } = await app.inject('/');
    assert.equal(body.match(/<script[^>]*id="blex-discovery-page-data"/g)?.length, 1);
    // The client reads only a script directly under <body>, which sits after the application root.
    assert.match(body, /<\/div><\/div><script type="application\/json" id="blex-discovery-page-data">/);
    const data = pageData(body);
    assert.equal(data.page, 'home');
    assert.equal(data.posts?.[0].title, forged);

    const missing = await app.inject('/tag/does-not-exist');
    assert.equal(missing.statusCode, 404);
    assert.doesNotMatch(missing.body, /blex-discovery-page-data/);
  } finally {
    await close();
  }
});
