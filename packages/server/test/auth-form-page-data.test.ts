import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { encryptSecret } from '../src/features/auth/encrypted-secret.js';
import { createPasswordResetToken } from '../src/features/auth/password-reset.js';
import {
  createMigratedDatabase,
  insertRow,
  seedEditor,
  signIn,
  testCipherKey,
  testSecretKey,
  testSiteUrl,
} from './fixtures/migrated-database.js';

const scriptPattern = /<script type="application\/json" id="blex-auth-form-page-data">(.*?)<\/script>/s;
const visitorToken = 'v'.repeat(43);
const visitor = { accept: 'text/html', cookie: `csrftoken=${visitorToken}` };
const setupToken = 'setup_token_marker';

function pageData(html: string): Record<string, unknown> {
  const match = scriptPattern.exec(html);
  assert.ok(match, 'the page carries its client data');
  assert.doesNotMatch(match[1], /[<>]/, 'embedded JSON cannot close its script');
  // The form hydrates in the application root, directly before its data.
  assert.match(html, /<\/div><\/div><script type="application\/json" id="blex-auth-form-page-data">/);
  assert.doesNotMatch(html, /data-blex-page-module/);
  return JSON.parse(match[1]) as Record<string, unknown>;
}

async function formApp({ empty = false } = {}) {
  const fixture = await createMigratedDatabase();
  if (!empty) {
    seedEditor(fixture.db, 1, 'writer');
    fixture.db.prepare('UPDATE "User" SET isStaff = 1, isSuperuser = 1 WHERE id = 1').run();
    seedEditor(fixture.db, 2, 'oauthonly');
    insertRow(fixture.db, 'SocialProvider', {
      id: 1,
      key: 'github',
      clientId: 'client_id_marker',
      clientSecret: encryptSecret('client_secret_marker', testCipherKey),
      isEnabled: 1,
    });
    insertRow(fixture.db, 'SocialAccount', { id: 1, providerId: 1, uid: 'uid_marker', userId: 2 });
    insertRow(fixture.db, 'LoginSetting', {
      id: 1,
      hcaptchaEnabled: 1,
      hcaptchaSiteKey: 'site_key_marker',
      hcaptchaSecretKey: encryptSecret('captcha_secret_marker', testCipherKey),
      updatedAt: Date.now(),
    });
  }
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey, setupToken },
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

test('the sign-up page hydrates from its form fields without the captcha secret', async () => {
  const { app, close } = await formApp();
  try {
    const page = await app.inject({ url: '/sign?invite=invite_marker&next=%2F%40writer', headers: visitor });
    assert.equal(page.statusCode, 200);
    assert.deepEqual(pageData(page.body), {
      page: 'sign',
      siteName: 'BLEX',
      csrfToken: visitorToken,
      query: 'next=%2F%40writer',
      providers: ['GitHub'],
      captchaSiteKey: 'site_key_marker',
      invite: 'invite_marker',
      error: '',
    });
    assert.match(page.body, /data-sitekey="site_key_marker" data-blex-hcaptcha-widget=""><\/div>/);
    assert.doesNotMatch(page.body, /captcha_secret_marker|client_id_marker|client_secret_marker/);

    const failed = await app.inject({
      method: 'POST',
      url: '/sign',
      headers: { ...visitor, origin: testSiteUrl.origin },
      payload: { csrfmiddlewaretoken: visitorToken, username: 'newreader', password: 'one', passwordCheck: 'two' },
    });
    assert.equal(failed.statusCode, 200);
    const data = pageData(failed.body);
    assert.equal(data.csrfToken, visitorToken);
    assert.equal(typeof data.error, 'string');
    assert.notEqual(data.error, '');
  } finally {
    await close();
  }
});

test('the setup page leaves its token in the form and out of its data', async () => {
  const { app, close } = await formApp({ empty: true });
  try {
    for (const url of [`/setup?token=${setupToken}`, '/setup', '/setup?token=wrong']) {
      const page = await app.inject({ url, headers: visitor });
      assert.equal(page.statusCode, 200, url);
      const csrf = /csrftoken=([^;]+)/.exec(String(page.headers['set-cookie']))?.[1];
      assert.deepEqual(pageData(page.body), { page: 'setup', csrfToken: csrf, error: '' }, url);
      const accepted = url === `/setup?token=${setupToken}`;
      // Only the hidden field of an accepted link carries the token.
      assert.equal(page.body.split(setupToken).length - 1, accepted ? 1 : 0, url);
      assert.equal(page.body.includes(`name="setupToken" value="${setupToken}"`), accepted, url);
    }
  } finally {
    await close();
  }
});

test('the identity check lists only the linked providers it shows', async () => {
  const { app, fixture, close } = await formApp();
  try {
    const password = signIn(fixture.db, 1);
    const page = await app.inject({ url: '/reauthenticate?next=%2Fsettings%2Fprofile', headers: password });
    assert.equal(page.statusCode, 200);
    assert.deepEqual(pageData(page.body), {
      page: 'reauthenticate',
      csrfToken: password['x-csrftoken'],
      next: '/settings/profile',
      showForm: true,
      pendingFactor: false,
      hasSecondFactor: false,
      providers: [],
      error: '',
    });

    fixture.db.prepare(`UPDATE "User" SET passwordHash = '!unusable' WHERE id = 2`).run();
    const oauth = signIn(fixture.db, 2);
    const linked = pageData((await app.inject({ url: '/reauthenticate', headers: oauth })).body);
    assert.equal(linked.showForm, false);
    assert.deepEqual(linked.providers, [{ key: 'github', name: 'GitHub' }]);
    assert.doesNotMatch(JSON.stringify(linked), /client_id_marker|uid_marker/);
  } finally {
    await close();
  }
});

test('the password reset page posts to its link without copying the token into its data', async () => {
  const { app, fixture, close } = await formApp();
  try {
    const account = fixture.db.prepare('SELECT id, passwordHash FROM "User" WHERE id = 1').get() as {
      id: number;
      passwordHash: string;
    };
    const { token } = createPasswordResetToken(account, testSecretKey);
    const form = await app.inject({ url: `/password-reset/${token}`, headers: visitor });
    assert.equal(form.statusCode, 200);
    assert.deepEqual(pageData(form.body), {
      page: 'password-reset',
      state: 'form',
      username: 'writer',
      csrfToken: visitorToken,
      error: '',
    });
    assert.equal(form.body.split(token).length - 1, 1, 'only the form action carries the token');
    assert.ok(form.body.includes(` action="/password-reset/${token}" method="post">`));

    const invalid = await app.inject({ url: '/password-reset/1.1.invalid', headers: visitor });
    assert.equal(invalid.statusCode, 404);
    assert.deepEqual(pageData(invalid.body), { page: 'password-reset', state: 'invalid' });
  } finally {
    await close();
  }
});
