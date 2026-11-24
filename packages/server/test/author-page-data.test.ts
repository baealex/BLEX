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

interface AuthorData {
  page: string;
  profile?: { subscription: { csrfToken: string | null } | null };
  about?: { editable: boolean } | null;
  name?: string;
  posts?: Array<{ title: string }>;
}

const scriptPattern = /<script type="application\/json" id="blex-author-page-data">(.*?)<\/script>/s;

function pageData(html: string): AuthorData {
  const match = scriptPattern.exec(html);
  assert.ok(match, 'the page carries its client data');
  assert.doesNotMatch(match[1], /[<>]/, 'embedded JSON cannot close its script');
  return JSON.parse(match[1]) as AuthorData;
}

async function authorApp() {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedEditor(fixture.db, 2, 'reader');
  fixture.db.prepare(`UPDATE "Profile" SET role = 'READER' WHERE userId = 2`).run();
  fixture.db.prepare('UPDATE "User" SET email = ? WHERE id = 1').run('writer-private@example.test');
  fixture.db
    .prepare('UPDATE "Profile" SET aboutMarkdown = ?, aboutHtml = ? WHERE userId = 1')
    .run('about_markdown_marker', '<p>about_html_marker</p>');
  insertRow(fixture.db, 'Series', {
    id: 1,
    ownerId: 1,
    slug: 'collected',
    name: 'Collected',
    descriptionMarkdown: 'series_markdown_marker',
    descriptionHtml: '<p>series_html_marker</p>',
  });
  seedPost(fixture.db, 10, 1, 'in-series', { title: 'In series', seriesId: 1 });
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

test('author pages hydrate from a public view without a signed-out CSRF value', async () => {
  const { app, fixture, close } = await authorApp();
  try {
    const visitorToken = 'v'.repeat(43);
    for (const url of ['/@writer', '/@writer/posts', '/@writer/series', '/@writer/series/collected']) {
      const { body, statusCode } = await app.inject({ url, headers: { cookie: `csrftoken=${visitorToken}` } });
      assert.equal(statusCode, 200);
      assert.ok(!body.includes(visitorToken), `${url} leaves the visitor token out of its HTML`);
      const serialized = JSON.stringify(pageData(body));
      assert.doesNotMatch(serialized, /writer-private|about_markdown_marker|passwordHash|"id":/);
    }

    // Sanitized authored HTML is read back from the server markup, so the data never repeats it.
    const overview = await app.inject('/@writer');
    assert.match(overview.body, /about_html_marker/);
    assert.doesNotMatch(JSON.stringify(pageData(overview.body)), /about_html_marker/);
    const series = await app.inject('/@writer/series/collected');
    assert.match(series.body, /series_html_marker/);
    assert.doesNotMatch(JSON.stringify(pageData(series.body)), /series_html_marker/);

    const reader = signIn(fixture.db, 2);
    const signedIn = pageData((await app.inject({ url: '/@writer', headers: reader })).body);
    assert.equal(signedIn.profile?.subscription?.csrfToken, /csrftoken=([^;]+)/.exec(reader.cookie)?.[1]);
    assert.equal(signedIn.about?.editable, false);

    // The owner's Markdown is already in their editor's textarea, and the data leaves it there.
    const owner = signIn(fixture.db, 1);
    for (const url of ['/@writer', '/@writer/about/edit']) {
      const { body } = await app.inject({ url, headers: owner });
      assert.match(body, /about_markdown_marker/);
      assert.doesNotMatch(JSON.stringify(pageData(body)), /about_markdown_marker/);
    }
  } finally {
    await close();
  }
});

test('authored content cannot forge author page data', async () => {
  const { app, fixture, close } = await authorApp();
  const forged = '</script><script type="application/json" id="blex-author-page-data">{"page":"posts"}</script>';
  fixture.db.prepare('UPDATE "Profile" SET bio = ?, aboutHtml = ? WHERE userId = 1').run(forged, `<p>${forged}</p>`);
  fixture.db.prepare('UPDATE "Series" SET name = ?, descriptionHtml = ? WHERE id = 1').run(forged, `<p>${forged}</p>`);
  fixture.db.prepare('UPDATE "Post" SET title = ? WHERE id = 10').run(forged);
  try {
    for (const [url, page] of [
      ['/@writer', 'overview'],
      ['/@writer/posts', 'posts'],
      ['/@writer/series/collected', 'series-detail'],
    ]) {
      const { body } = await app.inject(url);
      assert.equal(body.match(/<script[^>]*id="blex-author-page-data"/g)?.length, 1, url);
      // The client reads only a script directly under <body>, which sits after the application root.
      assert.match(body, /<\/div><\/div><script type="application\/json" id="blex-author-page-data">/);
      assert.equal(pageData(body).page, page);
    }
    assert.equal(pageData((await app.inject('/@writer/series/collected')).body).name, forged);

    for (const url of ['/@nobody', '/@writer/series/missing']) {
      const missing = await app.inject(url);
      assert.equal(missing.statusCode, 404);
      assert.doesNotMatch(missing.body, /blex-author-page-data/);
    }
  } finally {
    await close();
  }
});
