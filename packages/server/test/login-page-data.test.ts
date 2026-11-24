import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { encryptSecret } from '../src/features/auth/encrypted-secret.js';
import { createToken } from '../src/features/auth/session.js';
import {
  createMigratedDatabase,
  insertRow,
  seedEditor,
  signIn,
  testCipherKey,
  testSecretKey,
  testSiteUrl,
} from './fixtures/migrated-database.js';

const scriptPattern = /<script type="application\/json" id="blex-login-page-data">(.*?)<\/script>/s;

function pageData(html: string): Record<string, unknown> {
  const match = scriptPattern.exec(html);
  assert.ok(match, 'the page carries its client data');
  assert.doesNotMatch(match[1], /[<>]/, 'embedded JSON cannot close its script');
  return JSON.parse(match[1]) as Record<string, unknown>;
}

async function loginApp() {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  insertRow(fixture.db, 'SocialProvider', {
    id: 1,
    key: 'github',
    clientId: 'client_id_marker',
    clientSecret: encryptSecret('client_secret_marker', testCipherKey),
    isEnabled: 1,
  });
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

test('the sign-in page hydrates from its model fields alone', async () => {
  const { app, close } = await loginApp();
  try {
    const visitorToken = 'v'.repeat(43);
    const headers = { accept: 'text/html', cookie: `csrftoken=${visitorToken}` };
    for (const [url, next] of [
      ['/login', '/'],
      ['/login?next=%2F%40writer%3Ftab%3D1', '/@writer?tab=1'],
      ['/login?next=%2F%2Fevil.example', '/'],
    ] as const) {
      const { body, statusCode } = await app.inject({ url, headers });
      assert.equal(statusCode, 200, url);
      const data = pageData(body);
      assert.deepEqual(
        data,
        { csrfToken: visitorToken, next, providers: [{ key: 'github', name: 'GitHub' }], pendingOAuth: null },
        url,
      );
      assert.doesNotMatch(body, /client_id_marker|client_secret_marker/, url);
      // A form posted before its code loads still returns to this path.
      assert.ok(body.includes(`<input type="hidden" name="next" value="${next}"/>`), url);
      // The form hydrates in the application root, not in a root of its own.
      assert.doesNotMatch(body, /id="blex-login"|data-model=|data-blex-page-module/, url);
      assert.match(body, /<\/div><\/div><script type="application\/json" id="blex-login-page-data">/, url);
      assert.match(body, /<link rel="stylesheet" href="\/assets\/ui\/assets\/login-page-[^"]+\.css"\/>/, url);
    }
  } finally {
    await close();
  }
});

test('a pending OAuth challenge adds only the account name to the sign-in data', async () => {
  const { app, fixture, close } = await loginApp();
  try {
    insertRow(fixture.db, 'TwoFactorAuth', { userId: 1, totpSecret: 'JBSWY3DPEHPK3PXP', recoveryKey: 'r'.repeat(64) });
    insertRow(fixture.db, 'SocialAccount', { id: 1, providerId: 1, uid: 'uid_marker', userId: 1 });
    const challenge = createToken();
    insertRow(fixture.db, 'OAuthChallenge', {
      tokenHash: createHash('sha256').update(challenge).digest('hex'),
      socialAccountId: 1,
      returnPath: '/@writer',
      expiresAt: Date.now() + 60_000,
    });
    const { body, statusCode } = await app.inject({
      url: '/login',
      headers: { accept: 'text/html', cookie: `blex_oauth_challenge=${challenge}` },
    });
    assert.equal(statusCode, 200);
    const data = pageData(body);
    assert.deepEqual(Object.keys(data), ['csrfToken', 'next', 'providers', 'pendingOAuth']);
    assert.equal(data.next, '/@writer');
    assert.deepEqual(data.pendingOAuth, { username: 'writer' });
    assert.doesNotMatch(body, /uid_marker|JBSWY3DPEHPK3PXP/);
  } finally {
    await close();
  }
});

test('a signed-in visitor is sent on without a sign-in form', async () => {
  const { app, fixture, close } = await loginApp();
  try {
    const response = await app.inject({ url: '/login?next=%2F%40writer', headers: signIn(fixture.db, 1) });
    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.location, '/@writer');
    assert.doesNotMatch(response.body, /blex-login-page-data/);
  } finally {
    await close();
  }
});
