import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { Secret, TOTP } from 'otpauth';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { decryptSecret, encryptSecret } from '../src/features/auth/encrypted-secret.js';
import { reserveLoginAttempt } from '../src/features/auth/login-attempts.js';
import { consumePendingOAuth } from '../src/features/auth/oauth.js';
import { createToken, tokenHash } from '../src/features/auth/session.js';
import { verifySecondFactor } from '../src/features/auth/two-factor.js';
import { createMigratedDatabase, insertRow, testCipherKey, testSecretKey, testSiteUrl } from './fixtures/migrated-database.js';

// Produced by Django for this password, so a passing login proves 3.14 hashes still verify.
const password = 'compatibility-비밀번호-2026';
const passwordHash = 'pbkdf2_sha256$100000$TestOnlyBlexCompatibilitySalt$C7LHeNRVZX18ry19YwDvmo1l7q8hcL5jtbv2QGe2x8E=';
const newPassword = 'Migrate!2026-개발자';
const totpBase32 = 'JBSWY3DPEHPK3PXP';

function cookiesFrom(headers: string | string[] | undefined) {
  return (Array.isArray(headers) ? headers : headers ? [headers] : []).map((header) => header.split(';')[0]);
}

type Headers = { origin: string; cookie: string; 'x-csrftoken': string };

function browser(response: { headers: { 'set-cookie'?: string | string[] } }, previous?: Headers): Headers {
  const jar = new Map((previous?.cookie.split('; ').filter(Boolean) ?? []).map((cookie) => [cookie.split('=')[0], cookie]));
  for (const cookie of cookiesFrom(response.headers['set-cookie'])) jar.set(cookie.split('=')[0], cookie);
  const csrf = jar.get('csrftoken')?.slice('csrftoken='.length) ?? '';
  return { origin: testSiteUrl.origin, cookie: [...jar.values()].join('; '), 'x-csrftoken': csrf };
}

async function withApp(run: (app: FastifyInstance, db: PrismaClient, path: string, mediaRoot: string) => Promise<void>, seed?: (fixture: Awaited<ReturnType<typeof createMigratedDatabase>>) => void) {
  const fixture = await createMigratedDatabase();
  seed?.(fixture);
  const app = await buildApp(fixture.path, testSiteUrl, { secretKey: testSecretKey, cipherKey: testCipherKey }, fixture.mediaRoot);
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}?connection_limit=1` });
  try {
    await run(app, db, fixture.path, fixture.mediaRoot);
  } finally {
    await db.$disconnect();
    await app.close();
    await fixture.cleanup();
  }
}

const seedUser = (fixture: Awaited<ReturnType<typeof createMigratedDatabase>>, id: number, username: string, extra: Record<string, number | string> = {}) => {
  insertRow(fixture.db, 'User', { id, username, passwordHash, isActive: 1, ...extra });
  insertRow(fixture.db, 'Profile', { userId: id, role: 'EDITOR' });
};

async function signIn(app: FastifyInstance, username: string, code?: string) {
  const anonymous = browser(await app.inject('/v1/login'));
  const response = await app.inject({ method: 'POST', url: '/v1/login', headers: anonymous, payload: { username, password, ...(code ? { code } : {}) } });
  assert.equal(response.json().status, 'DONE', response.body);
  return browser(response, anonymous);
}

const reauthenticate = async (app: FastifyInstance, headers: Headers, secret = password) =>
  browser(await app.inject({ method: 'POST', url: '/reauthenticate', headers, payload: { password: secret } }), headers);

const isSignedIn = async (app: FastifyInstance, headers: Headers) =>
  (await app.inject({ url: '/v1/login', headers })).json().status === 'DONE';

const sessionToken = (headers: Headers) => /blexsessionid=([^;]+)/.exec(headers.cookie)?.[1] ?? '';

test('a stored password change invalidates sessions through the credential tag', () => withApp(async (app, db) => {
  const session = await signIn(app, 'writer');
  assert.equal(await isSignedIn(app, session), true);
  await db.user.update({ where: { id: 1 }, data: { passwordHash: `${passwordHash}x` } });
  assert.equal(await isSignedIn(app, session), false);
  await db.user.update({ where: { id: 1 }, data: { passwordHash } });
  assert.equal(await isSignedIn(app, session), true);
}, (fixture) => seedUser(fixture, 1, 'writer')));

test('a password change keeps only the rotated session and clears its verification', () => withApp(async (app, db) => {
  const other = await signIn(app, 'writer');
  const current = await reauthenticate(app, await signIn(app, 'writer'));
  const changed = await app.inject({ method: 'PUT', url: '/v1/setting/account', headers: current, payload: { password: newPassword } });
  assert.equal(changed.json().status, 'DONE', changed.body);
  const rotated = browser(changed, current);
  assert.notEqual(sessionToken(rotated), sessionToken(current));
  assert.equal(await isSignedIn(app, current), false);
  assert.equal(await isSignedIn(app, other), false);
  assert.equal(await isSignedIn(app, rotated), true);
  const [stored] = await db.session.findMany({ select: { verifiedUntil: true, verifiedFactorId: true, requiresFactor: true } });
  assert.deepEqual(stored, { verifiedUntil: null, verifiedFactorId: null, requiresFactor: false });
  assert.equal(await db.session.count(), 1);
}, (fixture) => seedUser(fixture, 1, 'writer')));

test('sessions end at their expiry and on logout', () => withApp(async (app, db) => {
  const expiring = await signIn(app, 'writer');
  await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1) } });
  assert.equal(await isSignedIn(app, expiring), false);
  const session = await signIn(app, 'writer');
  assert.equal((await app.inject({ method: 'POST', url: '/v1/logout', headers: session })).json().status, 'DONE');
  assert.equal(await isSignedIn(app, session), false);
  assert.equal(await db.session.count({ where: { tokenHash: tokenHash(sessionToken(session)) } }), 0);
}, (fixture) => seedUser(fixture, 1, 'writer')));

test('sensitive actions need an unexpired, factor-complete verification, and verifying rotates the token', () => withApp(async (app, db) => {
  const session = await signIn(app, 'writer');
  const verified = await reauthenticate(app, session);
  assert.notEqual(sessionToken(verified), sessionToken(session));
  assert.equal(await isSignedIn(app, session), false);
  const attempt = () => app.inject({ method: 'PUT', url: '/v1/setting/account', headers: verified, payload: { password: newPassword } });

  await db.session.updateMany({ data: { verifiedUntil: new Date(Date.now() - 1) } });
  assert.equal((await attempt()).json().errorCode, 'error:RE');
  await db.session.updateMany({ data: { verifiedUntil: new Date(Date.now() + 60_000), requiresFactor: true } });
  assert.equal((await attempt()).json().errorCode, 'error:RE');
  await db.session.updateMany({ data: { requiresFactor: false, verifiedFactorId: 99 } });
  assert.equal((await attempt()).json().errorCode, 'error:RE');
  await db.session.updateMany({ data: { verifiedFactorId: null } });
  assert.equal((await attempt()).json().status, 'DONE');
}, (fixture) => seedUser(fixture, 1, 'writer')));

test('login limits hold under concurrency and reject without consuming the other limit', () => withApp(async (_app, db) => {
  const sameIp = await Promise.all(Array.from({ length: 12 }, (_, index) => reserveLoginAttempt(db, testSecretKey, '203.0.113.1', `name${index}`)));
  assert.equal(sameIp.filter(Boolean).length, 5);

  const sameAccount = await Promise.all(Array.from({ length: 16 }, (_, index) => reserveLoginAttempt(db, testSecretKey, `198.51.100.${index}`, 'Target')));
  assert.equal(sameAccount.filter(Boolean).length, 10);
  assert.equal(await reserveLoginAttempt(db, testSecretKey, '192.0.2.200', 'TARGET'), null, 'the account key ignores case');
  // A rejected account attempt must not have spent the IP's allowance.
  assert.ok(await reserveLoginAttempt(db, testSecretKey, '192.0.2.200', 'someone-else'));

  const release = sameIp.find(Boolean)!;
  await release();
  assert.ok(await reserveLoginAttempt(db, testSecretKey, '203.0.113.1', 'after-release'));
  assert.equal(await reserveLoginAttempt(db, testSecretKey, '203.0.113.1', 'over-limit'), null);
}));

test('a reused invite signs up exactly one editor under concurrency', () => withApp(async (app, db) => {
  const anonymous = browser(await app.inject('/sign'));
  const responses = await Promise.all(['inviteone', 'invitetwo', 'invitethree', 'invitefour'].map((username, index) => app.inject({
    method: 'POST', url: '/v1/sign', headers: anonymous, remoteAddress: `198.51.100.${index + 1}`,
    payload: { username, name: 'Invited', email: `${username}@example.test`, password: newPassword, inviteCode: 'single-use' },
  })));
  assert.equal(responses.filter((response) => response.json().status === 'DONE').length, 1);
  assert.ok(responses.filter((response) => response.json().status !== 'DONE').every((response) => response.json().errorCode === 'error:RJ'));
  const invite = await db.authorInvite.findUniqueOrThrow({ where: { code: 'single-use' }, select: { isActive: true, claimedById: true, claimedAt: true } });
  assert.equal(invite.isActive, false);
  assert.ok(invite.claimedById && invite.claimedAt);
  assert.equal(await db.profile.count({ where: { role: 'EDITOR', userId: { not: 1 } } }), 1);
  assert.equal(await db.user.count(), 2);
}, (fixture) => {
  seedUser(fixture, 1, 'owner', { isStaff: 1, isSuperuser: 1 });
  insertRow(fixture.db, 'AuthorInvite', { code: 'single-use', createdById: 1 });
}));

test('an OAuth state and a pending OAuth challenge are each consumed once under concurrency', () => withApp(async (app, db) => {
  const started = await app.inject('/login/start/google');
  const state = new URL(started.headers.location!).searchParams.get('state')!;
  const cookie = cookiesFrom(started.headers['set-cookie']).find((item) => item.startsWith('blex_oauth_google='))!;
  await Promise.all(Array.from({ length: 6 }, () => app.inject({
    url: `/login/callback/google?${new URLSearchParams({ state, code: 'synthetic-code' })}`,
    headers: { cookie },
  })));
  assert.equal(await db.oAuthFlow.count(), 0);

  const token = createToken();
  await db.oAuthChallenge.create({
    data: { tokenHash: createHash('sha256').update(token).digest('hex'), socialAccountId: 1, returnPath: '/', expiresAt: new Date(Date.now() + 60_000) },
  });
  const claims = await Promise.all(Array.from({ length: 6 }, () => consumePendingOAuth(db, token)));
  assert.equal(claims.filter(Boolean).length, 1);
}, (fixture) => {
  seedUser(fixture, 1, 'social');
  insertRow(fixture.db, 'SocialProvider', { id: 1, key: 'google', clientId: 'client', clientSecret: encryptSecret('oauth-secret', testCipherKey), isEnabled: 1 });
  insertRow(fixture.db, 'SocialAccount', { id: 1, providerId: 1, uid: 'uid-1', userId: 1 });
}));

test('a factor setup activates once under concurrency, and only with a valid code', () => withApp(async (app, db) => {
  const verified = await reauthenticate(app, await signIn(app, 'writer'));
  const setup = await app.inject({ method: 'POST', url: '/v1/auth/security', headers: verified });
  assert.equal(setup.json().status, 'DONE');
  const pending = await db.factorSetup.findFirstOrThrow({ select: { secret: true } });
  const code = new TOTP({ secret: Secret.fromBase32(decryptSecret(pending.secret, testCipherKey)!) }).generate();
  const wrongCode = code === '000000' ? '000001' : '000000';
  const wrong = await app.inject({ method: 'POST', url: '/v1/auth/security/verify', headers: verified, payload: { code: wrongCode } });
  assert.equal(wrong.json().errorCode, 'error:RJ');
  assert.equal(await db.factorSetup.count(), 1);

  const results = await Promise.all(Array.from({ length: 5 }, () => app.inject({ method: 'POST', url: '/v1/auth/security/verify', headers: verified, payload: { code } })));
  assert.equal(results.filter((response) => response.json().status === 'DONE').length, 1);
  assert.equal(await db.twoFactorAuth.count({ where: { userId: 1 } }), 1);
  assert.equal(await db.factorSetup.count(), 0);
}, (fixture) => seedUser(fixture, 1, 'writer')));

const importedRecoveryCode = 'test-only-recovery-code';
const importedRecoveryHash = '831c28715dcd5f61787dc41ad7bf1663f904ab40c6220da4630e7fddecae6fe8';
const seedFactorUser = (fixture: Awaited<ReturnType<typeof createMigratedDatabase>>, createdAt = Date.UTC(2024, 0, 1)) => {
  seedUser(fixture, 1, 'writer');
  insertRow(fixture.db, 'TwoFactorAuth', { userId: 1, totpSecret: encryptSecret(totpBase32, testCipherKey), recoveryKey: importedRecoveryHash, createdAt });
};
const currentCode = () => new TOTP({ secret: Secret.fromBase32(totpBase32) }).generate();

test('an imported recovery key signs in exactly once under concurrency and turns the factor off', () => withApp(async (app, db) => {
  const anonymous = browser(await app.inject('/v1/login'));
  const attempts = await Promise.all(Array.from({ length: 4 }, () => app.inject({
    method: 'POST', url: '/v1/login', headers: anonymous, payload: { username: 'writer', password, code: importedRecoveryCode },
  })));
  const winners = attempts.filter((response) => response.json().status === 'DONE');
  assert.equal(winners.length, 1);
  assert.equal(winners[0].json().body.recoveryKeyUsed, true);
  assert.equal(winners[0].json().body.hasConnected2fa, false);
  assert.doesNotMatch(winners[0].body, new RegExp(importedRecoveryHash));
  for (const loser of attempts.filter((response) => response !== winners[0])) assert.equal(loser.json().errorCode, 'error:RJ');
  assert.equal(await db.twoFactorAuth.count({ where: { userId: 1 } }), 0);

  const replay = await app.inject({ method: 'POST', url: '/v1/login', headers: anonymous, payload: { username: 'writer', password, code: importedRecoveryCode } });
  assert.equal(replay.json().errorCode, 'error:RJ');
  assert.equal(replay.headers['set-cookie'], undefined);
  assert.match(replay.json().errorMessage, /이미 사용한 복구 키/);
}, seedFactorUser));

test('an owner without their authenticator is never locked out after spending the key', () => withApp(async (app, db) => {
  const otherDevice = await signIn(app, 'writer', currentCode());
  const proved = browser(await app.inject({ method: 'POST', url: '/reauthenticate', headers: otherDevice, payload: { password, code: currentCode() } }), otherDevice);
  assert.equal((await app.inject({ url: '/v1/setting/account', headers: proved })).json().body.has2fa, true);

  const recovered = await signIn(app, 'writer', importedRecoveryCode);
  // A proof from before the key was spent no longer unlocks anything.
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/security', headers: proved })).json().errorCode, 'error:RE');
  assert.equal((await app.inject({ url: '/v1/setting/account', headers: recovered })).json().body.has2fa, false);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/logout', headers: recovered })).json().status, 'DONE');

  const passwordOnly = await signIn(app, 'writer');
  const verified = await reauthenticate(app, passwordOnly);
  const setup = await app.inject({ method: 'POST', url: '/v1/auth/security', headers: verified });
  const replacement = setup.json().body.recoveryKey as string;
  assert.notEqual(replacement, importedRecoveryCode);
  const pending = await db.factorSetup.findFirstOrThrow({ select: { secret: true } });
  const code = new TOTP({ secret: Secret.fromBase32(decryptSecret(pending.secret, testCipherKey)!) }).generate();
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/security/verify', headers: verified, payload: { code } })).json().status, 'DONE');
  assert.equal(await db.twoFactorAuth.count({ where: { userId: 1 } }), 1);

  const challenged = browser(await app.inject('/v1/login'));
  assert.equal((await app.inject({ method: 'POST', url: '/v1/login', headers: challenged, payload: { username: 'writer', password } })).json().body.security, true);
  assert.equal(await isSignedIn(app, await signIn(app, 'writer', replacement)), true);
  assert.equal(await db.twoFactorAuth.count({ where: { userId: 1 } }), 0);
}, (fixture) => seedFactorUser(fixture, Date.now())));

test('a recovery key used on an OAuth challenge is spent once and never burned by a failed challenge', () => withApp(async (app, db) => {
  const challenge = async () => {
    const token = createToken();
    await db.oAuthChallenge.create({
      data: { tokenHash: createHash('sha256').update(token).digest('hex'), socialAccountId: 1, returnPath: '/', expiresAt: new Date(Date.now() + 60_000) },
    });
    return token;
  };
  const anonymous = browser(await app.inject('/v1/login'));
  const submit = (token: string, code: string) => app.inject({
    method: 'POST', url: '/v1/login', headers: { ...anonymous, cookie: `${anonymous.cookie}; blex_oauth_challenge=${token}` }, payload: { oauth2fa: true, code },
  });

  assert.equal((await submit(await challenge(), 'not-the-recovery-key')).json().errorCode, 'error:RJ');
  assert.equal(await db.twoFactorAuth.count({ where: { userId: 1 } }), 1);

  const token = await challenge();
  const signedIn = await submit(token, importedRecoveryCode);
  assert.equal(signedIn.json().status, 'DONE', signedIn.body);
  assert.equal(signedIn.json().body.recoveryKeyUsed, true);
  assert.equal(await db.twoFactorAuth.count({ where: { userId: 1 } }), 0);
  assert.equal((await submit(token, importedRecoveryCode)).json().errorCode, 'error:RJ');
}, (fixture) => {
  seedFactorUser(fixture);
  insertRow(fixture.db, 'SocialProvider', { id: 1, key: 'google', clientId: 'client', clientSecret: encryptSecret('oauth-secret', testCipherKey), isEnabled: 1 });
  insertRow(fixture.db, 'SocialAccount', { id: 1, providerId: 1, uid: 'uid-1', userId: 1 });
}));

test('a recovery key spent on a step-up check keeps that proof, and a wrong code spends nothing', () => withApp(async (app, db) => {
  const session = await signIn(app, 'writer', currentCode());
  const wrong = await app.inject({ method: 'POST', url: '/reauthenticate', headers: session, payload: { password, code: 'not-the-recovery-key' } });
  assert.equal(wrong.statusCode, 200);
  assert.equal((await db.twoFactorAuth.findUniqueOrThrow({ where: { userId: 1 } })).recoveryKey, importedRecoveryHash);

  const spent = await app.inject({ method: 'POST', url: '/reauthenticate', headers: session, payload: { password, code: importedRecoveryCode } });
  assert.equal(spent.statusCode, 302);
  assert.equal(spent.headers.location, '/settings/account?recoveryKeyUsed=1');
  assert.equal(await db.twoFactorAuth.count({ where: { userId: 1 } }), 0);
  const proved = browser(spent, session);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/security', headers: proved })).json().status, 'DONE');
}, seedFactorUser));

test('concurrent deletions never remove the last active superuser', () => withApp(async (app, db) => {
  const first = await reauthenticate(app, await signIn(app, 'adminone'));
  const second = await reauthenticate(app, await signIn(app, 'admintwo'));
  const results = await Promise.all([first, second].map((headers) => app.inject({ method: 'DELETE', url: '/v1/sign', headers })));
  assert.deepEqual(results.map((response) => response.json().status).sort(), ['DONE', 'ERROR']);
  assert.equal(await db.user.count({ where: { isSuperuser: true, isActive: true } }), 1);
}, (fixture) => {
  seedUser(fixture, 1, 'adminone', { isStaff: 1, isSuperuser: 1 });
  seedUser(fixture, 2, 'admintwo', { isStaff: 1, isSuperuser: 1 });
}));

test('an inactive superuser does not count as the remaining administrator', () => withApp(async (app, db) => {
  const verified = await reauthenticate(app, await signIn(app, 'adminone'));
  const refused = await app.inject({ method: 'DELETE', url: '/v1/sign', headers: verified });
  assert.equal(refused.json().errorCode, 'error:RJ');
  assert.equal(await db.user.count({ where: { id: 1 } }), 1);
}, (fixture) => {
  seedUser(fixture, 1, 'adminone', { isStaff: 1, isSuperuser: 1 });
  seedUser(fixture, 2, 'retired', { isStaff: 1, isSuperuser: 1, isActive: 0 });
}));

test('account deletion cascades owned rows, anonymizes comments, and removes work log files only after commit', () => withApp(async (app, db, _path, mediaRoot) => {
  const attachment = 'deleted/clip.webp';
  await mkdir(join(mediaRoot, '_work_logs', 'deleted'), { recursive: true });
  await writeFile(join(mediaRoot, '_work_logs', attachment), 'clip');
  await db.workLogEntry.create({ data: { logId: 1, title: 'Clip', mediaType: 'image/webp', attachment } });

  const reader = await signIn(app, 'reader');
  assert.equal((await app.inject({ method: 'DELETE', url: '/v1/sign', headers: reader })).json().errorCode, 'error:RE');
  assert.equal(existsSync(join(mediaRoot, '_work_logs', attachment)), true, 'a refused deletion keeps the file');

  const verified = await reauthenticate(app, reader);
  assert.equal((await app.inject({ method: 'DELETE', url: '/v1/sign', headers: verified })).json().status, 'DONE');
  assert.equal(existsSync(join(mediaRoot, '_work_logs', attachment)), false);
  assert.equal(await db.user.count({ where: { id: 2 } }), 0);
  for (const count of await Promise.all([
    db.profile.count({ where: { userId: 2 } }), db.userPreference.count({ where: { userId: 2 } }), db.socialLink.count({ where: { userId: 2 } }),
    db.socialAccount.count({ where: { userId: 2 } }), db.twoFactorAuth.count({ where: { userId: 2 } }), db.usernameChange.count({ where: { userId: 2 } }),
    db.session.count({ where: { userId: 2 } }), db.workLog.count({ where: { ownerId: 2 } }),
  ])) assert.equal(count, 0);
  const comment = await db.comment.findUniqueOrThrow({ where: { id: 1 }, select: { authorId: true, markdown: true } });
  assert.deepEqual(comment, { authorId: null, markdown: 'kept' });
  const invite = await db.authorInvite.findUniqueOrThrow({ where: { code: 'claimed' }, select: { createdById: true, claimedById: true, isActive: true } });
  assert.deepEqual(invite, { createdById: 1, claimedById: null, isActive: false });
}, (fixture) => {
  seedUser(fixture, 1, 'owner', { isStaff: 1, isSuperuser: 1 });
  seedUser(fixture, 2, 'reader');
  insertRow(fixture.db, 'UserPreference', { userId: 2, notifyMention: 1 });
  insertRow(fixture.db, 'SocialLink', { userId: 2, platform: 'github', url: 'https://github.com/reader' });
  insertRow(fixture.db, 'SocialProvider', { id: 1, key: 'google' });
  insertRow(fixture.db, 'SocialAccount', { providerId: 1, uid: 'uid', userId: 2 });
  insertRow(fixture.db, 'UsernameChange', { userId: 2, username: 'formername' });
  insertRow(fixture.db, 'AuthorInvite', { code: 'claimed', createdById: 1, claimedById: 2, isActive: 0 });
  insertRow(fixture.db, 'WorkLog', { id: 1, ownerId: 2, title: 'Log' });
  insertRow(fixture.db, 'Post', { id: 1, authorId: 1, slug: 'kept', title: 'Kept', updatedAt: 946684800000, createdAt: 946684800000 });
  insertRow(fixture.db, 'Comment', { id: 1, postId: 1, authorId: 2, markdown: 'kept' });
}));

test('an oversized social link id or order cannot break links for other accounts', () => withApp(async (app, db) => {
  const writer = await signIn(app, 'writer');
  const other = await signIn(app, 'other');
  const save = (headers: Headers, payload: Record<string, string>) => app.inject({
    method: 'PUT', url: '/v1/setting/social', headers, payload: { update: '', create: '', delete: '', ...payload },
  });
  for (const id of ['2147483647', '3000000000']) {
    assert.equal((await save(writer, { update: `${id},github,https://github.com/writer${id},1` })).json().status, 'DONE');
  }
  assert.equal((await save(writer, { create: 'threads,https://threads.example/writer,3000000000' })).json().status, 'DONE');
  assert.equal((await save(writer, { delete: '3000000000' })).json().status, 'DONE');
  const created = await save(other, { create: 'github,https://github.com/other,1' });
  assert.equal(created.json().status, 'DONE', created.body);
  assert.equal((await app.inject({ url: '/v1/setting/profile', headers: other })).json().body.social.length, 1);
  const stored = await db.socialLink.findMany({ select: { id: true, order: true } });
  assert.equal(stored.length, 4);
  assert.ok(stored.every(({ id }) => id <= 1_073_741_824));
  assert.equal(Math.max(...stored.map(({ order }) => order)), 2_147_483_647);
}, (fixture) => {
  seedUser(fixture, 1, 'writer');
  seedUser(fixture, 2, 'other');
}));

test('usernames stay case-sensitive and old names keep redirecting after a rename', () => withApp(async (app, db) => {
  const anonymous = browser(await app.inject('/v1/login'));
  const wrongCase = await app.inject({ method: 'POST', url: '/v1/login', headers: anonymous, payload: { username: 'WRITER', password } });
  assert.equal(wrongCase.json().errorCode, 'error:AT');
  const session = await signIn(app, 'writer');
  const invalid = await app.inject({ method: 'PUT', url: '/v1/setting/account', headers: session, payload: { username: 'Not-Valid' } });
  assert.equal(invalid.json().errorCode, 'error:VA');
  const renamed = await app.inject({ method: 'PUT', url: '/v1/setting/account', headers: session, payload: { username: 'newname' } });
  assert.equal(renamed.json().status, 'DONE', renamed.body);
  assert.deepEqual(await db.usernameChange.findMany({ select: { userId: true, username: true } }), [{ userId: 1, username: 'writer' }]);
  const check = await app.inject('/v1/users/@writer/check-redirect');
  assert.equal(check.json().body.newUsername, 'newname');
  const again = await app.inject({ method: 'PUT', url: '/v1/setting/account', headers: session, payload: { username: 'thirdname' } });
  assert.equal(again.json().status, 'DONE', 'an account without posts may rename again');
}, (fixture) => seedUser(fixture, 1, 'writer')));
