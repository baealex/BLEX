import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { Secret, TOTP } from 'otpauth';
import { buildApp } from '../src/app.js';
import { verifyPassword } from '../src/features/auth/password-hash.js';
import { decryptSecret, encryptSecret } from '../src/features/auth/encrypted-secret.js';
import { authenticatePassword } from '../src/features/auth/password-login.js';
import { verifySecondFactor } from '../src/features/auth/two-factor.js';
import { accountTables, insertRow, seedPost, migratedTableSql } from './fixtures/migrated-database.js';

// Test values were produced by Django, cryptography's Fernet and PyOTP.
const password = 'compatibility-비밀번호-2026';
const olderPasswordHash =
  'pbkdf2_sha256$100000$TestOnlyBlexCompatibilitySalt$C7LHeNRVZX18ry19YwDvmo1l7q8hcL5jtbv2QGe2x8E=';
const recentPasswordHash =
  'pbkdf2_sha256$1200000$TestOnlyBlexCompatibilitySalt$isIYGdiCmgfQ3dZ8Dh19Nw88dzLGrL8LefWRlTkzd88=';
const sha1PasswordHash = 'pbkdf2_sha1$100000$TestOnlyBlexCompatibilitySalt$nUTHIxFAB17ADxtO5tzXA87Z1gs=';
const totpSecret =
  'gAAAAABlU_EAVDlttaBTvMqR4RmYR1lYMY5Z8FEUI9Sjog0tK6L7y1-ZaRokhSKoQ4Z_tCtcH-wSP1DRgDF0XWVdFNY9Bwv2CX0BXDMIbln4SB9VE00mVEA=';
const recoveryKey = '831c28715dcd5f61787dc41ad7bf1663f904ab40c6220da4630e7fddecae6fe8';
const recoveryCode = 'test-only-recovery-code';
const cipherKey = '0123456789abcdef0123456789abcdef';

function headersFor(response: { headers: { 'set-cookie'?: string | string[] } }, siteUrl: URL) {
  const cookies = cookiesFrom(response.headers['set-cookie']);
  const csrf = cookies.find((cookie) => cookie.startsWith('csrftoken=')) ?? '';
  return { origin: siteUrl.origin, cookie: cookies.join('; '), 'x-csrftoken': csrf.slice('csrftoken='.length) };
}

function cookiesFrom(headers: string | string[] | undefined) {
  return (Array.isArray(headers) ? headers : headers ? [headers] : []).map((header) => header.split(';')[0]);
}

async function migratedFixture(path: string) {
  const db = new DatabaseSync(path);
  const migrations = new URL('../../prisma/migrations/', import.meta.url);
  for (const migration of ['0001_init']) {
    db.exec(await readFile(new URL(`${migration}/migration.sql`, migrations), 'utf8'));
  }
  return db;
}

test('signs up a reader and redeems a legacy editor invitation only once', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blex-signup-test-'));
  const path = join(directory, 'signup.sqlite3');
  const fixture = await migratedFixture(path);
  fixture.exec(`
    INSERT INTO "User" ("id", "username", "passwordHash", "email", "name", "joinedAt", "isActive", "isStaff", "isSuperuser") VALUES
    (1, 'owner', '!unusable', '', 'Owner', 946684800000, 1, 1, 1);
    INSERT INTO "AuthorInvite" ("code", "note", "isActive", "createdById", "createdAt") VALUES
    ('synthetic-invite', '', 1, 1, 946684800000);
    INSERT INTO LoginSetting (id, welcomeNotificationMessage, welcomeNotificationUrl, updatedAt)
    VALUES (1, 'Hello {name}', '/welcome', 946684800000);
  `);
  fixture.prepare('UPDATE "User" SET passwordHash = ? WHERE id = 1').run(recentPasswordHash);
  fixture.close();

  const siteUrl = new URL('https://blex.example');
  const app = await buildApp(path, siteUrl, { secretKey: 'signup-test-secret', cipherKey });
  try {
    const loginPage = await app.inject('/login');
    assert.equal(loginPage.statusCode, 200, loginPage.body);
    assert.match(loginPage.body, /data-blex-page-module="login"/);
    const page = await app.inject('/sign?invite=synthetic-invite');
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /value="synthetic-invite"/);
    const captchaDb = new DatabaseSync(path);
    captchaDb
      .prepare('UPDATE LoginSetting SET hcaptchaEnabled = 1, hcaptchaSiteKey = ?, hcaptchaSecretKey = ? WHERE id = 1')
      .run('synthetic-site-key', encryptSecret('synthetic-captcha-secret', cipherKey));
    captchaDb.close();
    const captchaPage = await app.inject('/sign');
    assert.equal(captchaPage.statusCode, 200, captchaPage.body);
    assert.match(captchaPage.body, /data-blex-trusted-script="hcaptcha"/);
    assert.match(captchaPage.body, /data-blex-hcaptcha-widget=""/);
    const resetCaptchaDb = new DatabaseSync(path);
    resetCaptchaDb.prepare('UPDATE LoginSetting SET hcaptchaEnabled = 0, hcaptchaSiteKey = ? WHERE id = 1').run('');
    resetCaptchaDb.close();
    const headers = headersFor(page, siteUrl);
    const fields = {
      username: 'neweditor',
      name: 'Test Author',
      password,
      timeZone: 'Asia/Seoul',
      email: 'editor@Example.invalid',
    };
    const noCsrf = await app.inject({ method: 'POST', url: '/v1/sign', payload: fields });
    assert.equal(noCsrf.statusCode, 403);
    const reader = await app.inject({
      method: 'POST',
      url: '/v1/sign',
      headers,
      payload: { ...fields, username: 'newreader', name: 'Test Reader' },
    });
    assert.equal(reader.json().body.hasEditorRole, false);
    assert.equal(reader.json().body.isFirstLogin, true);
    assert.equal(reader.json().body.notifyCount, 1);
    const editor = await app.inject({
      method: 'POST',
      url: '/v1/sign',
      headers,
      payload: { ...fields, inviteCode: 'synthetic-invite' },
    });
    assert.equal(editor.json().body.hasEditorRole, true);
    assert.equal(editor.json().body.email, 'editor@example.invalid');
    assert.match(headersFor(editor, siteUrl).cookie, /blexsessionid=/);
    const tokenUrl = '/v1/developer-tokens';
    const editorSession = headersFor(editor, siteUrl);
    const credentials = { name: 'Test automation', scopes: ['posts:read', 'posts:write'], expiresInDays: 30 };
    assert.equal(
      (await app.inject({ method: 'POST', url: tokenUrl, headers: editorSession, payload: credentials })).json()
        .errorCode,
      'error:RE',
    );
    const identityProof = await app.inject({
      method: 'POST',
      url: '/reauthenticate',
      headers: editorSession,
      payload: { password },
    });
    const verified = headersFor(identityProof, siteUrl);
    const token = await app.inject({ method: 'POST', url: tokenUrl, headers: verified, payload: credentials });
    assert.equal(token.json().status, 'DONE', token.body);
    const issued = token.json().body;
    assert.match(issued.token, /^blex_pat_[0-9a-f]{12}_[a-zA-Z0-9_-]{43}$/);
    const tokens = await app.inject({ url: tokenUrl, headers: verified });
    assert.equal(tokens.json().body.tokens[0].tokenPrefix, issued.tokenPrefix);
    assert.equal(tokens.body.includes(issued.token), false);
    const telegramSettings = await app.inject({ url: '/v1/setting/integration-telegram', headers: verified });
    assert.equal(telegramSettings.json().body.isConfigured, false);
    const apiRequest = { url: '/api/developer/v1/me', headers: { authorization: `Bearer ${issued.token}` } };
    assert.equal((await app.inject(apiRequest)).json().data.user.username, 'neweditor');
    const postsUrl = '/api/developer/v1/posts';
    const createdDraft = await app.inject({
      method: 'POST',
      url: postsUrl,
      headers: apiRequest.headers,
      payload: {
        title: 'Developer API draft',
        slug: 'developer-draft',
        markdown: '# API draft',
        tags: ['node', 'sqlite'],
      },
    });
    assert.equal(createdDraft.statusCode, 201, createdDraft.body);
    const draft = createdDraft.json().data;
    assert.equal(draft.status, 'draft');
    assert.match(draft.content_html, /<h2 id="api-draft">API draft<\/h2>/);
    const updateUrl = `${postsUrl}/${draft.id}`;
    const stale = await app.inject({
      method: 'PATCH',
      url: updateUrl,
      headers: apiRequest.headers,
      payload: { title: 'Discarded', expected_updated_at: '2000-01-01T00:00:00+00:00' },
    });
    assert.equal(stale.statusCode, 409);
    assert.equal(stale.json().error.fields.actual_updated_at, draft.updated_at);
    const updatedDraft = await app.inject({
      method: 'PATCH',
      url: updateUrl,
      headers: apiRequest.headers,
      payload: { subtitle: 'Kept Markdown and tags', expected_updated_at: draft.updated_at },
    });
    assert.equal(updatedDraft.statusCode, 200, updatedDraft.body);
    assert.deepEqual(updatedDraft.json().data.tags, ['node', 'sqlite']);
    const authorChannel = await app.inject({
      method: 'POST',
      url: '/v1/webhook/channels',
      headers: verified,
      payload: { name: 'Synthetic author channel', webhookUrl: 'https://hooks.example.com/test-fixture' },
    });
    assert.equal(authorChannel.json().body.success, true);
    const published = await app.inject({ method: 'POST', url: `${updateUrl}/publish`, headers: apiRequest.headers });
    assert.equal(published.statusCode, 200, published.body);
    assert.equal(published.json().data.status, 'published');
    assert.equal((await app.inject('/@neweditor/developer-draft')).statusCode, 200);
    const shareApi = '/v1/users/@neweditor/posts/developer-draft/share-links';
    const shared = await app.inject({
      method: 'POST',
      url: shareApi,
      headers: verified,
      payload: { label: 'Newsletter' },
    });
    assert.equal(shared.json().status, 'DONE');
    const linkList = await app.inject({ url: shareApi, headers: verified });
    const [link] = linkList.json().body.links;
    const url = new URL(link.url).pathname;
    const preview = await app.inject({ url, headers: { 'user-agent': 'TelegramBot' } });
    assert.equal(preview.headers.location, '/@neweditor/developer-draft');
    assert.equal((await app.inject(url)).headers.location, '/@neweditor/developer-draft');
    const visited = await app.inject({ url: shareApi, headers: verified });
    assert.equal(visited.json().body.links[0].totalClicks, 1);
    const paused = await app.inject({
      method: 'PATCH',
      url: `${shareApi}/${link.id}`,
      headers: verified,
      payload: { isPaused: true },
    });
    assert.equal(paused.json().status, 'DONE');
    assert.equal((await app.inject(url)).statusCode, 404);
    const concealed = await app.inject({
      method: 'PATCH',
      url: updateUrl,
      headers: apiRequest.headers,
      payload: { is_hidden: true },
    });
    assert.equal(concealed.statusCode, 200, concealed.body);
    const postPath = '/@neweditor/developer-draft';
    const ownerRead = await app.inject({ url: postPath, headers: verified });
    assert.equal(ownerRead.statusCode, 200, ownerRead.body);
    assert.equal(ownerRead.headers['cache-control'], 'private, no-store');
    assert.equal(ownerRead.headers['x-robots-tag'], 'noindex, nofollow, noarchive');
    assert.match(ownerRead.body, /비공개 포스트입니다/);
    assert.equal((await app.inject({ url: postPath, headers: headersFor(reader, siteUrl) })).statusCode, 404);
    assert.equal((await app.inject(postPath)).statusCode, 404);
    const dryRun = await app.inject({
      method: 'DELETE',
      url: `${updateUrl}?dry_run=true`,
      headers: apiRequest.headers,
    });
    assert.equal(dryRun.json().data.can_delete, true);
    const deleted = await app.inject({ method: 'DELETE', url: updateUrl, headers: apiRequest.headers });
    assert.equal(deleted.json().data.trashed, true);
    assert.equal((await app.inject('/@neweditor/developer-draft')).statusCode, 404);
    const revoked = await app.inject({ method: 'DELETE', url: `${tokenUrl}/${issued.id}`, headers: verified });
    assert.equal(revoked.json().body.id, issued.id);
    assert.equal((await app.inject(apiRequest)).statusCode, 401);
    const reused = await app.inject({
      method: 'POST',
      url: '/v1/sign',
      headers,
      payload: { ...fields, username: 'anothereditor', inviteCode: 'synthetic-invite' },
    });
    assert.equal(reused.json().errorCode, 'error:RJ');
    assert.equal((await app.inject('/v1/sign?username=neweditor')).json().body.isAvailable, false);
    assert.equal((await app.inject('/v1/sign?username=anothereditor')).json().body.isAvailable, true);
    const promoteFixture = new DatabaseSync(path);
    promoteFixture
      .prepare(`UPDATE "User" SET isStaff = 1, canManageSiteSettings = 1 WHERE username = 'neweditor'`)
      .run();
    promoteFixture.close();
    const globalChannels = await app.inject({ url: '/v1/webhook/global-channels', headers: verified });
    assert.equal(globalChannels.json().status, 'DONE', globalChannels.body);
    assert.equal(
      (await app.inject({ url: '/v1/webhook/global-channels', headers: headersFor(reader, siteUrl) })).json().errorCode,
      'error:RJ',
    );
    const check = new DatabaseSync(path, { readOnly: true });
    const account = check
      .prepare(`
      SELECT profile.role, config.language, config.timeZone FROM "User" AS account
        JOIN "Profile" AS profile ON profile.userId = account.id JOIN "UserPreference" AS config ON config.userId = account.id
       WHERE account.username = 'neweditor'
    `)
      .get();
    assert.equal(account?.role, 'EDITOR');
    assert.equal(account?.language, '');
    assert.equal(account?.timeZone, 'Asia/Seoul');
    assert.equal(check.prepare('SELECT COUNT(*) AS count FROM WebhookDelivery').get()?.count, 1);
    check.close();
  } finally {
    await app.close();
    await rm(directory, { recursive: true });
  }
});

test('requires recent verification for password and 2FA changes and rotates the existing session', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blex-security-test-'));
  const path = join(directory, 'security.sqlite3');
  const fixture = await migratedFixture(path);
  fixture
    .prepare(`
    INSERT INTO "User" (id, username, passwordHash, email, name, joinedAt, isActive, isStaff, isSuperuser)
    VALUES (41, 'account', ?, 'test@example.invalid', 'Reader', 946684800000, 1, 0, 0)
  `)
    .run(olderPasswordHash);
  fixture.close();
  const siteUrl = new URL('https://blex.example');
  const app = await buildApp(path, siteUrl, { secretKey: 'settings-security-test-secret', cipherKey });
  const newPassword = 'Migrate!2026-개발자';
  try {
    const initial = headersFor(await app.inject('/v1/login'), siteUrl);
    const session = await app.inject({
      method: 'POST',
      url: '/v1/login',
      headers: initial,
      payload: { username: 'account', password },
    });
    const signedIn = headersFor(session, siteUrl);
    const reauthenticationPage = await app.inject({
      url: '/reauthenticate?next=%2Fsettings%2Fsecurity',
      headers: signedIn,
    });
    assert.equal(reauthenticationPage.statusCode, 200, reauthenticationPage.body);
    assert.doesNotMatch(reauthenticationPage.body, /class="settings-ui/);
    assert.match(reauthenticationPage.body, /현재 비밀번호/);
    const firstAttempt = await app.inject({
      method: 'PUT',
      url: '/v1/setting/account',
      headers: signedIn,
      payload: { password: newPassword },
    });
    assert.equal(firstAttempt.json().messageKey, 'auth.reauthentication_required');
    const attemptedSetup = await app.inject({
      method: 'POST',
      url: '/v1/auth/security',
      headers: signedIn,
      payload: {},
    });
    assert.equal(attemptedSetup.json().errorCode, 'error:RE');

    const verification = await app.inject({
      method: 'POST',
      url: '/reauthenticate?next=%2Fsettings%2Fsecurity',
      headers: signedIn,
      payload: { password },
    });
    assert.equal(verification.headers.location, '/settings/security');
    const verified = headersFor(verification, siteUrl);
    assert.equal((await app.inject({ url: '/v1/login', headers: signedIn })).json().errorCode, 'error:NL');
    const updated = await app.inject({
      method: 'PUT',
      url: '/v1/setting/account',
      headers: verified,
      payload: { username: 'newaccount', name: 'Renamed user', password: newPassword },
    });
    assert.deepEqual(updated.json(), { status: 'DONE', body: {} });
    const newSession = headersFor(updated, siteUrl);
    assert.equal((await app.inject({ url: '/v1/login', headers: verified })).json().errorCode, 'error:NL');
    assert.equal((await app.inject({ url: '/v1/login', headers: newSession })).json().body.username, 'newaccount');
    assert.equal(
      (await app.inject({ method: 'POST', url: '/v1/auth/security', headers: newSession, payload: {} })).json()
        .errorCode,
      'error:RE',
    );

    const verifyNew = await app.inject({
      method: 'POST',
      url: '/reauthenticate',
      headers: newSession,
      payload: { password: newPassword },
    });
    const secondProof = headersFor(verifyNew, siteUrl);
    const setup = await app.inject({ method: 'POST', url: '/v1/auth/security', headers: secondProof, payload: {} });
    assert.equal(setup.json().status, 'DONE');
    assert.match(setup.json().body.qrCode, /^data:image\/png;base64,/);
    assert.match(setup.json().body.recoveryKey, /^[a-zA-Z0-9]{45}$/);
    const stored = new DatabaseSync(path, { readOnly: true });
    const pending = stored.prepare('SELECT secret, recoveryHash FROM "FactorSetup"').get();
    assert.notEqual(pending?.recoveryHash, setup.json().body.recoveryKey);
    const decrypted = decryptSecret(String(pending?.secret), cipherKey);
    assert.ok(decrypted);
    stored.close();
    const TOTPCode = new TOTP({ secret: Secret.fromBase32(decrypted) }).generate();
    const enabled = await app.inject({
      method: 'POST',
      url: '/v1/auth/security/verify',
      headers: secondProof,
      payload: { code: TOTPCode },
    });
    assert.equal(enabled.json().status, 'DONE');
    const status = await app.inject({ url: '/v1/auth/security', headers: secondProof });
    assert.deepEqual(status.json().body, { isEnabled: true, hasRecoveryKey: true });
    const challenge = await app.inject({
      method: 'POST',
      url: '/v1/login',
      headers: initial,
      payload: { username: 'newaccount', password: newPassword },
    });
    assert.equal(challenge.json().body.security, true);
    const loginWithRecovery = await app.inject({
      method: 'POST',
      url: '/v1/login',
      headers: initial,
      payload: { username: 'newaccount', password: newPassword, code: setup.json().body.recoveryKey },
    });
    assert.equal(loginWithRecovery.json().body.recoveryKeyUsed, true);
    assert.equal(loginWithRecovery.json().body.hasConnected2fa, false);
  } finally {
    await app.close();
    await rm(directory, { recursive: true });
  }
});

test('checks the stored PBKDF2 algorithm and iteration count without changing the password', async () => {
  for (const digest of [olderPasswordHash, recentPasswordHash, sha1PasswordHash]) {
    assert.equal(await verifyPassword(password, digest), true);
  }
  assert.equal(await verifyPassword(`${password}-wrong`, olderPasswordHash), false);
  assert.equal(await verifyPassword(password, ''), false);
  assert.equal(await verifyPassword(password, '!unusable'), false);
});

test('keeps the legacy login envelope and issues a new session only after CSRF, password and 2FA checks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blex-http-auth-'));
  const path = join(directory, 'accounts.sqlite3');
  const fixture = await migratedFixture(path);
  fixture
    .prepare(`
    INSERT INTO "User" (id, username, passwordHash, email, name, joinedAt, isActive, isStaff, isSuperuser)
    VALUES (42, 'account', ?, 'test@example.invalid', 'Test', 946684800000, 1, 0, 0)
  `)
    .run(olderPasswordHash);
  fixture
    .prepare(`
    INSERT INTO "TwoFactorAuth" (userId, recoveryKey, totpSecret, createdAt)
    VALUES (42, ?, ?, 946684800000)
  `)
    .run(recoveryKey, totpSecret);
  fixture.close();

  const siteUrl = new URL('https://blex.example');
  const app = await buildApp(path, siteUrl, { secretKey: 'http-auth-test-secret', cipherKey });
  try {
    const anonymous = await app.inject('/v1/login');
    assert.equal(anonymous.statusCode, 200);
    assert.equal(anonymous.json().errorCode, 'error:NL');
    const [csrf] = cookiesFrom(anonymous.headers['set-cookie']);
    assert.match(csrf, /^csrftoken=/);
    const csrfHeaders = { origin: siteUrl.origin, cookie: csrf, 'x-csrftoken': csrf.slice('csrftoken='.length) };
    const credentials = { username: 'account', password };

    const crossOrigin = await app.inject({
      method: 'POST',
      url: '/v1/login',
      payload: credentials,
      headers: { ...csrfHeaders, origin: 'https://elsewhere.example' },
    });
    assert.equal(crossOrigin.statusCode, 403);

    const challenge = await app.inject({
      method: 'POST',
      url: '/v1/login',
      payload: credentials,
      headers: csrfHeaders,
    });
    assert.deepEqual(challenge.json(), {
      status: 'DONE',
      body: { username: 'account', security: true, isOauth: false },
    });
    assert.equal(challenge.headers['set-cookie'], undefined);

    const login = await app.inject({
      method: 'POST',
      url: '/v1/login',
      payload: { ...credentials, code: new TOTP({ secret: Secret.fromBase32('JBSWY3DPEHPK3PXP') }).generate() },
      headers: csrfHeaders,
    });
    assert.equal(login.statusCode, 200, login.body);
    assert.equal(login.json().body.username, 'account');
    assert.equal(login.json().body.hasConnected2fa, true);
    assert.match(String(login.headers['set-cookie']), /HttpOnly.*Secure/);
    const [session, rotatedCsrf] = cookiesFrom(login.headers['set-cookie']);
    assert.match(session, /^blexsessionid=/);
    assert.notEqual(rotatedCsrf, csrf);
    const signedInHeaders = {
      origin: siteUrl.origin,
      cookie: `${session}; ${rotatedCsrf}`,
      'x-csrftoken': rotatedCsrf.slice('csrftoken='.length),
    };

    const loggedIn = await app.inject({ url: '/v1/login', headers: signedInHeaders });
    assert.equal(loggedIn.json().body.email, 'test@example.invalid');
    const { username, name, avatar, hasEditorRole } = loggedIn.json().body;
    assert.deepEqual(
      { username, name, avatar, hasEditorRole },
      { username: 'account', name: 'Test', avatar: '', hasEditorRole: false },
    );
    const signedInHome = await app.inject({ url: '/', headers: signedInHeaders });
    assert.equal(signedInHome.statusCode, 200, signedInHome.body);
    assert.equal(signedInHome.headers['cache-control'], 'private, no-store');
    const logout = await app.inject({ method: 'POST', url: '/v1/logout', headers: signedInHeaders });
    assert.deepEqual(logout.json(), { status: 'DONE', body: {} });
    assert.equal((await app.inject({ url: '/v1/login', headers: signedInHeaders })).json().errorCode, 'error:NL');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const invalid = await app.inject({
        method: 'POST',
        url: '/v1/login',
        payload: { ...credentials, password: 'invalid' },
        headers: csrfHeaders,
      });
      assert.equal(invalid.json().errorCode, 'error:AT');
    }
    const limited = await app.inject({ method: 'POST', url: '/v1/login', payload: credentials, headers: csrfHeaders });
    assert.equal(limited.json().errorCode, 'error:RJ');
    assert.match(limited.json().errorMessage, /너무 많은 실패/);
  } finally {
    await app.close();
    await rm(directory, { recursive: true });
  }
});

test('account deletion checks recent proof, preserves other members, and protects the final active administrator', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blex-delete-account-'));
  const path = join(directory, 'deletion.sqlite3');
  const fixture = await migratedFixture(path);
  fixture
    .prepare(`
    INSERT INTO "User" (id, username, passwordHash, email, name, joinedAt, isActive, isStaff, isSuperuser)
    VALUES (1, 'administrator', ?, 'admin@example.invalid', 'Owner', 946684800000, 1, 1, 1),
           (2, 'reader', ?, 'reader@example.invalid', 'Reader', 946684800000, 1, 0, 0)
  `)
    .run(olderPasswordHash, olderPasswordHash);
  fixture.exec(`
    INSERT INTO "AuthorInvite" ("code", "note", "isActive", "createdById", "claimedById", "createdAt", "claimedAt") VALUES
    ('test-claimed', '', 0, 1, 2, 946684800000, 946684800000);
    INSERT INTO WorkLog (id, title, createdAt, ownerId) VALUES (3, 'Synthetic log', 946684800000, 2);
    INSERT INTO WorkLogEntry (id, title, text, mediaType, attachment, createdAt, logId)
    VALUES (4, 'Synthetic entry', '', '', '', 946684800000, 3);
    INSERT INTO WorkLogShare (id, token, headline, createdAt, logId) VALUES (5, '123', 'Snapshot', 946684800000, 3);
    INSERT INTO _WorkLogEntryToWorkLogShare (A, B) VALUES (4, 5);
  `);
  insertRow(fixture, 'Series', { id: 2, ownerId: 2, slug: 'deleted-series' });
  seedPost(fixture, 1, 1, 'kept-post', { seriesId: 2 });
  seedPost(fixture, 2, 2, 'deleted-post', { seriesId: 2 });
  insertRow(fixture, 'Comment', { id: 1, postId: 1, authorId: 2, markdown: 'kept' });
  insertRow(fixture, 'Comment', { id: 2, postId: 2, authorId: 1 });
  insertRow(fixture, 'CommentLike', { commentId: 1, userId: 2 });
  insertRow(fixture, 'PostRevision', { id: 1, postId: 1, actorId: 2, type: 'edit' });
  insertRow(fixture, 'FormTemplate', { id: 1, userId: 2, title: 'Deleted form' });
  insertRow(fixture, 'SiteNotice', { id: 1, userId: 2, scope: 'user', title: 'Deleted notice' });
  insertRow(fixture, 'SiteNotice', { id: 2, scope: 'global', title: 'Kept notice' });
  insertRow(fixture, 'SiteBanner', { id: 1, userId: 2, scope: 'user', type: 'horizontal', position: 'top' });
  insertRow(fixture, 'SiteBanner', { id: 2, userId: 1, scope: 'global', type: 'sidebar', position: 'left' });
  insertRow(fixture, 'StaticPage', { id: 1, authorId: 2, slug: 'kept-page', title: 'Kept page' });
  insertRow(fixture, 'AdminLog', { id: 1, userId: 2, action: 2, message: 'Deleted with its owner' });
  insertRow(fixture, 'AdminLog', { id: 2, userId: 1, action: 2, message: 'Kept' });
  insertRow(fixture, 'CleanupConfirmation', {
    id: 1,
    userId: 2,
    tokenHash: 'deleted',
    action: 'clean_tags',
    sessionFingerprint: 'print',
    expiresAt: 946684800000,
  });
  insertRow(fixture, 'UploadedImage', {
    id: 1,
    userId: 2,
    key: 'kept-image',
    path: 'images/content/kept.png',
    size: 1,
  });
  fixture.close();
  const siteUrl = new URL('https://blex.example');
  const app = await buildApp(path, siteUrl, { secretKey: 'deletion-test-secret', cipherKey });
  try {
    const anonymous = headersFor(await app.inject('/v1/login'), siteUrl);
    for (const username of ['administrator', 'reader']) {
      const signed = headersFor(
        await app.inject({ method: 'POST', url: '/v1/login', headers: anonymous, payload: { username, password } }),
        siteUrl,
      );
      assert.equal(
        (await app.inject({ method: 'DELETE', url: '/v1/sign', headers: signed })).json().errorCode,
        'error:RE',
      );
      const verified = headersFor(
        await app.inject({ method: 'POST', url: '/reauthenticate', headers: signed, payload: { password } }),
        siteUrl,
      );
      const result = await app.inject({ method: 'DELETE', url: '/v1/sign', headers: verified });
      if (username === 'administrator') assert.equal(result.json().errorCode, 'error:RJ');
      else {
        assert.deepEqual(result.json(), { status: 'DONE', body: {} });
        assert.equal((await app.inject({ url: '/v1/login', headers: verified })).json().errorCode, 'error:NL');
      }
    }
    const check = new DatabaseSync(path, { readOnly: true });
    assert.deepEqual(
      check
        .prepare('SELECT username FROM "User"')
        .all()
        .map((row) => row.username),
      ['administrator'],
    );
    assert.equal(check.prepare('SELECT COUNT(*) AS rows FROM _WorkLogEntryToWorkLogShare').get()?.rows, 0);
    assert.equal(check.prepare('SELECT claimedById FROM AuthorInvite').get()?.claimedById, null);
    assert.deepEqual(
      check
        .prepare('SELECT slug FROM "Post" WHERE seriesId IS NULL')
        .all()
        .map((row) => row.slug),
      ['kept-post'],
    );
    assert.deepEqual(
      check
        .prepare('SELECT markdown FROM Comment WHERE authorId IS NULL')
        .all()
        .map((row) => row.markdown),
      ['kept'],
    );
    assert.equal(check.prepare('SELECT COUNT(*) AS rows FROM "Post"').get()?.rows, 1);
    assert.equal(check.prepare('SELECT COUNT(*) AS rows FROM Comment').get()?.rows, 1);
    assert.equal(check.prepare('SELECT COUNT(*) AS rows FROM CommentLike').get()?.rows, 0);
    assert.equal(check.prepare('SELECT actorId FROM "PostRevision" WHERE id = 1').get()?.actorId, null);
    assert.equal(check.prepare('SELECT COUNT(*) AS rows FROM FormTemplate').get()?.rows, 0);
    assert.deepEqual(
      check
        .prepare('SELECT id FROM SiteNotice')
        .all()
        .map((row) => row.id),
      [2],
    );
    assert.deepEqual(
      check
        .prepare('SELECT id FROM SiteBanner')
        .all()
        .map((row) => row.id),
      [2],
    );
    assert.equal(check.prepare('SELECT authorId FROM StaticPage WHERE id = 1').get()?.authorId, null);
    assert.deepEqual(
      check
        .prepare('SELECT id FROM AdminLog')
        .all()
        .map((row) => row.id),
      [2],
    );
    assert.equal(check.prepare('SELECT COUNT(*) AS rows FROM CleanupConfirmation').get()?.rows, 0);
    assert.equal(check.prepare('SELECT userId FROM UploadedImage WHERE id = 1').get()?.userId, null);
    assert.deepEqual(check.prepare('PRAGMA foreign_key_check').all(), []);
    check.close();
  } finally {
    await app.close();
    await rm(directory, { recursive: true });
  }
});

test('binds OAuth callbacks to the initiating browser and reuses an existing social account after 2FA', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blex-oauth-test-'));
  const path = join(directory, 'oauth.sqlite3');
  const fixture = await migratedFixture(path);
  fixture.exec(`
    INSERT INTO "User" ("id", "username", "passwordHash", "email", "name", "joinedAt", "isActive", "isStaff", "isSuperuser") VALUES
    (45, 'social-reader', '!unusable', '', 'Reader', 946684800000, 1, 0, 0),
    (46, 'site-owner', '!unusable', 'new-social@example.invalid', 'Owner', 946684800000, 1, 1, 1);
  `);
  fixture
    .prepare('INSERT INTO "SocialProvider" (id, key, clientId, clientSecret, isEnabled) VALUES (1, ?, ?, ?, 1)')
    .run('google', 'synthetic-client', totpSecret);
  fixture
    .prepare(
      'INSERT INTO "SocialAccount" (providerId, uid, userId, extraData, createdAt) VALUES (1, ?, 45, ?, 946684800000)',
    )
    .run('existing-social-uid', '{}');
  fixture
    .prepare(`
    INSERT INTO "TwoFactorAuth" (userId, recoveryKey, totpSecret, createdAt)
    VALUES (45, ?, ?, 946684800000)
  `)
    .run(recoveryKey, totpSecret);
  fixture.close();

  let providerRequests = 0;
  let nextIdentity = { id: 'existing-social-uid', email: 'unrelated-address@example.invalid' };
  const fetchProvider: typeof fetch = async (url, options) => {
    providerRequests += 1;
    if (String(url) === 'https://oauth2.googleapis.com/token') {
      assert.equal(options?.method, 'POST');
      const body = options?.body as URLSearchParams;
      assert.equal(body.get('code'), 'synthetic-code');
      assert.equal(body.get('client_secret'), 'JBSWY3DPEHPK3PXP');
      assert.equal(body.get('code_verifier')?.length, 64);
      return Response.json({ access_token: 'synthetic-provider-access' });
    }
    assert.equal(String(url), 'https://www.googleapis.com/oauth2/v1/userinfo');
    return Response.json(nextIdentity);
  };

  const siteUrl = new URL('https://blex.example');
  const app = await buildApp(path, siteUrl, { secretKey: 'http-oauth-test-secret', cipherKey, fetchProvider });
  try {
    const providers = await app.inject('/v1/social-providers');
    assert.deepEqual(providers.json().body, [{ key: 'google', name: 'Google', clientId: 'synthetic-client' }]);
    const authorization = await app.inject('/login/start/google?next=%2Fsettings%2Faccount');
    assert.equal(authorization.statusCode, 302);
    const redirect = new URL(authorization.headers.location!);
    assert.equal(redirect.origin, 'https://accounts.google.com');
    assert.equal(redirect.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(redirect.searchParams.get('state'));
    const browser = cookiesFrom(authorization.headers['set-cookie']).find((item) =>
      item.startsWith('blex_oauth_google='),
    )!;
    const callback = `/login/callback/google?${new URLSearchParams({ state: redirect.searchParams.get('state')!, code: 'synthetic-code' })}`;
    assert.equal((await app.inject(callback)).headers.location, '/login');
    assert.equal(providerRequests, 0);

    const pending = await app.inject({ url: callback, headers: { cookie: browser } });
    assert.equal(pending.headers.location, '/login');
    const challenge = cookiesFrom(pending.headers['set-cookie']).find((item) =>
      item.startsWith('blex_oauth_challenge='),
    )!;
    assert.match(challenge, /^blex_oauth_challenge=.+/);
    assert.equal((await app.inject({ url: callback, headers: { cookie: browser } })).headers.location, '/login');
    assert.equal(providerRequests, 2);

    const csrfResponse = await app.inject('/v1/login');
    const [csrf] = cookiesFrom(csrfResponse.headers['set-cookie']);
    const headers = {
      origin: siteUrl.origin,
      cookie: `${challenge}; ${csrf}`,
      'x-csrftoken': csrf.slice('csrftoken='.length),
    };
    const authenticatorCode = new TOTP({ secret: Secret.fromBase32('JBSWY3DPEHPK3PXP') }).generate();
    const result = await app.inject({
      method: 'POST',
      url: '/v1/login',
      headers,
      payload: { oauth2fa: true, code: authenticatorCode },
    });
    assert.equal(result.json().body.username, 'social-reader');
    assert.ok(cookiesFrom(result.headers['set-cookie']).some((item) => item.startsWith('blexsessionid=')));
    const replay = await app.inject({
      method: 'POST',
      url: '/v1/login',
      headers,
      payload: { oauth2fa: true, code: authenticatorCode },
    });
    assert.equal(replay.json().errorCode, 'error:RJ');

    const next = '/settings/security';
    const verifyUrl = `/reauthenticate?${new URLSearchParams({ next })}`;
    const startVerification = `/login/start/google?${new URLSearchParams({ next })}`;
    const sessionHeaders = headersFor(result, siteUrl);
    const followAuthorization = (headers: ReturnType<typeof headersFor>, authorize: typeof authorization) => {
      const providerBrowser = cookiesFrom(authorize.headers['set-cookie']).find((entry) =>
        entry.startsWith('blex_oauth_google='),
      )!;
      const state = new URL(authorize.headers.location!).searchParams.get('state')!;
      return app.inject({
        url: `/login/callback/google?${new URLSearchParams({ state, code: 'synthetic-code' })}`,
        headers: { ...headers, cookie: `${providerBrowser}; ${headers.cookie}` },
      });
    };
    const startReauth = await app.inject({
      method: 'POST',
      url: startVerification,
      headers: sessionHeaders,
      payload: {},
    });
    assert.equal(new URL(startReauth.headers.location!).searchParams.get('prompt'), 'select_account');
    nextIdentity = { id: 'another-social-user', email: 'new-social@example.invalid' };
    const mismatch = await followAuthorization(sessionHeaders, startReauth);
    assert.equal(mismatch.headers.location, verifyUrl);
    assert.ok(!cookiesFrom(mismatch.headers['set-cookie']).some((entry) => entry.startsWith('blexsessionid=')));

    nextIdentity = { id: 'existing-social-uid', email: '' };
    const ownReauth = await app.inject({
      method: 'POST',
      url: startVerification,
      headers: sessionHeaders,
      payload: {},
    });
    const oauthVerified = await followAuthorization(sessionHeaders, ownReauth);
    assert.equal(oauthVerified.headers.location, verifyUrl);
    const pendingProof = headersFor(oauthVerified, siteUrl);
    const proofCompleted = await app.inject({
      method: 'POST',
      url: verifyUrl,
      headers: pendingProof,
      payload: { code: authenticatorCode },
    });
    assert.equal(proofCompleted.headers.location, next);

    nextIdentity = { id: 'brand-new-social-uid', email: 'new-social@example.invalid' };
    const newSignup = await app.inject('/login/start/google?timeZone=Asia%2FSeoul');
    const newAccount = await followAuthorization({ origin: siteUrl.origin, cookie: '', 'x-csrftoken': '' }, newSignup);
    assert.equal(newAccount.headers.location, '/');
    const newHeaders = headersFor(newAccount, siteUrl);
    const newViewer = await app.inject({ url: '/v1/login', headers: newHeaders });
    assert.equal(newViewer.json().body.username, 'new-social');
    assert.equal(newViewer.json().body.hasEditorRole, false);
    const check = new DatabaseSync(path, { readOnly: true });
    assert.notEqual(
      check.prepare("SELECT userId FROM SocialAccount WHERE uid = 'brand-new-social-uid'").get()?.userId,
      46,
    );
    assert.equal(
      check
        .prepare(
          "SELECT timeZone FROM UserPreference WHERE userId = (SELECT id FROM User WHERE username = 'new-social')",
        )
        .get()?.timeZone,
      'Asia/Seoul',
    );
    check.close();
  } finally {
    await app.close();
    await rm(directory, { recursive: true });
  }
});

test('reads encrypted 2FA and verifies the same TOTP window and recovery code', () => {
  const timestamp = 1_700_000_000_000;
  const stored = { totpSecret, recoveryKey };
  assert.equal(decryptSecret(totpSecret, cipherKey), 'JBSWY3DPEHPK3PXP');
  assert.equal(decryptSecret(totpSecret, 'x'.repeat(32)), null);
  assert.equal(decryptSecret(totpSecret.replace('VDlt', 'ADlt'), cipherKey), null);
  assert.equal(verifySecondFactor(stored, '324550', cipherKey, timestamp), true);
  assert.equal(verifySecondFactor(stored, '822542', cipherKey, timestamp), true);
  assert.equal(verifySecondFactor(stored, '968785', cipherKey, timestamp), false);
  assert.equal(verifySecondFactor(stored, recoveryCode, cipherKey, timestamp), true);
  assert.equal(verifySecondFactor(stored, 'wrong-recovery-code', cipherKey, timestamp), false);
});

test('requires 2FA for an active existing account and preserves the account ID upon verification', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'blex-auth-test-'));
  const path = join(temp, 'legacy-auth.sqlite3');
  const fixture = new DatabaseSync(path);
  fixture.exec(`
  ${migratedTableSql(...accountTables)}
  `);
  fixture
    .prepare('INSERT INTO "User" (id, username, passwordHash, isActive, email) VALUES (?, ?, ?, ?, \'\')')
    .run(42, 'existing', olderPasswordHash, 1);
  fixture
    .prepare('INSERT INTO "User" (id, username, passwordHash, isActive, email) VALUES (?, ?, ?, ?, \'\')')
    .run(43, 'inactive', olderPasswordHash, 0);
  fixture
    .prepare('INSERT INTO "TwoFactorAuth" (userId, totpSecret, recoveryKey, createdAt) VALUES (?, ?, ?, 946684800000)')
    .run(42, totpSecret, recoveryKey);
  fixture.close();

  const db = new PrismaClient({ datasourceUrl: `file:${path}` });
  try {
    assert.deepEqual(await authenticatePassword(db, 'existing', password, '', cipherKey), {
      status: 'second-factor-required',
      username: 'existing',
    });
    assert.deepEqual(await authenticatePassword(db, 'existing', password, '00000x', cipherKey), {
      status: 'invalid-second-factor',
    });
    assert.deepEqual(await authenticatePassword(db, 'existing', password, recoveryCode, cipherKey), {
      status: 'authenticated',
      userId: 42,
      username: 'existing',
      passwordHash: olderPasswordHash,
      spentRecoveryKey: recoveryKey,
    });
    assert.deepEqual(await authenticatePassword(db, 'inactive', password, '', cipherKey), {
      status: 'invalid-credentials',
    });
  } finally {
    await db.$disconnect();
    await rm(temp, { recursive: true });
  }
});

test('creates a first administrator against an empty Prisma database once', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blex-setup-test-'));
  const path = join(directory, 'setup.sqlite3');
  (await migratedFixture(path)).close();
  const siteUrl = new URL('https://blex.example');
  const setupToken = 'synthetic-setup-link-token';
  const app = await buildApp(path, siteUrl, { secretKey: 'initial-account-test-secret', cipherKey, setupToken });
  try {
    assert.equal((await app.inject('/login')).headers.location, '/setup');
    const form = await app.inject(`/setup?token=${setupToken}`);
    assert.equal(form.statusCode, 200);
    assert.match(form.body, /첫 관리자 만들기/);
    assert.equal(form.headers['referrer-policy'], 'strict-origin');
    const [csrf] = cookiesFrom(form.headers['set-cookie']);
    const headers = { origin: siteUrl.origin, cookie: csrf, 'x-csrftoken': csrf.slice('csrftoken='.length) };
    const account = { username: 'FIRSTADMIN', displayName: 'Test Admin', email: 'owner@Example.invalid' };
    const badToken = await app.inject({
      method: 'POST',
      url: '/setup',
      headers,
      payload: { ...account, setupToken: 'invalid' },
    });
    assert.match(badToken.body, /설정 토큰을 확인/);
    const weak = await app.inject({
      method: 'POST',
      url: '/setup',
      headers,
      payload: { ...account, setupToken: setupToken, password: 'password123', passwordCheck: 'password123' },
    });
    assert.match(weak.body, /흔히 사용되는 비밀번호/);
    const created = await app.inject({
      method: 'POST',
      url: '/setup',
      headers,
      payload: { ...account, setupToken: setupToken, password, passwordCheck: password },
    });
    assert.equal(created.statusCode, 302, created.body);
    assert.equal(created.headers.location, '/admin-settings/site-settings');
    assert.equal((await app.inject('/setup')).statusCode, 404);

    const session = cookiesFrom(created.headers['set-cookie']).join('; ');
    const identity = await app.inject({ url: '/v1/login', headers: { cookie: session } });
    assert.equal(identity.json().body.username, 'firstadmin');
    assert.equal(identity.json().body.email, 'owner@example.invalid');
    assert.equal(identity.json().body.hasEditorRole, true);
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      const user = db.prepare('SELECT passwordHash, isStaff, isSuperuser FROM "User" LIMIT 1').get();
      assert.equal(await verifyPassword(password, String(user?.passwordHash)), true);
      assert.equal(user?.isSuperuser, 1);
      assert.equal(user?.isStaff, 1);
      assert.deepEqual(
        {
          ...db
            .prepare('SELECT notifyMention, notifyCommentLike, notifyPostLike, notifyPostComment FROM UserPreference')
            .get(),
        },
        {
          notifyMention: 1,
          notifyCommentLike: 1,
          notifyPostLike: null,
          notifyPostComment: null,
        },
      );
    } finally {
      db.close();
    }
  } finally {
    await app.close();
    await rm(directory, { recursive: true });
  }
});
