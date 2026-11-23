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
import { registerPersonalSettings } from '../src/features/account/index.js';
import { accountTables, createMigratedTables, migratedTableSql } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-personal-settings-'));
const databasePath = join(directory, 'synthetic-settings.sqlite3');
const mediaRoot = join(directory, 'media');
const csrfToken = 's'.repeat(43);

function createSchema() {
  const fixture = new DatabaseSync(databasePath);
  createMigratedTables(fixture, 'LoginSetting');
  fixture.exec(`
  ${migratedTableSql(...accountTables)}
  `);
  fixture.close();
}

function seed() {
  const fixture = new DatabaseSync(databasePath);
  fixture.exec(`
    DELETE FROM "SocialLink";
    DELETE FROM "TwoFactorAuth";
    DELETE FROM "UserPreference";
    DELETE FROM "Profile";
    DELETE FROM LoginSetting;
    DELETE FROM "User";
    INSERT INTO "User" ("id", "username", "name", "email", "joinedAt", "isActive", "passwordHash") VALUES
    (1, 'writer', 'Writer Name', 'writer@example.test', 1709409600000, 1, ''),
    (2, 'other', 'Other Name', 'other@example.test', 1672531200000, 1, '');
    INSERT INTO "Profile" ("userId", "bio", "cover", "avatar", "homepage", "aboutMarkdown", "aboutHtml", "role") VALUES
    (1, 'Writer bio', '', 'writer.png', 'https://writer.example', '', '', 'EDITOR'),
    (2, 'Other bio', '', 'other.png', '', '', '', 'READER');
    INSERT INTO "UserPreference" ("userId", "language", "timeZone") VALUES
    (1, NULL, '');
    INSERT INTO LoginSetting (id, updatedAt) VALUES (1, 946684800000);
    INSERT INTO "SocialLink" ("id", "platform", "url", "createdAt", "updatedAt", "userId", "order") VALUES
    (1, 'github', 'https://github.com/writer', 1704067200000, 1704067200000, 1, 1),
    (2, 'other', 'javascript:alert(1)', 1704067200000, 1704067200000, 1, 2),
    (3, 'github', 'https://github.com/other', 1704067200000, 1704067200000, 2, 1);
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
    return (
      request.headers.origin === 'https://blog.example' &&
      request.headers.cookie?.includes(`csrftoken=${csrfToken}`) === true &&
      (request.headers['x-csrftoken'] === csrfToken || body?.csrfmiddlewaretoken === csrfToken)
    );
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
    ...(csrf
      ? {
          cookie: `csrftoken=${csrfToken}`,
          origin: 'https://blog.example',
          'x-csrftoken': csrfToken,
        }
      : {}),
  };
}

function form(fields: Array<[string, string]>) {
  return new URLSearchParams(fields).toString();
}

function multipart(fields: Array<{ name: string; value: string | Buffer; filename?: string; contentType?: string }>) {
  const boundary = 'blex-synthetic-profile-boundary';
  const pieces: Buffer[] = [];
  for (const field of fields) {
    pieces.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"${field.filename ? `; filename="${field.filename}"` : ''}\r\n${field.contentType ? `Content-Type: ${field.contentType}\r\n` : ''}\r\n`,
      ),
    );
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

test('protects personal settings APIs by login', async () => {
  for (const url of ['/v1/setting/account', '/v1/setting/profile']) {
    assert.equal((await app.inject(url)).json().errorCode, 'error:NL');
  }
  for (const [method, url] of [
    ['PUT', '/v1/setting/account'],
    ['PUT', '/v1/setting/regional-preferences'],
    ['PUT', '/v1/setting/profile'],
    ['PUT', '/v1/setting/social'],
    ['DELETE', '/v1/setting/cover'],
  ] as const) {
    const denied = await app.inject({ method, url, headers: headers() });
    assert.equal(denied.json().errorCode, 'error:NL', `${method} ${url}`);
  }
  const profileApi = await app.inject({ url: '/v1/setting/profile', headers: headers(1) });
  assert.equal(profileApi.json().body.avatar, 'https://blog.example/resources/media/writer.png');
  assert.equal(profileApi.json().body.cover, null);
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
    method: 'PUT',
    url: '/v1/setting/account',
    headers: { ...headers(1), 'content-type': 'application/x-www-form-urlencoded' },
    payload: form([['name', 'Updated Name']]),
  });
  assert.deepEqual(name.json(), { status: 'DONE', body: {} });
  const [updatedUser] = await db.$queryRaw<Array<{ name: string }>>`SELECT name FROM "User" WHERE id = 1`;
  assert.equal(updatedUser.name, 'Updated Name');

  const tooLongName = await app.inject({
    method: 'PUT',
    url: '/v1/setting/account',
    headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { name: 'x'.repeat(31) },
  });
  assert.equal(tooLongName.json().errorCode, 'error:VA');

  const regional = await app.inject({
    method: 'PUT',
    url: '/v1/setting/regional-preferences',
    headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { language: 'ko', timeZone: 'UTC' },
  });
  assert.deepEqual(regional.json(), { status: 'DONE', body: {} });
  const regionalRead = await app.inject({ url: '/v1/setting/account', headers: headers(1) });
  assert.equal(regionalRead.json().body.regionalPreferences.language, 'ko');
  assert.equal(regionalRead.json().body.regionalPreferences.timeZone, 'UTC');

  const invalidRegional = await app.inject({
    method: 'PUT',
    url: '/v1/setting/regional-preferences',
    headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { language: 'not-supported', timeZone: 'Nowhere/Nozone' },
  });
  assert.equal(invalidRegional.json().errorCode, 'error:VA');
  assert.equal(invalidRegional.json().messageKey, 'settings.regional_preferences.invalid_language');

  const denied = await app.inject({
    method: 'PUT',
    url: '/v1/setting/account',
    headers: headers(1, false),
    payload: { name: 'No CSRF' },
  });
  assert.equal(denied.statusCode, 403);

  const inheritedLanguage = await app.inject({
    method: 'PUT',
    url: '/v1/setting/regional-preferences',
    headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { language: null, timeZone: 'Asia/Seoul' },
  });
  assert.deepEqual(inheritedLanguage.json(), { status: 'DONE', body: {} });
  const pageRegionalRead = await app.inject({ url: '/v1/setting/account', headers: headers(1) });
  assert.equal(pageRegionalRead.json().body.name, 'Updated Name');
  assert.equal(pageRegionalRead.json().body.regionalPreferences.language, null);
  assert.equal(pageRegionalRead.json().body.regionalPreferences.timeZone, 'Asia/Seoul');
});

test('delegates password-bearing account changes to the injected reauthentication handler', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: '/v1/setting/account',
    headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { username: 'newname', name: 'New Name', password: 'NewPassword123!' },
  });
  assert.deepEqual(response.json(), { status: 'DONE', body: { delegated: true } });
  assert.deepEqual(delegatedPayload, { username: 'newname', name: 'New Name', password: 'NewPassword123!' });
  const [user] = await db.$queryRaw<
    Array<{ username: string; name: string }>
  >`SELECT username, name FROM "User" WHERE id = 1`;
  assert.deepEqual(user, { username: 'writer', name: 'Writer Name' });
});

test('updates profile safely through the API', async () => {
  const unsafe = await app.inject({
    method: 'PUT',
    url: '/v1/setting/profile',
    headers: { ...headers(1), 'content-type': 'application/x-www-form-urlencoded' },
    payload: form([
      ['bio', 'Should not persist'],
      ['homepage', 'javascript:alert(1)'],
    ]),
  });
  assert.equal(unsafe.json().errorCode, 'error:VA');
  const [unchanged] = await db.$queryRaw<
    Array<{ bio: string; homepage: string }>
  >`SELECT bio, homepage FROM "Profile" WHERE userId = 1`;
  assert.deepEqual(unchanged, { bio: 'Writer bio', homepage: 'https://writer.example' });

  const updated = await app.inject({
    method: 'PUT',
    url: '/v1/setting/profile',
    headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { bio: 'Updated bio', homepage: 'https://example.test/profile' },
  });
  assert.deepEqual(updated.json(), { status: 'DONE', body: {} });

  const read = await app.inject({ url: '/v1/setting/profile', headers: headers(1) });
  assert.equal(read.json().body.bio, 'Updated bio');
  assert.equal(read.json().body.homepage, 'https://example.test/profile');
});

test('applies legacy social-link create, update, order and delete without crossing users', async () => {
  const read = await app.inject({ url: '/v1/setting/profile', headers: headers(1) });
  assert.deepEqual(read.json().body.social, [{ id: 1, name: 'github', value: 'https://github.com/writer', order: 1 }]);

  const [linkBefore] = await db.$queryRaw<
    Array<{ updatedDate: string }>
  >`SELECT CAST(updatedAt AS TEXT) AS updatedDate FROM "SocialLink" WHERE id = 1`;
  const updated = await app.inject({
    method: 'PUT',
    url: '/v1/setting/social',
    headers: { ...headers(1), 'content-type': 'application/x-www-form-urlencoded' },
    payload: form([
      ['update', '1,github,https://github.com/updated,3'],
      ['create', 'threads,https://threads.example/writer,1'],
      ['delete', '2'],
    ]),
  });
  assert.equal(updated.json().status, 'DONE');
  assert.deepEqual(
    updated.json().body.map((link: { name: string }) => link.name),
    ['threads', 'github'],
  );
  const [ownLink] = await db.$queryRaw<
    Array<{ value: string; order: number }>
  >`SELECT url AS value, "order" AS "order" FROM "SocialLink" WHERE id = 1`;
  assert.deepEqual(ownLink, { value: 'https://github.com/updated', order: 3 });
  const [linkAfter] = await db.$queryRaw<
    Array<{ updatedDate: string }>
  >`SELECT CAST(updatedAt AS TEXT) AS updatedDate FROM "SocialLink" WHERE id = 1`;
  assert.equal(linkAfter.updatedDate, linkBefore.updatedDate);
  const [privateLink] = await db.$queryRaw<
    Array<{ value: string }>
  >`SELECT url AS value FROM "SocialLink" WHERE id = 3`;
  assert.equal(privateLink.value, 'https://github.com/other');

  const crossUserUpdate = await app.inject({
    method: 'PUT',
    url: '/v1/setting/social',
    headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { update: '3,github,https://attacker.example,1', create: '', delete: '' },
  });
  assert.equal(crossUserUpdate.json().errorCode, 'error:VA');
  const [stillPrivate] = await db.$queryRaw<
    Array<{ value: string }>
  >`SELECT url AS value FROM "SocialLink" WHERE id = 3`;
  assert.equal(stillPrivate.value, 'https://github.com/other');

  const badSeparator = await app.inject({
    method: 'PUT',
    url: '/v1/setting/social',
    headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { update: '', create: 'github,https://example.test/a&b,2', delete: '' },
  });
  assert.equal(badSeparator.json().errorCode, 'error:VA');

  const removed = await app.inject({
    method: 'PUT',
    url: '/v1/setting/social',
    headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { update: '', create: '', delete: '1' },
  });
  assert.equal(removed.json().status, 'DONE', removed.body);
  const afterDelete = await app.inject({ url: '/v1/setting/profile', headers: headers(1) });
  assert.deepEqual(afterDelete.json().body.social, [
    { id: 4, name: 'threads', value: 'https://threads.example/writer', order: 1 },
  ]);
});

test('stores bounded profile images atomically under the owner media directory', async () => {
  const image = await sharp({ create: { width: 80, height: 40, channels: 3, background: { r: 18, g: 90, b: 170 } } })
    .png()
    .toBuffer();
  for (const kind of ['avatar', 'cover'] as const) {
    const request = multipart([
      { name: 'csrfmiddlewaretoken', value: csrfToken },
      { name: kind, filename: 'client-controlled-name.png', contentType: 'image/png', value: image },
    ]);
    const response = await app.inject({
      method: 'POST',
      url: `/v1/setting/${kind}`,
      headers: { ...headers(1), 'content-type': request.contentType },
      payload: request.payload,
    });
    assert.deepEqual(response.json().status, 'DONE');
    assert.match(
      response.json().body.url,
      new RegExp(
        `^/resources/media/images/avatar/[a-f0-9]{2}/writer/${kind === 'avatar' ? 'a' : 'c'}[a-f0-9]{32}\\.png$`,
      ),
    );

    const [profile] = await db.$queryRaw<
      Array<{ avatar: string; cover: string }>
    >`SELECT avatar, cover FROM "Profile" WHERE userId = 1`;
    const savedPath = kind === 'avatar' ? profile.avatar : profile.cover;
    assert.match(
      savedPath,
      new RegExp(`^images/avatar/[a-f0-9]{2}/writer/${kind === 'avatar' ? 'a' : 'c'}[a-f0-9]{32}\\.png$`),
    );
    const bytes = await readFile(join(mediaRoot, ...savedPath.split('/')));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 80);
    assert.equal(metadata.height, 40);
  }

  const filesBeforeFailedSave = await readdir(
    join(mediaRoot, ...legacyImagePath('writer', 'avatar', 'probe.png').split('/').slice(0, -1)),
  );
  await db.$executeRaw`DELETE FROM "Profile" WHERE userId = 1`;
  const failedUpload = multipart([{ name: 'avatar', filename: 'avatar.png', contentType: 'image/png', value: image }]);
  const failed = await app.inject({
    method: 'POST',
    url: '/v1/setting/avatar',
    headers: { ...headers(1), 'content-type': failedUpload.contentType },
    payload: failedUpload.payload,
  });
  assert.equal(failed.statusCode, 500);
  const ownedDirectory = join(mediaRoot, ...legacyImagePath('writer', 'avatar', 'probe.png').split('/').slice(0, -1));
  assert.deepEqual(await readdir(ownedDirectory), filesBeforeFailedSave);
});

test('rejects invalid, oversized-dimension, and CSRF-free profile image uploads', async () => {
  const smallImage = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
  const oversizedDimensions = Buffer.from(smallImage);
  oversizedDimensions.writeUInt32BE(4001, 16);
  oversizedDimensions.writeUInt32BE(4001, 20);
  for (const bytes of [
    Buffer.from('not an image'),
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    oversizedDimensions,
  ]) {
    const request = multipart([{ name: 'avatar', filename: 'profile.png', contentType: 'image/png', value: bytes }]);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/setting/avatar',
      headers: { ...headers(1), 'content-type': request.contentType },
      payload: request.payload,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().errorCode, 'error:VA');
  }

  const tooLargeRequest = multipart([
    { name: 'avatar', filename: 'profile.png', contentType: 'image/png', value: Buffer.alloc(10 * 1024 * 1024 + 1) },
  ]);
  const tooLarge = await app.inject({
    method: 'POST',
    url: '/v1/setting/avatar',
    headers: { ...headers(1), 'content-type': tooLargeRequest.contentType },
    payload: tooLargeRequest.payload,
  });
  assert.equal(tooLarge.statusCode, 413);

  const noCsrfRequest = multipart([
    { name: 'avatar', filename: 'profile.png', contentType: 'image/png', value: smallImage },
  ]);
  const noCsrf = await app.inject({
    method: 'POST',
    url: '/v1/setting/avatar',
    headers: { ...headers(1, false), 'content-type': noCsrfRequest.contentType },
    payload: noCsrfRequest.payload,
  });
  assert.equal(noCsrf.statusCode, 403);
  const [profile] = await db.$queryRaw<Array<{ avatar: string }>>`SELECT avatar FROM "Profile" WHERE userId = 1`;
  assert.equal(profile.avatar, 'writer.png');
  assert.deepEqual(await readdir(mediaRoot), []);
});

test('removes only scoped cover files and leaves symlink targets untouched', async () => {
  const coverPath = legacyImagePath('writer', 'cover', 'Test.png');
  const coverFile = join(mediaRoot, ...coverPath.split('/'));
  await mkdir(join(coverFile, '..'), { recursive: true, mode: 0o700 });
  await writeFile(coverFile, 'synthetic cover', { mode: 0o600 });
  await db.$executeRaw`UPDATE "Profile" SET cover = ${coverPath} WHERE userId = 1`;
  const removed = await app.inject({ method: 'DELETE', url: '/v1/setting/cover', headers: headers(1) });
  assert.deepEqual(removed.json(), { status: 'DONE', body: { url: null } });
  await assert.rejects(readFile(coverFile), { code: 'ENOENT' });
  const [cleared] = await db.$queryRaw<Array<{ cover: string }>>`SELECT cover FROM "Profile" WHERE userId = 1`;
  assert.equal(cleared.cover, '');

  const outsideDirectory = join(directory, 'outside-profile-media');
  await mkdir(outsideDirectory, { recursive: true, mode: 0o700 });
  const outsideFile = join(outsideDirectory, 'cTest.png');
  await writeFile(outsideFile, 'must remain', { mode: 0o600 });
  const userDirectory = join(mediaRoot, ...coverPath.split('/').slice(0, -1));
  await rm(userDirectory, { recursive: true, force: true });
  await mkdir(join(userDirectory, '..'), { recursive: true, mode: 0o700 });
  await symlink(outsideDirectory, userDirectory, 'dir');
  await db.$executeRaw`UPDATE "Profile" SET cover = ${coverPath} WHERE userId = 1`;
  const escaped = await app.inject({ method: 'DELETE', url: '/v1/setting/cover', headers: headers(1) });
  assert.equal(escaped.json().status, 'DONE');
  assert.equal(await readFile(outsideFile, 'utf8'), 'must remain');
});

test('restricts about editing to its owner and sanitizes saved HTML', async () => {
  const anonymous = await app.inject({ method: 'POST', url: '/@writer/about/edit' });
  assert.equal(anonymous.statusCode, 302);

  const notOwner = await app.inject({
    method: 'POST',
    url: '/@other/about/edit',
    headers: { ...headers(1), 'content-type': 'application/x-www-form-urlencoded' },
    payload: form([
      ['csrfmiddlewaretoken', csrfToken],
      ['aboutMarkdown', 'Not mine'],
    ]),
  });
  assert.equal(notOwner.statusCode, 403);

  const saved = await app.inject({
    method: 'POST',
    url: '/@writer/about/edit',
    headers: { ...headers(1), 'content-type': 'application/x-www-form-urlencoded' },
    payload: form([
      ['csrfmiddlewaretoken', csrfToken],
      ['aboutMarkdown', '# Hello\n\n<script>alert(2)</script>\n\n[Safe link](https://example.com)'],
    ]),
  });
  assert.equal(saved.json().status, 'success');
  const [savedProfile] = await db.$queryRaw<
    Array<{ aboutMarkdown: string; aboutHtml: string }>
  >`SELECT aboutMarkdown, aboutHtml FROM "Profile" WHERE userId = 1`;
  assert.match(savedProfile.aboutHtml, /<h\d[^>]*>Hello/);
  assert.doesNotMatch(savedProfile.aboutHtml, /<script>/);

  const apiSave = await app.inject({
    method: 'PUT',
    url: '/v1/users/@writer',
    headers: { ...headers(1), 'content-type': 'application/json' },
    payload: { about: true, aboutMarkdown: 'API **save**' },
  });
  assert.deepEqual(apiSave.json(), { status: 'DONE', body: {} });
  const unauthorizedSave = await app.inject({
    method: 'PUT',
    url: '/v1/users/@writer',
    headers: { ...headers(2), 'content-type': 'application/json' },
    payload: { about: true, aboutMarkdown: 'Not mine' },
  });
  assert.equal(unauthorizedSave.json().errorCode, 'error:AT');
  const missingCsrf = await app.inject({
    method: 'PUT',
    url: '/v1/users/@writer',
    headers: { ...headers(1, false), 'content-type': 'application/json' },
    payload: { about: true, aboutMarkdown: 'No CSRF' },
  });
  assert.equal(missingCsrf.statusCode, 403);
  const anonymousSave = await app.inject({
    method: 'PUT',
    url: '/v1/users/@writer',
    headers: { 'content-type': 'application/json' },
    payload: { about: true, aboutMarkdown: 'No login' },
  });
  assert.equal(anonymousSave.json().errorCode, 'error:NL');
  const [kept] = await db.$queryRaw<
    Array<{ aboutMarkdown: string }>
  >`SELECT aboutMarkdown FROM "Profile" WHERE userId = 1`;
  assert.equal(kept.aboutMarkdown, 'API **save**');
});
