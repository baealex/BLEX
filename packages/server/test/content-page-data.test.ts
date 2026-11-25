import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { renderPage } from '../src/platform/views.js';
import {
  createMigratedDatabase,
  insertRow,
  seedEditor,
  signIn,
  testCipherKey,
  testSecretKey,
  testSiteUrl,
} from './fixtures/migrated-database.js';

const scriptPattern = /<script type="application\/json" id="blex-content-page-data">(.*?)<\/script>/s;

function pageData(html: string): Record<string, unknown> {
  const match = scriptPattern.exec(html);
  assert.ok(match, 'the page carries its client data');
  assert.doesNotMatch(match[1], /[<>]/, 'embedded JSON cannot close its script');
  return JSON.parse(match[1]) as Record<string, unknown>;
}

async function contentApp(content: string) {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedEditor(fixture.db, 2, 'reader');
  fixture.db.prepare(`UPDATE "Profile" SET role = 'READER' WHERE userId = 2`).run();
  insertRow(fixture.db, 'StaticPage', { id: 7, slug: 'about', title: 'About', content, isPublished: 1 });
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

test('static and error pages hydrate from public data without authored HTML or a signed-out CSRF value', async () => {
  const authored = '<style>.static_style_marker { color: red; }</style><p>static_html_marker</p>';
  const { app, fixture, close } = await contentApp(authored);
  try {
    const visitorToken = 'v'.repeat(43);
    const visitor = { accept: 'text/html', cookie: `csrftoken=${visitorToken}` };
    const reader = { ...signIn(fixture.db, 2), accept: 'text/html' };
    for (const [url, headers, status, page] of [
      ['/static/about', visitor, 200, 'static'],
      ['/missing-page', visitor, 404, 'not-found'],
      ['/@nobody', visitor, 404, 'not-found'],
      ['/static/missing', reader, 404, 'not-found'],
      ['/@writer/about/edit', reader, 403, 'forbidden'],
    ] as const) {
      const { body, statusCode } = await app.inject({ url, headers });
      assert.equal(statusCode, status, url);
      assert.ok(!body.includes(visitorToken), `${url} leaves the visitor token out of its HTML`);
      const data = pageData(body);
      assert.equal(data.page, page, url);
      assert.doesNotMatch(JSON.stringify(data), /static_html_marker|static_style_marker|csrf|"id":/i, url);
      if (page === 'not-found') assert.deepEqual(data, { page }, url);
      if (page === 'forbidden') {
        // Only whether someone is signed in, so the copy fits the visitor without naming them.
        assert.deepEqual(data, { page, signedIn: true }, url);
        assert.match(body, /로그인한 계정으로는 열 수 없는 페이지입니다\./);
        assert.doesNotMatch(body, /로그인 후 다시 시도해주세요/);
      }
    }

    const signedOut = renderPage('errors/forbidden', {
      brand: {
        siteName: 'BLEX',
        logoUrl: null,
        darkLogoUrl: null,
        faviconUrl: '/favicon.ico',
        seoEnabled: true,
        footerPages: [],
      },
      viewer: undefined,
    });
    assert.deepEqual(pageData(signedOut), { page: 'forbidden', signedIn: false });
    assert.match(signedOut, /로그인 후 다시 시도해주세요\./);
    assert.doesNotMatch(signedOut, /로그인한 계정으로는/);

    // The sanitized page and its stylesheet are read back from the server markup, so the data never repeats them.
    const { body } = await app.inject({ url: '/static/about', headers: visitor });
    assert.ok(body.includes(`<article class="rich-content"><div>${authored}</div></article>`));

    // Feeds, files, and APIs keep their plain answers.
    const plain = await app.inject({ url: '/missing-page' });
    assert.equal(plain.statusCode, 404);
    assert.doesNotMatch(plain.body, /blex-content-page-data/);
  } finally {
    await close();
  }
});

test('authored content cannot forge static page data', async () => {
  const forged = '<script type="application/json" id="blex-content-page-data">{"page":"not-found"}</script>';
  const { app, close } = await contentApp(
    `<style>.x{}</style>${forged}<p id="blex-content-page-data">forged</p></div></article></main>${forged}`,
  );
  try {
    const { body, statusCode } = await app.inject('/static/about');
    assert.equal(statusCode, 200);
    assert.equal(body.match(/<script[^>]*id="blex-content-page-data"/g)?.length, 1);
    // The client reads only a script directly under <body>, which sits after the application root.
    assert.match(body, /<\/div><\/div><script type="application\/json" id="blex-content-page-data">/);
    assert.equal(pageData(body).page, 'static');
  } finally {
    await close();
  }
});

test('the developer quickstart lists its page data by hand', async () => {
  const { app, fixture, close } = await contentApp('<p>About</p>');
  try {
    const editor = signIn(fixture.db, 1);
    const { body, statusCode } = await app.inject({ url: '/docs/developer-api/quickstart', headers: editor });
    assert.equal(statusCode, 200);
    const data = pageData(body);
    assert.deepEqual(Object.keys(data), ['page', 'locale', 'siteOrigin', 'commands', 'brand', 'copyrightYear']);
    assert.equal(data.page, 'developer-quickstart');
    assert.equal(data.siteOrigin, testSiteUrl.origin);
    assert.deepEqual(Object.keys(data.commands as object), ['me', 'create', 'publish', 'update', 'image']);
    assert.doesNotMatch(JSON.stringify(data), new RegExp(`${editor['x-csrftoken']}|"id":`));
  } finally {
    await close();
  }
});
