import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { buildApp } from '../src/app.js';
import {
  createMigratedDatabase,
  insertRow,
  seedEditor,
  seedPost,
  signIn,
  testSecretKey,
  testCipherKey,
  testSiteUrl,
} from './fixtures/migrated-database.js';

function configureEnglish(t: TestContext) {
  for (const [key, value] of Object.entries({
    ENABLE_ENGLISH_UI: 'TRUE',
    BLEX_DEFAULT_LANGUAGE: 'en',
    DEBUG: 'FALSE',
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
}

async function englishApp(t: TestContext) {
  configureEnglish(t);
  const fixture = await createMigratedDatabase();
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    {
      secretKey: testSecretKey,
      cipherKey: testCipherKey,
      setupToken: 'english-ui-setup-token',
    },
    fixture.mediaRoot,
  );
  t.after(async () => {
    await app.close();
    await fixture.cleanup();
  });
  return { ...fixture, app };
}

test('English covers public, authentication, author, and error pages while authored content stays intact', async (t) => {
  const { app, db } = await englishApp(t);
  const setup = await app.inject('/setup');
  assert.equal(setup.statusCode, 200);
  assert.match(setup.body, /Create your first administrator/);
  assert.doesNotMatch(setup.body, /[가-힣]/);

  seedEditor(db, 1, 'writer');
  db.prepare('UPDATE User SET isStaff = 1, isSuperuser = 1 WHERE id = 1').run();
  insertRow(db, 'UserPreference', { userId: 1, language: 'en' });
  seedPost(db, 1, 1, 'original', { title: '사용자 제목', publishedAt: '2026-01-02 00:00:00' });
  db.prepare('UPDATE PostContent SET html = ? WHERE postId = 1').run('<p>사용자 본문</p>');
  const headers = signIn(db, 1);

  for (const url of [
    '/',
    '/tags',
    '/@writer',
    '/@writer/posts',
    '/@writer/series',
    '/@writer/original',
    '/@writer/original/related',
    '/@writer/original/revisions',
    '/@writer/original/timelapse',
    '/interests',
    '/settings/account',
    '/write',
    '/work-logs/',
    '/missing-page',
    '/docs/developer-api/quickstart',
  ]) {
    await t.test(url, async () => {
      const response = await app.inject({ url, headers: { ...headers, accept: 'text/html' } });
      assert.equal(response.statusCode, url === '/missing-page' ? 404 : 200, url);
      assert.equal(response.headers['content-language'], 'en');
      assert.match(response.body, /<html lang="en"/);
      const productCopy = response.body.replaceAll('사용자 제목', '').replaceAll('사용자 본문', '');
      assert.doesNotMatch(productCopy, /[가-힣]/, `${url} still contains untranslated product copy`);
    });
  }
  const post = await app.inject({ url: '/@writer/original', headers });
  assert.match(post.body, /사용자 제목/);
  assert.match(post.body, /사용자 본문/);
  assert.match(post.body, /January/);

  for (const [url, status] of [
    ['/login', 200],
    ['/sign', 200],
    ['/reauthenticate', 302],
    ['/password-reset/invalid', 404],
  ] as const) {
    const response = await app.inject(url);
    assert.equal(response.statusCode, status, url);
    if (response.statusCode === 302) {
      assert.match(response.headers.location ?? '', /\/login/);
      continue;
    }
    assert.equal(response.headers['content-language'], 'en', url);
    assert.doesNotMatch(response.body, /[가-힣]/, url);
  }
  const invalid = await app.inject({
    url: '/v1/setting/regional-preferences',
    method: 'PUT',
    headers,
    payload: { language: 'invalid', timeZone: 'UTC' },
  });
  assert.equal(invalid.statusCode, 200);
  assert.equal(invalid.json().status, 'ERROR');
  assert.equal(invalid.json().errorMessage, 'Select a supported language.');
});

test('concurrent Korean and English pages keep their own language and a later preference change takes effect', async (t) => {
  const { app, db } = await englishApp(t);
  seedEditor(db, 1, 'english');
  seedEditor(db, 2, 'korean');
  insertRow(db, 'UserPreference', { userId: 1, language: 'en' });
  insertRow(db, 'UserPreference', { userId: 2, language: 'ko' });
  const english = signIn(db, 1);
  const korean = signIn(db, 2);
  process.env.BLEX_DEFAULT_LANGUAGE = 'ko';
  await Promise.all(
    Array.from({ length: 20 }, async (_, index) => {
      const locale = index % 2 === 0 ? 'en' : 'ko';
      const response = await app.inject({ url: '/tags', headers: locale === 'en' ? english : korean });
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers['content-language'], locale);
      assert.match(response.body, new RegExp(`<html lang="${locale}"`));
      if (locale === 'en') {
        assert.match(response.body, /Tag cloud/);
        assert.doesNotMatch(response.body, /태그 클라우드/);
      } else {
        assert.match(response.body, /태그 클라우드/);
        assert.doesNotMatch(response.body, /Tag cloud/);
      }
    }),
  );
  db.prepare("UPDATE UserPreference SET language = '' WHERE userId = 1").run();
  const inherited = await app.inject({ url: '/tags', headers: english });
  assert.equal(inherited.headers['content-language'], 'ko');
  assert.match(inherited.body, /태그 클라우드/);
});
