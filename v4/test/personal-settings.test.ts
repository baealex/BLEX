import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { after, beforeEach, test } from 'node:test';
import { registerPersonalSettings } from '../src/personal-settings/index.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-personal-settings-'));
const databasePath = join(directory, 'synthetic-settings.sqlite3');
const mediaRoot = join(directory, 'media');
const csrfToken = 's'.repeat(43);

function createSchema() {
  const fixture = new DatabaseSync(databasePath);
  fixture.exec(`
    CREATE TABLE auth_user (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, first_name TEXT NOT NULL,
      email TEXT NOT NULL, date_joined DATETIME NOT NULL, is_active BOOLEAN NOT NULL DEFAULT 1
    );
    CREATE TABLE board_profile (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE, bio TEXT NOT NULL, cover TEXT NOT NULL,
      avatar TEXT NOT NULL, homepage TEXT NOT NULL, about_md TEXT NOT NULL, about_html TEXT NOT NULL,
      analytics_share_url TEXT NOT NULL, role TEXT NOT NULL
    );
    CREATE TABLE board_config (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE, language TEXT, time_zone TEXT NOT NULL
    );
    CREATE TABLE board_twofactorauth (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE, recovery_key TEXT NOT NULL,
      totp_secret TEXT NOT NULL, created_date DATETIME NOT NULL
    );
    CREATE TABLE board_loginsetting (
      id INTEGER PRIMARY KEY, account_deletion_redirect_url TEXT NOT NULL
    );
    CREATE TABLE board_userlinkmeta (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, value TEXT NOT NULL,
      created_date DATETIME NOT NULL, updated_date DATETIME NOT NULL, user_id INTEGER NOT NULL,
      "order" INTEGER NOT NULL
    );
  `);
  fixture.close();
}

function seed() {
  const fixture = new DatabaseSync(databasePath);
  fixture.exec(`
    DELETE FROM board_userlinkmeta;
    DELETE FROM board_twofactorauth;
    DELETE FROM board_config;
    DELETE FROM board_profile;
    DELETE FROM board_loginsetting;
    DELETE FROM auth_user;
    INSERT INTO auth_user VALUES
      (1, 'writer', 'Writer Name', 'writer@example.test', '2024-03-02 20:00:00', 1),
      (2, 'other', 'Other Name', 'other@example.test', '2023-01-01 00:00:00', 1);
    INSERT INTO board_profile VALUES
      (1, 1, 'Writer bio', '', 'writer.png', 'https://writer.example', '', '', '', 'EDITOR'),
      (2, 2, 'Other bio', '', 'other.png', '', '', '', '', 'READER');
    INSERT INTO board_config VALUES (1, 1, NULL, '');
    INSERT INTO board_loginsetting VALUES (1, '');
    INSERT INTO board_userlinkmeta VALUES
      (1, 'github', 'https://github.com/writer', '2024-01-01 00:00:00', '2024-01-01 00:00:00', 1, 1),
      (2, 'other', 'javascript:alert(1)', '2024-01-01 00:00:00', '2024-01-01 00:00:00', 1, 2),
      (3, 'github', 'https://github.com/other', '2024-01-01 00:00:00', '2024-01-01 00:00:00', 2, 1);
  `);
  fixture.close();
}

createSchema();
const db = new PrismaClient({ datasourceUrl: `file:${databasePath}?connection_limit=1` });
const app = Fastify();
let delegatedPayload: Record<string, unknown> | null = null;
registerPersonalSettings(app, db, {
  siteUrl: new URL('https://blog.example'),
  mediaRoot,
  currentUser: async (request) => {
    const value = request.headers['x-test-user'];
    const id = typeof value === 'string' ? Number(value) : NaN;
    if (id === 1) return { id, username: 'writer', hasEditorRole: true };
    if (id === 2) return { id, username: 'other', isStaff: true };
    return null;
  },
  validateCsrf: (request) => {
    const body = request.body as Record<string, unknown> | undefined;
    return request.headers.origin === 'https://blog.example'
      && request.headers.cookie?.includes(`csrftoken=${csrfToken}`) === true
      && (request.headers['x-csrftoken'] === csrfToken || body?.csrfmiddlewaretoken === csrfToken);
  },
  updatePassword: async (_request, _reply, _user, payload) => {
    delegatedPayload = payload;
    return { status: 'DONE', body: { delegated: true } };
  },
});
await app.ready();

after(async () => {
  await app.close();
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

beforeEach(async () => {
  delegatedPayload = null;
  seed();
  await rm(mediaRoot, { recursive: true, force: true });
  await mkdir(mediaRoot, { recursive: true, mode: 0o700 });
});

function headers(userId?: number, csrf = true) {
  return {
    ...(userId === undefined ? {} : { 'x-test-user': String(userId) }),
    ...(csrf ? {
      cookie: `csrftoken=${csrfToken}`,
      origin: 'https://blog.example',
      'x-csrftoken': csrfToken,
    } : {}),
  };
}

function form(fields: Array<[string, string]>) {
  return new URLSearchParams(fields).toString();
}

function multipart(fields: Array<{ name: string; value: string | Buffer; filename?: string; contentType?: string }>) {
  const boundary = 'blex-synthetic-profile-boundary';
  const pieces: Buffer[] = [];
  for (const field of fields) {
    pieces.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"${field.filename ? `; filename="${field.filename}"` : ''}\r\n${field.contentType ? `Content-Type: ${field.contentType}\r\n` : ''}\r\n`));
    pieces.push(Buffer.isBuffer(field.value) ? field.value : Buffer.from(field.value));
    pieces.push(Buffer.from('\r\n'));
  }
  pieces.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(pieces), contentType: `multipart/form-data; boundary=${boundary}` };
}

function legacyImagePath(username: string, kind: 'avatar' | 'cover', filename: string) {
  const prefix = createHash('md5').update(username).digest('hex').slice(0, 2);
  return `images/avatar/${prefix}/${username}/${kind === 'avatar' ? 'a' : 'c'}${filename}`;
}

test('serves only the implemented personal settings pages and protects them by login', async () => {
  const anonymous = await app.inject('/settings/account');
  assert.equal(anonymous.statusCode, 302);
  assert.equal(anonymous.headers.location, '/login?next=%2Fsettings%2Faccount');

  const index = await app.inject({ url: '/settings/', headers: headers(1) });
  assert.equal(index.statusCode, 302);
  assert.equal(index.headers.location, '/settings/notify');
  const staffIndex = await app.inject({ url: '/settings/', headers: headers(2) });
  assert.equal(staffIndex.statusCode, 302);
  assert.equal(staffIndex.headers.location, '/settings/notify');

  const accountPage = await app.inject({ url: '/settings/account', headers: headers(1) });
  assert.equal(accountPage.statusCode, 200);
  assert.match(accountPage.body, /href="\/settings\/profile"/);
  assert.match(accountPage.body, /href="\/settings\/social-links"/);
  assert.match(accountPage.body, /href="\/settings\/security"/);
  assert.match(accountPage.body, /href="\/settings\/developer-api"/);
  assert.doesNotMatch(accountPage.body, /href="\/settings\/(?:password|delete|email|mfa)"/);
  assert.match(accountPage.body, /name="csrfmiddlewaretoken" value="ssss/);
  assert.match(accountPage.body, /name="language"/);
  assert.match(accountPage.body, /name="time_zone"/);
  assert.match(accountPage.body, /Writer Name/);
  assert.match(accountPage.body, /2024-03-03/);

  const profilePage = await app.inject({ url: '/settings/profile', headers: headers(1) });
  assert.equal(profilePage.statusCode, 200);
  assert.match(profilePage.body, /프로필 사진/);
  assert.doesNotMatch(profilePage.body, /아바타/);
  assert.match(profilePage.body, /href="\/@writer\/about\/edit"/);
  assert.match(profilePage.body, /name="bio"/);
  assert.match(profilePage.body, /name="homepage"/);

  const profileApi = await app.inject({ url: '/v1/setting/profile', headers: headers(1) });
  assert.equal(profileApi.json().body.avatar, 'https://blog.example/resources/media/writer.png');
  assert.equal(profileApi.json().body.cover, null);

  const socialPage = await app.inject({ url: '/settings/social-links', headers: headers(1) });
  assert.equal(socialPage.statusCode, 200);
  assert.match(socialPage.body, /name="intent" value="create"/);
  assert.match(socialPage.body, /name="intent" value="delete"/);

  const staffAccount = await app.inject({ url: '/settings/account', headers: headers(2) });
  assert.match(staffAccount.body, /href="\/admin-settings\/"/);
});

test('reads and updates account name and regional preferences using the legacy envelopes', async () => {
  const read = await app.inject({ url: '/v1/setting/account', headers: headers(1) });
  assert.equal(read.statusCode, 200);
  const account = read.json();
  assert.equal(account.status, 'DONE');
  assert.equal(account.body.username, 'writer');
  assert.equal(account.body.name, 'Writer Name');
  assert.equal(account.body.createdDate, '2024-03-03');
  assert.equal(account.body.regionalPreferences.language, null);
  assert.equal(account.body.has2fa, false);
  assert.ok(account.body.regionalPreferences.timeZones.includes('UTC'));

  const name = await app.inject({
    method: 'PUT', url: '/v1/setting/account', headers: { ...headers(1), 'content-type': 'application/x-www-form-urlencoded' },
    payload: form([['name', 'Updated Name']]),
  });
  assert.deepEqual(name.json(), { status: 'DONE', body: {} });
  const [updatedUser] = await db.$queryRaw<Array<{ first_name: string }>>`SELECT first_name FROM auth_user WHERE id = 1`;
  assert.equal(updatedUser.first_name, 'Updated Name');

  const tooLongName = await app.inject({
    method: 'PUT', url: '/v1/setting/account', headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { name: 'x'.repeat(31) },
  });
  assert.equal(tooLongName.json().errorCode, 'error:VA');

  const regional = await app.inject({
    method: 'PUT', url: '/v1/setting/regional-preferences', headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { language: 'ko', time_zone: 'UTC' },
  });
  assert.deepEqual(regional.json(), { status: 'DONE', body: {} });
  const regionalRead = await app.inject({ url: '/v1/setting/account', headers: headers(1) });
  assert.equal(regionalRead.json().body.regionalPreferences.language, 'ko');
  assert.equal(regionalRead.json().body.regionalPreferences.timeZone, 'UTC');

  const invalidRegional = await app.inject({
    method: 'PUT', url: '/v1/setting/regional-preferences', headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { language: 'not-supported', time_zone: 'Nowhere/Nozone' },
  });
  assert.equal(invalidRegional.json().errorCode, 'error:VA');
  assert.equal(invalidRegional.json().messageKey, 'settings.regional_preferences.invalid_language');

  const denied = await app.inject({
    method: 'PUT', url: '/v1/setting/account', headers: headers(1, false), payload: { name: 'No CSRF' },
  });
  assert.equal(denied.statusCode, 403);

  const formName = await app.inject({
    method: 'POST', url: '/settings/account', headers: { ...headers(1), 'content-type': 'application/x-www-form-urlencoded' },
    payload: form([['csrfmiddlewaretoken', csrfToken], ['intent', 'name'], ['name', 'Form Name']]),
  });
  assert.equal(formName.statusCode, 303);
  assert.equal(formName.headers.location, '/settings/account?saved=1');

  const formRegional = await app.inject({
    method: 'POST', url: '/settings/account', headers: { ...headers(1), 'content-type': 'application/x-www-form-urlencoded' },
    payload: form([['csrfmiddlewaretoken', csrfToken], ['intent', 'regional'], ['language', 'browser'], ['time_zone', 'Asia/Seoul']]),
  });
  assert.equal(formRegional.statusCode, 303);
  const pageRegionalRead = await app.inject({ url: '/v1/setting/account', headers: headers(1) });
  assert.equal(pageRegionalRead.json().body.name, 'Form Name');
  assert.equal(pageRegionalRead.json().body.regionalPreferences.language, null);
  assert.equal(pageRegionalRead.json().body.regionalPreferences.timeZone, 'Asia/Seoul');
});

test('delegates password-bearing account changes to the injected reauthentication handler', async () => {
  const response = await app.inject({
    method: 'PUT', url: '/v1/setting/account', headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { username: 'newname', name: 'New Name', password: 'NewPassword123!' },
  });
  assert.deepEqual(response.json(), { status: 'DONE', body: { delegated: true } });
  assert.deepEqual(delegatedPayload, { username: 'newname', name: 'New Name', password: 'NewPassword123!' });
  const [user] = await db.$queryRaw<Array<{ username: string; first_name: string }>>`SELECT username, first_name FROM auth_user WHERE id = 1`;
  assert.deepEqual(user, { username: 'writer', first_name: 'Writer Name' });
});

test('updates profile safely through the API and progressive HTML form', async () => {
  const unsafe = await app.inject({
    method: 'PUT', url: '/v1/setting/profile', headers: { ...headers(1), 'content-type': 'application/x-www-form-urlencoded' },
    payload: form([['bio', 'Should not persist'], ['homepage', 'javascript:alert(1)']]),
  });
  assert.equal(unsafe.json().errorCode, 'error:VA');
  const [unchanged] = await db.$queryRaw<Array<{ bio: string; homepage: string }>>`SELECT bio, homepage FROM board_profile WHERE user_id = 1`;
  assert.deepEqual(unchanged, { bio: 'Writer bio', homepage: 'https://writer.example' });

  const updated = await app.inject({
    method: 'PUT', url: '/v1/setting/profile', headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { bio: 'Updated bio', homepage: 'https://example.test/profile' },
  });
  assert.deepEqual(updated.json(), { status: 'DONE', body: {} });

  const htmlUpdate = await app.inject({
    method: 'POST', url: '/settings/profile', headers: { ...headers(1), 'content-type': 'application/x-www-form-urlencoded' },
    payload: form([['csrfmiddlewaretoken', csrfToken], ['bio', 'Form bio'], ['homepage', 'https://form.example']]),
  });
  assert.equal(htmlUpdate.statusCode, 303);
  assert.equal(htmlUpdate.headers.location, '/settings/profile?saved=1');
  const read = await app.inject({ url: '/v1/setting/profile', headers: headers(1) });
  assert.equal(read.json().body.bio, 'Form bio');
  assert.equal(read.json().body.homepage, 'https://form.example');

  const savedPage = await app.inject({ url: '/settings/profile?saved=1', headers: headers(1) });
  assert.match(savedPage.body, /변경 사항을 저장했습니다/);
});

test('applies legacy social-link create, update, order and delete without crossing users', async () => {
  const read = await app.inject({ url: '/v1/setting/profile', headers: headers(1) });
  assert.deepEqual(read.json().body.social, [{ id: 1, name: 'github', value: 'https://github.com/writer', order: 1 }]);

  const updated = await app.inject({
    method: 'PUT', url: '/v1/setting/social', headers: { ...headers(1), 'content-type': 'application/x-www-form-urlencoded' },
    payload: form([
      ['update', '1,github,https://github.com/updated,3'],
      ['create', 'threads,https://threads.example/writer,1'],
      ['delete', '2'],
    ]),
  });
  assert.equal(updated.json().status, 'DONE');
  assert.deepEqual(updated.json().body.map((link: { name: string }) => link.name), ['threads', 'github']);
  const [ownLink] = await db.$queryRaw<Array<{ value: string; order: number }>>`SELECT value, "order" AS "order" FROM board_userlinkmeta WHERE id = 1`;
  assert.deepEqual(ownLink, { value: 'https://github.com/updated', order: 3 });
  const [privateLink] = await db.$queryRaw<Array<{ value: string }>>`SELECT value FROM board_userlinkmeta WHERE id = 3`;
  assert.equal(privateLink.value, 'https://github.com/other');

  const crossUserUpdate = await app.inject({
    method: 'PUT', url: '/v1/setting/social', headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { update: '3,github,https://attacker.example,1', create: '', delete: '' },
  });
  assert.equal(crossUserUpdate.json().errorCode, 'error:VA');
  const [stillPrivate] = await db.$queryRaw<Array<{ value: string }>>`SELECT value FROM board_userlinkmeta WHERE id = 3`;
  assert.equal(stillPrivate.value, 'https://github.com/other');

  const badSeparator = await app.inject({
    method: 'PUT', url: '/v1/setting/social', headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { update: '', create: 'github,https://example.test/a&b,2', delete: '' },
  });
  assert.equal(badSeparator.json().errorCode, 'error:VA');

  const formDelete = await app.inject({
    method: 'POST', url: '/settings/social-links', headers: { ...headers(1), 'content-type': 'application/x-www-form-urlencoded' },
    payload: form([['csrfmiddlewaretoken', csrfToken], ['intent', 'delete'], ['id', '1']]),
  });
  assert.equal(formDelete.statusCode, 303);
  const afterDelete = await app.inject({ url: '/v1/setting/profile', headers: headers(1) });
  assert.deepEqual(afterDelete.json().body.social, [{ id: 4, name: 'threads', value: 'https://threads.example/writer', order: 1 }]);
});

test('stores bounded profile images atomically under the owner media directory', async () => {
  const image = await sharp({ create: { width: 80, height: 40, channels: 3, background: { r: 18, g: 90, b: 170 } } }).png().toBuffer();
  for (const kind of ['avatar', 'cover'] as const) {
    const request = multipart([
      { name: 'csrfmiddlewaretoken', value: csrfToken },
      { name: kind, filename: 'client-controlled-name.png', contentType: 'image/png', value: image },
    ]);
    const response = await app.inject({
      method: 'POST', url: `/v1/setting/${kind}`,
      headers: { ...headers(1), 'content-type': request.contentType },
      payload: request.payload,
    });
    assert.deepEqual(response.json().status, 'DONE');
    assert.match(response.json().body.url, new RegExp(`^/resources/media/images/avatar/[a-f0-9]{2}/writer/${kind === 'avatar' ? 'a' : 'c'}[a-f0-9]{32}\\.png$`));

    const [profile] = await db.$queryRaw<Array<{ avatar: string; cover: string }>>`SELECT avatar, cover FROM board_profile WHERE user_id = 1`;
    const savedPath = kind === 'avatar' ? profile.avatar : profile.cover;
    assert.match(savedPath, new RegExp(`^images/avatar/[a-f0-9]{2}/writer/${kind === 'avatar' ? 'a' : 'c'}[a-f0-9]{32}\\.png$`));
    const bytes = await readFile(join(mediaRoot, ...savedPath.split('/')));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 80);
    assert.equal(metadata.height, 40);
  }

  const formUpload = multipart([
    { name: 'csrfmiddlewaretoken', value: csrfToken },
    { name: 'return_to', value: '/settings/profile?saved=avatar' },
    { name: 'avatar', filename: 'avatar.png', contentType: 'image/png', value: image },
  ]);
  const progressiveForm = await app.inject({
    method: 'POST', url: '/v1/setting/avatar', headers: { ...headers(1), 'content-type': formUpload.contentType }, payload: formUpload.payload,
  });
  assert.equal(progressiveForm.statusCode, 303);
  assert.equal(progressiveForm.headers.location, '/settings/profile?saved=avatar');

  const filesBeforeFailedSave = await readdir(join(mediaRoot, ...legacyImagePath('writer', 'avatar', 'probe.png').split('/').slice(0, -1)));
  await db.$executeRaw`DELETE FROM board_profile WHERE user_id = 1`;
  const failedUpload = multipart([{ name: 'avatar', filename: 'avatar.png', contentType: 'image/png', value: image }]);
  const failed = await app.inject({
    method: 'POST', url: '/v1/setting/avatar', headers: { ...headers(1), 'content-type': failedUpload.contentType }, payload: failedUpload.payload,
  });
  assert.equal(failed.statusCode, 500);
  const ownedDirectory = join(mediaRoot, ...legacyImagePath('writer', 'avatar', 'probe.png').split('/').slice(0, -1));
  assert.deepEqual(await readdir(ownedDirectory), filesBeforeFailedSave);
});

test('rejects invalid, oversized-dimension, and CSRF-free profile image uploads', async () => {
  const smallImage = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).png().toBuffer();
  const oversizedDimensions = Buffer.from(smallImage);
  oversizedDimensions.writeUInt32BE(4001, 16);
  oversizedDimensions.writeUInt32BE(4001, 20);
  for (const bytes of [Buffer.from('not an image'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), oversizedDimensions]) {
    const request = multipart([{ name: 'avatar', filename: 'profile.png', contentType: 'image/png', value: bytes }]);
    const response = await app.inject({
      method: 'POST', url: '/v1/setting/avatar', headers: { ...headers(1), 'content-type': request.contentType }, payload: request.payload,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().errorCode, 'error:VA');
  }

  const tooLargeRequest = multipart([{ name: 'avatar', filename: 'profile.png', contentType: 'image/png', value: Buffer.alloc(10 * 1024 * 1024 + 1) }]);
  const tooLarge = await app.inject({
    method: 'POST', url: '/v1/setting/avatar', headers: { ...headers(1), 'content-type': tooLargeRequest.contentType }, payload: tooLargeRequest.payload,
  });
  assert.equal(tooLarge.statusCode, 413);

  const noCsrfRequest = multipart([{ name: 'avatar', filename: 'profile.png', contentType: 'image/png', value: smallImage }]);
  const noCsrf = await app.inject({
    method: 'POST', url: '/v1/setting/avatar', headers: { ...headers(1, false), 'content-type': noCsrfRequest.contentType }, payload: noCsrfRequest.payload,
  });
  assert.equal(noCsrf.statusCode, 403);
  const [profile] = await db.$queryRaw<Array<{ avatar: string }>>`SELECT avatar FROM board_profile WHERE user_id = 1`;
  assert.equal(profile.avatar, 'writer.png');
  assert.deepEqual(await readdir(mediaRoot), []);
});

test('removes only scoped cover files and leaves symlink targets untouched', async () => {
  const coverPath = legacyImagePath('writer', 'cover', 'Test.png');
  const coverFile = join(mediaRoot, ...coverPath.split('/'));
  await mkdir(join(coverFile, '..'), { recursive: true, mode: 0o700 });
  await writeFile(coverFile, 'synthetic cover', { mode: 0o600 });
  await db.$executeRaw`UPDATE board_profile SET cover = ${coverPath} WHERE user_id = 1`;
  const removed = await app.inject({ method: 'DELETE', url: '/v1/setting/cover', headers: headers(1) });
  assert.deepEqual(removed.json(), { status: 'DONE', body: { url: null } });
  await assert.rejects(readFile(coverFile), { code: 'ENOENT' });
  const [cleared] = await db.$queryRaw<Array<{ cover: string }>>`SELECT cover FROM board_profile WHERE user_id = 1`;
  assert.equal(cleared.cover, '');

  await writeFile(coverFile, 'synthetic cover', { mode: 0o600 });
  await db.$executeRaw`UPDATE board_profile SET cover = ${coverPath} WHERE user_id = 1`;
  const formDelete = await app.inject({
    method: 'POST', url: '/settings/profile/cover/delete', headers: { ...headers(1), 'content-type': 'application/x-www-form-urlencoded' },
    payload: form([['csrfmiddlewaretoken', csrfToken]]),
  });
  assert.equal(formDelete.statusCode, 303);
  assert.equal(formDelete.headers.location, '/settings/profile?saved=cover');
  await assert.rejects(readFile(coverFile), { code: 'ENOENT' });

  const outsideDirectory = join(directory, 'outside-profile-media');
  await mkdir(outsideDirectory, { recursive: true, mode: 0o700 });
  const outsideFile = join(outsideDirectory, 'cTest.png');
  await writeFile(outsideFile, 'must remain', { mode: 0o600 });
  const userDirectory = join(mediaRoot, ...coverPath.split('/').slice(0, -1));
  await rm(userDirectory, { recursive: true, force: true });
  await mkdir(join(userDirectory, '..'), { recursive: true, mode: 0o700 });
  await symlink(outsideDirectory, userDirectory, 'dir');
  await db.$executeRaw`UPDATE board_profile SET cover = ${coverPath} WHERE user_id = 1`;
  const escaped = await app.inject({ method: 'DELETE', url: '/v1/setting/cover', headers: headers(1) });
  assert.equal(escaped.json().status, 'DONE');
  assert.equal(await readFile(outsideFile, 'utf8'), 'must remain');
});

test('restricts about editing to the active editor owner and sanitizes stored and saved HTML', async () => {
  const anonymous = await app.inject('/@writer/about/edit');
  assert.equal(anonymous.statusCode, 302);

  await db.$executeRaw`UPDATE board_profile SET about_md = 'Original **about**', about_html = '<script>alert(1)</script><p>Safe preview</p>' WHERE user_id = 1`;
  const page = await app.inject({ url: '/@writer/about/edit', headers: headers(1) });
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /name="about_md"/);
  assert.match(page.body, /Original \*\*about\*\*/);
  assert.match(page.body, /Safe preview/);
  assert.doesNotMatch(page.body, /<script>/);

  const notOwner = await app.inject({ url: '/@other/about/edit', headers: headers(1) });
  assert.equal(notOwner.statusCode, 403);
  const reader = await app.inject({ url: '/@other/about/edit', headers: headers(2) });
  assert.equal(reader.statusCode, 403);

  const htmlPost = await app.inject({
    method: 'POST', url: '/@writer/about/edit', headers: { ...headers(1), 'content-type': 'application/x-www-form-urlencoded' },
    payload: form([['csrfmiddlewaretoken', csrfToken], ['return_to', '1'], ['about_md', '# Hello\n\n<script>alert(2)</script>\n\n[Safe link](https://example.test)']]),
  });
  assert.equal(htmlPost.statusCode, 303);
  assert.equal(htmlPost.headers.location, '/@writer/about/edit?saved=1');
  const [savedProfile] = await db.$queryRaw<Array<{ about_md: string; about_html: string }>>`SELECT about_md, about_html FROM board_profile WHERE user_id = 1`;
  assert.match(savedProfile.about_html, /<h1[^>]*>Hello<\/h1>/);
  assert.doesNotMatch(savedProfile.about_html, /<script>/);
  const refreshedPage = await app.inject({ url: '/@writer/about/edit?saved=1', headers: headers(1) });
  assert.match(refreshedPage.body, /변경 사항을 저장했습니다/);

  const apiSave = await app.inject({
    method: 'PUT', url: '/v1/users/@writer', headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { about: true, about_md: 'API **save**' },
  });
  assert.deepEqual(apiSave.json(), { status: 'DONE', body: {} });
  const unauthorizedSave = await app.inject({
    method: 'PUT', url: '/v1/users/@writer', headers: { ...headers(2), 'content-type': 'application/json' },
    payload: { about: true, about_md: 'Not mine' },
  });
  assert.equal(unauthorizedSave.json().errorCode, 'error:AT');
  const missingCsrf = await app.inject({
    method: 'PUT', url: '/v1/users/@writer', headers: { ...headers(1, false), 'content-type': 'application/json' },
    payload: { about: true, about_md: 'No CSRF' },
  });
  assert.equal(missingCsrf.statusCode, 403);
  const anonymousSave = await app.inject({
    method: 'PUT', url: '/v1/users/@writer', headers: { 'content-type': 'application/json' }, payload: { about: true, about_md: 'No login' },
  });
  assert.equal(anonymousSave.json().errorCode, 'error:NL');
});
