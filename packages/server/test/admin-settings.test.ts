import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import sharp from 'sharp';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { after, beforeEach, test } from 'node:test';
import { decryptSecret, encryptSecret } from '../src/features/auth/encrypted-secret.js';
import { registerAdminSettings } from '../src/features/site-admin/index.js';
import { accountTables, createMigratedTables, migratedTableSql } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-admin-settings-'));
const databasePath = join(directory, 'admin-settings.sqlite3');
const mediaRoot = join(directory, 'media');
const csrfToken = 'b'.repeat(43);
const siteUrl = new URL('https://blog.example');
const cipherKey = '0123456789abcdef0123456789abcdef';
const secretKey = 'synthetic-session-secret';
const telegramCalls: Array<{ url: string; init?: RequestInit }> = [];
let telegramResponses = new Map<string, unknown>();
let telegramUnreachable = false;

async function fetchTelegram(url: string, init?: RequestInit): Promise<{ json(): Promise<unknown> }> {
  telegramCalls.push({ url, init });
  if (telegramUnreachable) throw new Error('synthetic network failure');
  const method = new URL(url).pathname.split('/').at(-1) ?? '';
  return { json: async () => telegramResponses.get(method) ?? { ok: true, result: true } };
}

function configureTelegram(responses: Record<string, unknown> = {}) {
  telegramCalls.length = 0;
  telegramUnreachable = false;
  telegramResponses = new Map(Object.entries(responses));
}

function createSchema() {
  const database = new DatabaseSync(databasePath);
  createMigratedTables(database, 'FormTemplate', 'StaticPage', 'SiteNotice', 'SiteBanner', 'SiteSetting', 'LoginSetting', 'IntegrationSetting', 'AdminLog', 'CleanupConfirmation', 'UploadedImage', 'DeveloperToken', 'DeveloperRequestLog');
  database.exec(`
  ${migratedTableSql(...accountTables)}
    CREATE TABLE WorkLogEntry (id INTEGER PRIMARY KEY, text TEXT NOT NULL DEFAULT '');
${migratedTableSql('Post', 'PostContent', 'Tag', '_PostToTag', 'PostRevision', 'PostLike', 'PinnedPost', 'PostShareLink', 'PostShareDailyCount', 'ScheduledPublication')}




    ${migratedTableSql('Comment', 'CommentLike')}
    ${migratedTableSql('Series')}


  `);
  database.close();
}

function seedDatabase() {
  const database = new DatabaseSync(databasePath);
  database.exec(`
    DELETE FROM AdminLog;
    DELETE FROM "AuthorInvite";
    DELETE FROM StaticPage;
    DELETE FROM SiteNotice;
    DELETE FROM SiteBanner;
    DELETE FROM WorkLogEntry;
    DELETE FROM "Profile";
    DELETE FROM "UserPreference";
    DELETE FROM "Post";
    DELETE FROM "PostContent";
    DELETE FROM "PostRevision";
    
    
    DELETE FROM "Comment";
    DELETE FROM "Series";
    DELETE FROM FormTemplate;
    DELETE FROM UploadedImage;
    DELETE FROM "Tag";
    DELETE FROM "_PostToTag";
    DELETE FROM DeveloperRequestLog;
    DELETE FROM "Session";
    DELETE FROM CleanupConfirmation;
    DELETE FROM "SocialProvider";
    DELETE FROM IntegrationSetting;
    DELETE FROM LoginSetting;
    DELETE FROM SiteSetting;
    DELETE FROM "User";
    INSERT INTO "User" ("id", "username", "name", "email", "isActive", "isStaff", "isSuperuser", "joinedAt", "lastLoginAt", "passwordHash") VALUES
    (1, 'site-editor', 'Site Editor', 'editor@example.test', 1, 1, 0, 1735689600000, 1735776000000, ''),
    (2, 'admin', 'Admin', 'admin@example.test', 1, 1, 1, 1735689600000, 1735862400000, ''),
    (3, 'reader', 'Reader', 'reader@example.test', 1, 0, 0, 1735776000000, NULL, ''),
    (4, 'inactive-admin', 'Inactive', 'inactive@example.test', 0, 1, 1, 1735862400000, NULL, ''),
    (5, 'profileless', 'No Profile', 'profileless@example.test', 1, 0, 0, 1735948800000, NULL, '');
    INSERT INTO "Profile" ("userId", "role") VALUES
    (1, 'EDITOR'),
    (2, 'EDITOR'),
    (3, 'READER'),
    (4, 'EDITOR');
    INSERT INTO "Post" ("id", "authorId", "deletedAt", "publishedAt", "slug", "title", "createdAt", "updatedAt") VALUES
    (1, 1, NULL, NULL, 'post-1', '', 946684800000, 946684800000),
    (2, 1, NULL, NULL, 'post-2', '', 946684800000, 946684800000),
    (3, 1, 1735948800000, NULL, 'post-3', '', 946684800000, 946684800000),
    (4, 3, NULL, 4070908800000, 'post-4', '', 946684800000, 946684800000);
    UPDATE "User" SET canManageSiteSettings = 1 WHERE id = 1;
    INSERT INTO SiteSetting (id, headerScript, siteName, iconManifest, updatedAt)
      VALUES (1, '<script>hidden from delegated staff</script>', 'Test Blog', '{}', 1735689600000);
    INSERT INTO LoginSetting (id, welcomeNotificationMessage, welcomeNotificationUrl, hcaptchaEnabled, hcaptchaSiteKey, hcaptchaSecretKey, updatedAt)
      VALUES (1, 'Welcome {name}', '/welcome', 1, 'captcha-site-key', '${encryptSecret('hs_test_secret_99', cipherKey)}', 1735689600000);
    INSERT INTO "SocialProvider" ("id", "key", "clientId", "clientSecret", "isEnabled") VALUES
    (1, 'google', 'google-id', '${encryptSecret('oauth_test_secret_17', cipherKey)}', 1),
    (2, 'github', '', '', 0);
    INSERT INTO IntegrationSetting (id, updatedAt) VALUES (1, 1735689600000);
  `);
  database.close();
}

createSchema();
seedDatabase();
const prisma = new PrismaClient({ datasourceUrl: `file:${databasePath}?connection_limit=1` });
const app = Fastify();
registerAdminSettings(app, prisma, {
  siteUrl,
  mediaRoot,
  cipherKey,
  secretKey,
  fetchProvider: fetchTelegram,
  currentUser: async (request) => {
    const id = Number(request.headers['x-test-user']);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const database = new DatabaseSync(databasePath, { readOnly: true });
    const user = database.prepare('SELECT id, username FROM "User" WHERE id = ?').get(id) as { id: number; username: string } | undefined;
    database.close();
    return user ?? null;
  },
  validateCsrf: (request) => {
    const body = request.body as Record<string, unknown> | undefined;
    const posted = request.headers['x-csrftoken'] ?? body?.csrfmiddlewaretoken;
    return request.headers.origin === siteUrl.origin &&
      request.headers.cookie?.includes(`csrftoken=${csrfToken}`) === true && posted === csrfToken;
  },
});
await app.ready();

beforeEach(async () => {
  seedDatabase();
  await rm(mediaRoot, { recursive: true, force: true });
  await mkdir(mediaRoot, { recursive: true });
  configureTelegram();
});

after(async () => {
  await app.close();
  await prisma.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

function headers(userId?: number, csrf = true) {
  return {
    ...(userId === undefined ? {} : { 'x-test-user': String(userId) }),
    ...(csrf ? {
      cookie: `csrftoken=${csrfToken}${userId === undefined ? '' : `; blexsessionid=${'a'.repeat(42)}${userId}`}`,
      origin: siteUrl.origin,
      'x-csrftoken': csrfToken,
    } : {}),
    ...(userId !== undefined && !csrf ? { cookie: `blexsessionid=${'a'.repeat(42)}${userId}` } : {}),
  };
}

function jsonHeaders(userId?: number, csrf = true) {
  return { ...headers(userId, csrf), 'content-type': 'application/json' };
}

function formHeaders(userId?: number) {
  return { ...headers(userId), 'content-type': 'application/x-www-form-urlencoded' };
}

function multipartPayload(fields: Record<string, string>, files: Record<string, { name: string; type: string; data: Buffer }>) {
  const boundary = '----blex-admin-settings-test-boundary';
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  for (const [field, file] of Object.entries(files)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`));
    parts.push(file.data, Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(parts),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

async function pngFile(size: number): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 24, g: 24, b: 24, alpha: 1 } },
  }).png().toBuffer();
}

async function icoFile(): Promise<Buffer> {
  const png = await pngFile(16);
  const result = Buffer.alloc(22 + png.length);
  result.writeUInt16LE(0, 0);
  result.writeUInt16LE(1, 2);
  result.writeUInt16LE(1, 4);
  result[6] = 16;
  result[7] = 16;
  result.writeUInt16LE(1, 10);
  result.writeUInt16LE(32, 12);
  result.writeUInt32LE(png.length, 14);
  result.writeUInt32LE(22, 18);
  png.copy(result, 22);
  return result;
}

function body(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

test('gates site settings by staff and SiteSetting permission and hides global scripts', async () => {
  const noSession = await app.inject('/v1/site-settings');
  assert.equal(body(noSession).errorCode, 'error:NL');
  const reader = await app.inject({ url: '/v1/site-settings', headers: headers(3) });
  assert.equal(body(reader).errorCode, 'error:RJ');

  const delegated = await app.inject({ url: '/v1/site-settings', headers: headers(1) });
  assert.equal(delegated.statusCode, 200);
  const response = body(delegated);
  assert.equal(response.status, 'DONE');
  const settings = response.body as Record<string, unknown>;
  assert.equal(settings.siteName, 'Test Blog');
  assert.equal(settings.siteDescription, 'Test Blog recent public posts');
  assert.equal(settings.headerScript, '');
  assert.equal(settings.canManageScripts, false);
  assert.match(String(settings.robotsTxtDefault), /Disallow: \/admin-settings\//);
  assert.match(String(settings.robotsTxtDefault), /Sitemap: https:\/\/blog\.example\/sitemap\.xml/);

  const admin = await app.inject({ url: '/v1/site-settings', headers: headers(2) });
  assert.equal((body(admin).body as Record<string, unknown>).headerScript, '<script>hidden from delegated staff</script>');

});

test('uploads and deletes validated brand SVG assets under the legacy public media paths', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#123456"/></svg>');
  const form = multipartPayload({ assetType: 'logo', theme: 'default' }, {
    svg: { name: 'logo.svg', type: 'image/svg+xml', data: svg },
  });
  const upload = await app.inject({
    method: 'POST', url: '/v1/site-settings/brand-assets', headers: { ...headers(1), ...form.headers }, payload: form.payload,
  });
  assert.equal(upload.statusCode, 200, upload.body);
  const uploaded = body(upload);
  assert.equal(uploaded.status, 'DONE', upload.body);
  const settings = uploaded.body as Record<string, unknown>;
  const logoUrl = String(settings.logoSvgUrl);
  assert.match(logoUrl, /^\/resources\/media\/brand\/logo\/default\/[a-f0-9]{16}\/logo\.svg$/);
  const setting = await prisma.$queryRaw<Array<{ logoSvg: string }>>`SELECT logoSvg FROM SiteSetting WHERE id = 1`;
  assert.equal(logoUrl, `/resources/media/${setting[0]?.logoSvg}`);
  assert.deepEqual(await readFile(join(mediaRoot, setting[0]?.logoSvg ?? '')), svg);

  const deleted = await app.inject({
    method: 'DELETE', url: '/v1/site-settings/brand-assets', headers: jsonHeaders(1),
    payload: JSON.stringify({ assetType: 'logo', theme: 'default' }),
  });
  assert.equal(body(deleted).status, 'DONE', deleted.body);
  assert.equal((body(deleted).body as Record<string, unknown>).logoSvgUrl, '/resources/logob.svg');
  assert.equal((await prisma.$queryRaw<Array<{ logoSvg: string }>>`SELECT logoSvg FROM SiteSetting WHERE id = 1`)[0]?.logoSvg, '');
  await assert.rejects(readFile(join(mediaRoot, setting[0]?.logoSvg ?? '')));
});

test('rejects an icon upload that omits its PNG and ICO derivatives', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32"><rect width="64" height="32" fill="#123456"/></svg>');
  const form = multipartPayload({ assetType: 'icon', theme: 'default', csrfmiddlewaretoken: csrfToken }, {
    svg: { name: 'icon.svg', type: 'image/svg+xml', data: svg },
  });
  const missingDerivatives = await app.inject({
    method: 'POST', url: '/v1/site-settings/brand-assets', headers: { ...headers(1), ...form.headers }, payload: form.payload,
  });
  assert.equal(body(missingDerivatives).errorCode, 'error:VA');
});

test('requires a default asset for dark variants and validates every default icon derivative', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#123456"/></svg>');
  const dark = multipartPayload({ assetType: 'icon', theme: 'dark' }, {
    svg: { name: 'icon.svg', type: 'image/svg+xml', data: svg },
  });
  const rejected = await app.inject({
    method: 'POST', url: '/v1/site-settings/brand-assets', headers: { ...headers(1), ...dark.headers }, payload: dark.payload,
  });
  assert.equal(body(rejected).errorCode, 'error:VA');
  assert.match(String(body(rejected).errorMessage), /default asset first/);

  const fields = {
    assetType: 'icon',
    theme: 'default',
    manifest: JSON.stringify({ version: 1, pngSizes: [16, 32, 57, 72, 76, 96, 114, 120, 128, 144, 152, 192, 256, 512], ico: true }),
  };
  const files: Record<string, { name: string; type: string; data: Buffer }> = {
    svg: { name: 'icon.svg', type: 'image/svg+xml', data: svg },
    faviconIco: { name: 'favicon.ico', type: 'image/x-icon', data: await icoFile() },
  };
  for (const size of [16, 32, 57, 72, 76, 96, 114, 120, 128, 144, 152, 192, 256, 512]) {
    files[`png${size}`] = { name: `logo${size}.png`, type: 'image/png', data: await pngFile(size) };
  }
  const iconForm = multipartPayload(fields, files);
  const iconUpload = await app.inject({
    method: 'POST', url: '/v1/site-settings/brand-assets', headers: { ...headers(1), ...iconForm.headers }, payload: iconForm.payload,
  });
  assert.equal(body(iconUpload).status, 'DONE', iconUpload.body);
  const iconSettings = body(iconUpload).body as Record<string, unknown>;
  assert.match(String(iconSettings.iconSvgUrl), /^\/resources\/media\/brand\/icon\/default\//);
  assert.match(String(iconSettings.faviconUrl), /^\/resources\/media\/brand\/icon\/default\//);
  const pngUrls = iconSettings.iconPngUrls as Record<string, string>;
  assert.equal(Object.keys(pngUrls).length, 14);
  assert.match(pngUrls['512'] ?? '', /logo512\.png$/);
  const stored = await prisma.siteSetting.findUniqueOrThrow({ where: { id: 1 }, select: { iconManifest: true } });
  const manifest = stored.iconManifest as { png: Record<string, string>; ico: string };
  assert.equal(Object.keys(manifest.png).length, 14);
  assert.ok((await readFile(join(mediaRoot, manifest.png['128'] ?? ''))).length > 0);
  assert.ok((await readFile(join(mediaRoot, manifest.ico))).length > 22);

  const invalidSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" onload="alert(1)"><rect/></svg>');
  const badForm = multipartPayload({ assetType: 'logo', theme: 'default' }, {
    svg: { name: 'unsafe.svg', type: 'image/svg+xml', data: invalidSvg },
  });
  const badUpload = await app.inject({
    method: 'POST', url: '/v1/site-settings/brand-assets', headers: { ...headers(1), ...badForm.headers }, payload: badForm.payload,
  });
  assert.equal(body(badUpload).errorCode, 'error:VA');
  assert.equal((await prisma.$queryRaw<Array<{ logoSvg: string }>>`SELECT logoSvg FROM SiteSetting WHERE id = 1`)[0]?.logoSvg, '');
});

test('updates site identity and SEO fields, validates names, and requires CSRF', async () => {
  const update = await app.inject({
    method: 'PUT', url: '/v1/site-settings', headers: jsonHeaders(1),
    payload: JSON.stringify({ siteName: '  BLEX Journal  ', seoEnabled: false, aeoEnabled: true, robotsTxtExtraRules: 'User-agent: DemoBot\nDisallow: /drafts/' }),
  });
  assert.equal(body(update).status, 'DONE');
  const settings = body(update).body as Record<string, unknown>;
  assert.equal(settings.siteName, 'BLEX Journal');
  assert.equal(settings.seoEnabled, false);
  assert.equal(settings.aeoEnabled, true);
  assert.equal(settings.robotsTxtExtraRules, 'User-agent: DemoBot\nDisallow: /drafts/');
  assert.match(String(settings.robotsTxtDefault), /AI agent entry point: https:\/\/blog\.example\/llms\.txt/);
  assert.doesNotMatch(String(settings.robotsTxtDefault), /User-agent: DemoBot/);

  const deniedScript = await app.inject({
    method: 'PUT', url: '/v1/site-settings', headers: jsonHeaders(1),
    payload: JSON.stringify({ siteName: 'Must not save', headerScript: '<script>no</script>' }),
  });
  assert.equal(body(deniedScript).errorCode, 'error:RJ');
  const invalid = await app.inject({
    method: 'PUT', url: '/v1/site-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ siteName: 'x'.repeat(81) }),
  });
  assert.equal(body(invalid).errorCode, 'error:VA');

  const noCsrf = await app.inject({
    method: 'PUT', url: '/v1/site-settings', headers: jsonHeaders(2, false),
    payload: JSON.stringify({ siteName: 'Blocked' }),
  });
  assert.equal(noCsrf.statusCode, 403);
  assert.equal(Number((await prisma.$queryRaw<Array<{ total: number | bigint }>>`SELECT COUNT(*) AS total FROM AdminLog`)[0]?.total), 1);
});

test('keeps admin API responses private and out of search indexes', async () => {
  const response = await app.inject({ url: '/v1/site-settings', headers: headers(1) });
  assert.equal(response.statusCode, 200, response.body);
  assert.match(response.headers['cache-control'] ?? '', /no-store/);
  assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow, noarchive');
  assert.doesNotMatch(response.body, /hidden from delegated staff/);
  assert.equal(body(await app.inject({ url: '/v1/login-settings', headers: headers(1) })).errorCode, 'error:RJ');
  const login = await app.inject({ url: '/v1/login-settings', headers: headers(2) });
  assert.equal(body(login).status, 'DONE', login.body);
  assert.doesNotMatch(login.body, /hs_test_secret_99|oauth_test_secret_17/);
});

test('restricts login settings to active superusers and never returns stored secrets', async () => {
  const staff = await app.inject({ url: '/v1/login-settings', headers: headers(1) });
  assert.equal(body(staff).errorCode, 'error:RJ');
  const inactive = await app.inject({ url: '/v1/login-settings', headers: headers(4) });
  assert.equal(body(inactive).errorCode, 'error:NL');

  const get = await app.inject({ url: '/v1/login-settings', headers: headers(2) });
  assert.equal(body(get).status, 'DONE');
  assert.doesNotMatch(get.body, /hs_test_secret_99|oauth_test_secret_17|hcaptchaSecretKey|clientSecret/);
  const settings = body(get).body as Record<string, unknown>;
  assert.equal(settings.hcaptchaHasSecretKey, true);
  const providers = settings.socialAuthProviders as Array<Record<string, unknown>>;
  assert.deepEqual(providers.map((provider) => provider.key), ['google', 'github']);
  assert.equal(providers[0]?.hasClientSecret, true);
});

test('updates hCaptcha and social provider credentials atomically without echoing secrets', async () => {
  const update = await app.inject({
    method: 'PUT', url: '/v1/login-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({
      welcomeNotificationMessage: 'Hello {name}',
      welcomeNotificationUrl: '/hello',
      accountDeletionRedirectUrl: 'https://forms.example/exit',
      hcaptchaEnabled: true,
      hcaptchaSiteKey: 'new-site-key',
      hcaptchaSecretKey: 'new-captcha-secret',
      socialAuthProviders: [
        { key: 'google', isEnabled: true, clientId: 'google-new-id', clientSecret: 'google-new-secret' },
        { key: 'github', isEnabled: true, clientId: 'github-id' },
      ],
    }),
  });
  assert.equal(body(update).status, 'DONE', update.body);
  assert.doesNotMatch(update.body, /new-captcha-secret|google-new-secret/);
  const settings = body(update).body as Record<string, unknown>;
  assert.equal(settings.welcomeNotificationMessage, 'Hello {name}');
  assert.equal(settings.hcaptchaSiteKey, 'new-site-key');
  assert.equal(settings.hcaptchaHasSecretKey, true);
  const row = await prisma.$queryRaw<Array<{ hcaptchaSecretKey: string }>>`SELECT hcaptchaSecretKey FROM LoginSetting WHERE id = 1`;
  assert.notEqual(row[0]?.hcaptchaSecretKey, 'new-captcha-secret');
  assert.equal(decryptSecret(row[0]?.hcaptchaSecretKey ?? '', cipherKey), 'new-captcha-secret');
  const social = await prisma.$queryRaw<Array<{ key: string; clientSecret: string; isEnabled: number }>>`SELECT key, clientSecret, isEnabled FROM "SocialProvider" ORDER BY id`;
  assert.equal(decryptSecret(social.find((item) => item.key === 'google')?.clientSecret ?? '', cipherKey), 'google-new-secret');
  assert.equal(Boolean(social.find((item) => item.key === 'github')?.isEnabled), true);
  assert.equal(decryptSecret(social.find((item) => item.key === 'google')?.clientSecret ?? '', cipherKey), 'google-new-secret');
  const audit = await prisma.$queryRaw<Array<{ changeMessage: string }>>`SELECT message AS changeMessage FROM AdminLog ORDER BY id DESC LIMIT 1`;
  assert.equal(audit[0]?.changeMessage, 'Updated login and security settings');
  assert.doesNotMatch(audit[0]?.changeMessage ?? '', /secret/);
});

test('rejects unsafe login URLs and prevents invalid hCaptcha settings from partial writes', async () => {
  const unsafeUrl = await app.inject({
    method: 'PUT', url: '/v1/login-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ welcomeNotificationMessage: 'Must not persist', welcomeNotificationUrl: 'javascript:alert(1)' }),
  });
  assert.equal(body(unsafeUrl).errorCode, 'error:VA');
  const invalidCaptcha = await app.inject({
    method: 'PUT', url: '/v1/login-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ welcomeNotificationMessage: 'Must not persist', hcaptchaEnabled: true, hcaptchaSiteKey: '' }),
  });
  assert.equal(body(invalidCaptcha).errorCode, 'error:VA');
  const message = await prisma.$queryRaw<Array<{ welcomeMessage: string }>>`SELECT welcomeNotificationMessage AS welcomeMessage FROM LoginSetting WHERE id = 1`;
  assert.equal(message[0]?.welcomeMessage, 'Welcome {name}');
  assert.equal(Number((await prisma.$queryRaw<Array<{ total: number | bigint }>>`SELECT COUNT(*) AS total FROM AdminLog`)[0]?.total), 0);
});

test('provides staff-only author invitation APIs with single-use deletion rules', async () => {
  const denied = await app.inject({ url: '/v1/admin/author-invites', headers: headers(3) });
  assert.equal(body(denied).errorCode, 'error:RJ');

  const created = await app.inject({
    method: 'POST', url: '/v1/admin/author-invites', headers: jsonHeaders(1),
    payload: JSON.stringify({ note: `  ${'a'.repeat(130)}  ` }),
  });
  assert.equal(body(created).status, 'DONE', created.body);
  const invite = (body(created).body as { invite: Record<string, unknown> }).invite;
  assert.equal(String(invite.note).length, 120);
  assert.match(String(invite.code), /^[A-Za-z0-9_-]{16}$/);
  assert.equal(invite.signupUrl, `/sign?invite=${invite.code}`);
  assert.equal(invite.createdBy, 'site-editor');

  const list = await app.inject({ url: '/v1/admin/author-invites', headers: headers(1) });
  const invites = (body(list).body as { invites: Array<Record<string, unknown>> }).invites;
  assert.equal(invites.length, 1);
  assert.equal(invites[0]?.code, invite.code);

  const deleted = await app.inject({ method: 'DELETE', url: `/v1/admin/author-invites/${invite.id}`, headers: headers(1) });
  assert.equal(body(deleted).status, 'DONE');
  const missing = await app.inject({ method: 'DELETE', url: `/v1/admin/author-invites/${invite.id}`, headers: headers(1) });
  assert.equal(body(missing).errorCode, 'error:NF');
  const noCsrf = await app.inject({ method: 'POST', url: '/v1/admin/author-invites', headers: jsonHeaders(1, false), payload: '{}' });
  assert.equal(noCsrf.statusCode, 403);
});

test('refuses to delete a staff invitation after it is claimed', async () => {
  const create = await app.inject({
    method: 'POST', url: '/v1/admin/author-invites', headers: jsonHeaders(1), payload: JSON.stringify({ note: 'Release reviewers' }),
  });
  assert.equal(body(create).status, 'DONE', create.body);
  const created = (body(create).body as { invite: { id: number } }).invite;
  const database = new DatabaseSync(databasePath);
  database.prepare('UPDATE "AuthorInvite" SET isActive = 0, claimedById = 3, claimedAt = ? WHERE id = ?').run(Date.UTC(2025, 2, 1), created.id);
  database.close();
  const deletion = await app.inject({ method: 'DELETE', url: `/v1/admin/author-invites/${created.id}`, headers: headers(1) });
  assert.equal(body(deletion).errorCode, 'error:RJ');
  assert.equal(Number((await prisma.$queryRaw<Array<{ total: number | bigint }>>`SELECT COUNT(*) AS total FROM "AuthorInvite" WHERE id = ${created.id}`)[0]?.total), 1);
});

test('provides staff-only static page CRUD and sanitizes persisted page HTML', async () => {
  const denied = await app.inject({ url: '/v1/static-pages', headers: headers(3) });
  assert.equal(body(denied).errorCode, 'error:RJ');
  const noCsrf = await app.inject({
    method: 'POST', url: '/v1/static-pages', headers: jsonHeaders(1, false),
    payload: JSON.stringify({ title: 'Blocked', slug: 'blocked' }),
  });
  assert.equal(noCsrf.statusCode, 403);

  const created = await app.inject({
    method: 'POST', url: '/v1/static-pages', headers: jsonHeaders(1),
    payload: JSON.stringify({
      title: 'Privacy', slug: 'privacy', content: '<p onclick="evil()">Safe</p><script>alert(1)</script><a href="javascript:evil()">bad link</a>',
      metaDescription: 'Privacy details', isPublished: true, showInFooter: true, order: 3,
    }),
  });
  assert.equal(body(created).status, 'DONE', created.body);
  const page = body(created).body as Record<string, unknown>;
  assert.equal(page.slug, 'privacy');
  assert.equal(page.isPublished, true);
  assert.equal(page.showInFooter, true);
  assert.match(String(page.content), /onclick/, 'staff edit the stored page source as in 3.x');
  const pageId = Number(page.id);

  const duplicate = await app.inject({
    method: 'POST', url: '/v1/static-pages', headers: jsonHeaders(1),
    payload: JSON.stringify({ title: 'Duplicate', slug: 'privacy' }),
  });
  assert.equal(body(duplicate).errorCode, 'error:AE');
  const detail = await app.inject({ url: `/v1/static-pages/${pageId}`, headers: headers(1) });
  assert.equal((body(detail).body as Record<string, unknown>).metaDescription, 'Privacy details');
  const update = await app.inject({
    method: 'PUT', url: `/v1/static-pages/${pageId}`, headers: jsonHeaders(1),
    payload: JSON.stringify({ isPublished: false, content: '<h2>Updated</h2>' }),
  });
  assert.equal(body(update).status, 'DONE');
  assert.equal((body(update).body as Record<string, unknown>).isPublished, false);
  const list = await app.inject({ url: '/v1/static-pages', headers: headers(1) });
  assert.equal(((body(list).body as { pages: Array<Record<string, unknown>> }).pages[0]?.slug), 'privacy');
  const deleted = await app.inject({ method: 'DELETE', url: `/v1/static-pages/${pageId}`, headers: headers(1) });
  assert.equal((body(deleted).body as Record<string, unknown>).message, 'Static page deleted.');

  assert.equal(body(await app.inject({ url: '/v1/static-pages', headers: headers(3) })).errorCode, 'error:RJ');
});

test('manages global notices and sanitized banners through APIs and staff forms', async () => {
  const noticeCreate = await app.inject({
    method: 'POST', url: '/v1/global-notices', headers: jsonHeaders(1),
    payload: JSON.stringify({ title: 'Maintenance', url: 'javascript:alert(1)', isActive: true }),
  });
  assert.equal(body(noticeCreate).status, 'DONE', noticeCreate.body);
  const notice = body(noticeCreate).body as Record<string, unknown>;
  const noticeId = Number(notice.id);
  assert.equal(notice.url, '');
  assert.equal(typeof notice.createdDate, 'string');
  const noticeGet = await app.inject({ url: `/v1/global-notices/${noticeId}`, headers: headers(1) });
  assert.equal((body(noticeGet).body as Record<string, unknown>).title, 'Maintenance');
  const noticeUpdate = await app.inject({
    method: 'PUT', url: `/v1/global-notices/${noticeId}`, headers: jsonHeaders(1),
    payload: JSON.stringify({ url: '/status', isActive: false }),
  });
  assert.equal((body(noticeUpdate).body as Record<string, unknown>).url, '/status');
  assert.equal((body(noticeUpdate).body as Record<string, unknown>).isActive, false);
  assert.equal(((body(await app.inject({ url: '/v1/global-notices', headers: headers(1) })).body as { notices: unknown[] }).notices.length), 1);
  const invalidPosition = await app.inject({
    method: 'POST', url: '/v1/global-banners', headers: jsonHeaders(1),
    payload: JSON.stringify({ title: 'Invalid', contentHtml: '<p>Banner</p>', bannerType: 'horizontal', position: 'left' }),
  });
  assert.equal(body(invalidPosition).errorCode, 'error:VA');
  const bannerCreate = await app.inject({
    method: 'POST', url: '/v1/global-banners', headers: jsonHeaders(1),
    payload: JSON.stringify({
      title: 'Welcome', contentHtml: '<p onclick="evil()">Hello</p><script>alert(1)</script>',
      bannerType: 'horizontal', position: 'top', order: 5,
    }),
  });
  assert.equal(body(bannerCreate).status, 'DONE', bannerCreate.body);
  const banner = body(bannerCreate).body as Record<string, unknown>;
  const bannerId = Number(banner.id);
  assert.equal(banner.createdBy, 'site-editor');
  assert.match(String(banner.contentHtml), /onclick/, 'global banners keep their source as in 3.x');
  const order = await app.inject({
    method: 'PUT', url: '/v1/global-banners/order', headers: jsonHeaders(1),
    payload: JSON.stringify({ order: [[bannerId, 0], ['999999', 2], ['broken']] }),
  });
  assert.equal(body(order).status, 'DONE', order.body);
  const ordered = await app.inject({ url: '/v1/global-banners', headers: headers(1) });
  const banners = (body(ordered).body as { banners: Array<Record<string, unknown>> }).banners;
  assert.equal(banners[0]?.id, bannerId);
  assert.equal(banners[0]?.order, 0);
  const updateBanner = await app.inject({
    method: 'PUT', url: `/v1/global-banners/${bannerId}`, headers: jsonHeaders(1),
    payload: JSON.stringify({ position: 'bottom', contentHtml: '<p>Safe update</p>' }),
  });
  assert.equal((body(updateBanner).body as Record<string, unknown>).position, 'bottom');
  const deletedBanner = await app.inject({ method: 'DELETE', url: `/v1/global-banners/${bannerId}`, headers: headers(1) });
  assert.equal((body(deletedBanner).body as Record<string, unknown>).message, 'Global banner deleted.');
  const reader = await app.inject({ url: '/v1/global-banners', headers: headers(3) });
  assert.equal(body(reader).errorCode, 'error:RJ');
});

test('author notices and banners are editor-only, sanitized, and scoped to their owner', async () => {
  const noticeCreate = await app.inject({
    method: 'POST', url: '/v1/notices', headers: jsonHeaders(1),
    payload: JSON.stringify({ title: 'Author notice', url: '/author-status', isActive: true }),
  });
  assert.equal(body(noticeCreate).status, 'DONE', noticeCreate.body);
  const notice = body(noticeCreate).body as Record<string, unknown>;
  const noticeId = Number(notice.id);
  const editorTwoNotice = await app.inject({
    method: 'POST', url: '/v1/notices', headers: jsonHeaders(2),
    payload: JSON.stringify({ title: 'Other author notice', url: '/other-status' }),
  });
  assert.equal(body(editorTwoNotice).status, 'DONE', editorTwoNotice.body);
  const noticeList = await app.inject({ url: '/v1/notices', headers: headers(1) });
  assert.deepEqual(
    ((body(noticeList).body as { notices: Array<Record<string, unknown>> }).notices).map(({ title }) => title),
    ['Author notice'],
  );
  const privateNotice = await app.inject({ url: `/v1/notices/${noticeId}`, headers: headers(2) });
  assert.equal(privateNotice.statusCode, 404);
  const privateNoticeUpdate = await app.inject({
    method: 'PUT', url: `/v1/notices/${noticeId}`, headers: jsonHeaders(2),
    payload: JSON.stringify({ title: 'Hijacked notice' }),
  });
  assert.equal(privateNoticeUpdate.statusCode, 404);
  const unchangedNotice = await app.inject({ url: `/v1/notices/${noticeId}`, headers: headers(1) });
  assert.equal((body(unchangedNotice).body as Record<string, unknown>).title, 'Author notice');
  const noticeNoCsrf = await app.inject({
    method: 'PUT', url: `/v1/notices/${noticeId}`, headers: jsonHeaders(1, false),
    payload: JSON.stringify({ title: 'No proof' }),
  });
  assert.equal(noticeNoCsrf.statusCode, 403);
  const readerNotice = await app.inject({ url: '/v1/notices', headers: headers(3) });
  assert.equal(body(readerNotice).errorCode, 'error:RJ');

  const bannerCreate = await app.inject({
    method: 'POST', url: '/v1/banners', headers: jsonHeaders(1),
    payload: JSON.stringify({
      title: 'Author banner', contentHtml: '<p onclick="bad()">Hello</p><script>bad()</script>',
      bannerType: 'horizontal', position: 'top', order: 4,
    }),
  });
  assert.equal(body(bannerCreate).status, 'DONE', bannerCreate.body);
  const banner = body(bannerCreate).body as Record<string, unknown>;
  const bannerId = Number(banner.id);
  assert.equal('createdBy' in banner, false);
  assert.doesNotMatch(String(banner.contentHtml), /script|onclick|bad\(\)/i);
  const editorTwoBanner = await app.inject({
    method: 'POST', url: '/v1/banners', headers: jsonHeaders(2),
    payload: JSON.stringify({ title: 'Other author banner', contentHtml: '<p>Other</p>' }),
  });
  assert.equal(body(editorTwoBanner).status, 'DONE', editorTwoBanner.body);
  const bannerList = await app.inject({ url: '/v1/banners', headers: headers(1) });
  const banners = (body(bannerList).body as { banners: Array<Record<string, unknown>> }).banners;
  assert.equal(banners.length, 1);
  assert.equal(banners[0]?.id, bannerId);
  const privateBanner = await app.inject({ url: `/v1/banners/${bannerId}`, headers: headers(2) });
  assert.equal(privateBanner.statusCode, 404);
  const privateBannerUpdate = await app.inject({
    method: 'PUT', url: `/v1/banners/${bannerId}`, headers: jsonHeaders(2),
    payload: JSON.stringify({ title: 'Hijacked banner' }),
  });
  assert.equal(privateBannerUpdate.statusCode, 404);
  const orderAttempt = await app.inject({
    method: 'PUT', url: '/v1/banners/order', headers: jsonHeaders(2),
    payload: JSON.stringify({ order: [[bannerId, 1]] }),
  });
  assert.deepEqual(body(orderAttempt).body, { message: 'Banner order updated.' });
  const unchangedBanner = await app.inject({ url: `/v1/banners/${bannerId}`, headers: headers(1) });
  assert.equal((body(unchangedBanner).body as Record<string, unknown>).title, 'Author banner');
  assert.equal((body(unchangedBanner).body as Record<string, unknown>).order, 4);
  const ownerOrder = await app.inject({
    method: 'PUT', url: '/v1/banners/order', headers: jsonHeaders(1),
    payload: JSON.stringify({ order: [[bannerId, 0], ['999999', 2], ['broken']] }),
  });
  assert.deepEqual(body(ownerOrder).body, { message: 'Banner order updated.' });
  const ordered = await app.inject({ url: `/v1/banners/${bannerId}`, headers: headers(1) });
  assert.equal((body(ordered).body as Record<string, unknown>).order, 0);
  const deleteOther = await app.inject({ method: 'DELETE', url: `/v1/banners/${bannerId}`, headers: headers(2) });
  assert.equal(deleteOther.statusCode, 404);
  const deleted = await app.inject({ method: 'DELETE', url: `/v1/banners/${bannerId}`, headers: headers(1) });
  assert.deepEqual(body(deleted).body, { message: 'Banner deleted.' });
});

test('keeps author banners from being deleted by another editor', async () => {
  const banner = await app.inject({
    method: 'POST', url: '/v1/banners', headers: jsonHeaders(1),
    payload: JSON.stringify({ title: 'Owned banner', contentHtml: '<p>Safe text</p>', bannerType: 'horizontal', position: 'top', order: 7, isActive: true }),
  });
  assert.equal(body(banner).status, 'DONE', banner.body);
  const bannerId = Number((body(banner).body as Record<string, unknown>).id);
  const crossDelete = await app.inject({ method: 'DELETE', url: `/v1/banners/${bannerId}`, headers: headers(2) });
  assert.notEqual(crossDelete.statusCode === 200 ? body(crossDelete).status : 'REFUSED', 'DONE');
  assert.equal(await prisma.siteBanner.count({ where: { id: bannerId, userId: 1 } }), 1);
});

test('keeps site content writes readable by the Prisma schema', async () => {
  const notice = body(await app.inject({
    method: 'POST', url: '/v1/global-notices', headers: jsonHeaders(1), payload: JSON.stringify({ title: 'Notice', url: '/status' }),
  })).body as Record<string, unknown>;
  const page = body(await app.inject({
    method: 'POST', url: '/v1/static-pages', headers: jsonHeaders(1), payload: JSON.stringify({ title: 'Page', slug: 'page', order: 3_000_000_000 }),
  })).body as Record<string, unknown>;
  assert.equal(page.order, 0, 'an order Prisma could not read back is treated as invalid');
  await prisma.siteNotice.update({ where: { id: Number(notice.id) }, data: { updatedAt: new Date(1000) } });
  await prisma.staticPage.update({ where: { id: Number(page.id) }, data: { updatedAt: new Date(1000) } });

  for (const url of [`/v1/global-notices/${notice.id}`, `/v1/static-pages/${page.id}`]) {
    const emptySave = await app.inject({ method: 'PUT', url, headers: jsonHeaders(1), payload: '{}' });
    assert.equal(body(emptySave).status, 'DONE', emptySave.body);
    assert.notEqual((body(emptySave).body as Record<string, unknown>).updatedDate, '1970-01-01T00:00:01+00:00');
  }

  const other = body(await app.inject({
    method: 'POST', url: '/v1/static-pages', headers: jsonHeaders(1), payload: JSON.stringify({ title: 'Other', slug: 'other' }),
  })).body as Record<string, unknown>;
  const conflict = await app.inject({
    method: 'PUT', url: `/v1/static-pages/${other.id}`, headers: jsonHeaders(1), payload: JSON.stringify({ slug: 'page' }),
  });
  assert.equal(body(conflict).errorCode, 'error:AE');

  const unknownType = await app.inject({
    method: 'POST', url: '/v1/global-banners', headers: jsonHeaders(1),
    payload: JSON.stringify({ title: 'Bad', contentHtml: '<p>x</p>', bannerType: 'floating', position: 'top' }),
  });
  assert.equal(body(unknownType).errorCode, 'error:VA');
  const banner = body(await app.inject({
    method: 'POST', url: '/v1/global-banners', headers: jsonHeaders(1),
    payload: JSON.stringify({ title: 'Wide', contentHtml: '<p>x</p>', bannerType: 'horizontal', position: 'top', order: 3_000_000_000 }),
  })).body as Record<string, unknown>;
  assert.equal(banner.order, 0);
  await app.inject({
    method: 'PUT', url: '/v1/global-banners/order', headers: jsonHeaders(1),
    payload: JSON.stringify({ order: [[banner.id, 3_000_000_000]] }),
  });
  const listed = await app.inject({ url: '/v1/global-banners', headers: headers(1) });
  assert.equal((body(listed).body as { banners: Array<Record<string, unknown>> }).banners[0]?.order, 0);
});

test('gates Telegram integration settings to active superusers and keeps bot secrets hidden', async () => {
  const guest = await app.inject({ url: '/v1/integration-settings' });
  assert.equal(body(guest).errorCode, 'error:NL');
  const reader = await app.inject({ url: '/v1/integration-settings', headers: headers(3) });
  assert.equal(body(reader).errorCode, 'error:RJ');
  const staff = await app.inject({ url: '/v1/integration-settings', headers: headers(1) });
  assert.equal(body(staff).errorCode, 'error:RJ');
  const inactive = await app.inject({ url: '/v1/integration-settings', headers: headers(4) });
  assert.equal(body(inactive).errorCode, 'error:NL');

  const get = await app.inject({ url: '/v1/integration-settings', headers: headers(2) });
  assert.equal(body(get).status, 'DONE');
  assert.deepEqual(body(get).body, {
    telegramEnabled: false,
    telegramBotUsername: '',
    telegramHasBotToken: false,
    updatedDate: '2025-01-01T00:00:00+00:00',
    telegramConnection: { state: 'disabled', detail: '' },
  });
  assert.equal(telegramCalls.length, 0);

  assert.equal(body(await app.inject({ url: '/v1/integration-settings', headers: headers(1) })).errorCode, 'error:RJ');
  const noCsrf = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2, false),
    payload: JSON.stringify({ telegramEnabled: true, telegramBotToken: '123456:valid-token' }),
  });
  assert.equal(noCsrf.statusCode, 403);

  configureTelegram({ getMe: { ok: true, result: { username: 'page_bot' } }, setWebhook: { ok: true } });
  const saved = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ telegramEnabled: true, telegramBotUsername: '', telegramBotToken: '123456:page-token' }),
  });
  assert.equal(body(saved).status, 'DONE', saved.body);
  const updated = await app.inject({ url: '/v1/integration-settings', headers: headers(2) });
  assert.match(updated.body, /page_bot/);
  assert.doesNotMatch(updated.body, /page-token/);
});

test('validates and encrypts Telegram tokens, confirms bots, and registers HMAC webhooks after saving', async () => {
  const missingToken = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ telegramEnabled: true }),
  });
  assert.equal(body(missingToken).errorCode, 'error:VA');
  const malformed = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ telegramEnabled: true, telegramBotToken: '123/../../getMe' }),
  });
  assert.equal(body(malformed).errorCode, 'error:VA');
  assert.equal(telegramCalls.length, 0);

  configureTelegram({ getMe: { ok: false, error_code: 401, description: 'Unauthorized' } });
  const invalidTelegramToken = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ telegramEnabled: true, telegramBotToken: '123456:invalid-token' }),
  });
  assert.equal(body(invalidTelegramToken).errorCode, 'error:VA');
  assert.deepEqual(telegramCalls.map((call) => new URL(call.url).pathname.split('/').at(-1)), ['getMe']);
  const [unchanged] = await prisma.$queryRaw<Array<{ token: string; enabled: number }>>`
    SELECT telegramBotToken AS token, telegramEnabled AS enabled FROM IntegrationSetting WHERE id = 1
  `;
  assert.equal(unchanged?.token, '');
  assert.equal(Number(unchanged?.enabled), 0);
  assert.equal(Number((await prisma.$queryRaw<Array<{ total: number | bigint }>>`SELECT COUNT(*) AS total FROM AdminLog`)[0]?.total), 0);

  configureTelegram({
    getMe: { ok: true, result: { username: 'verified_bot' } },
    setWebhook: { ok: true, result: true },
  });
  const update = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ telegramEnabled: true, telegramBotUsername: '@old_name', telegramBotToken: '123456:synthetic-token' }),
  });
  assert.equal(body(update).status, 'DONE', update.body);
  const settings = body(update).body as Record<string, unknown>;
  assert.equal(settings.telegramEnabled, true);
  assert.equal(settings.telegramBotUsername, 'verified_bot');
  assert.equal(settings.telegramHasBotToken, true);
  assert.deepEqual(settings.telegramConnection, { state: 'connected', detail: '' });
  assert.doesNotMatch(update.body, /synthetic-token|telegramBotToken/);
  assert.deepEqual(telegramCalls.map((call) => new URL(call.url).pathname.split('/').at(-1)), ['getMe', 'setWebhook']);
  const webhookCall = telegramCalls[1];
  assert.equal(webhookCall?.init?.method, 'POST');
  const webhookBody = JSON.parse(String(webhookCall?.init?.body)) as Record<string, unknown>;
  assert.equal(webhookBody.url, 'https://blog.example/v1/telegram/webHook');
  assert.equal(webhookBody.secret_token, createHmac('sha256', secretKey).update('telegram-webhook:123456:synthetic-token').digest('hex'));
  assert.deepEqual(webhookBody.allowed_updates, ['message']);

  const [saved] = await prisma.$queryRaw<Array<{ token: string; username: string; enabled: number }>>`
    SELECT telegramBotToken AS token, telegramBotUsername AS username, telegramEnabled AS enabled
    FROM IntegrationSetting WHERE id = 1
  `;
  assert.notEqual(saved?.token, '123456:synthetic-token');
  assert.equal(decryptSecret(saved?.token ?? '', cipherKey), '123456:synthetic-token');
  assert.equal(saved?.username, 'verified_bot');
  assert.equal(Number(saved?.enabled), 1);
  const audit = await prisma.$queryRaw<Array<{ changeMessage: string }>>`SELECT message AS changeMessage FROM AdminLog ORDER BY id DESC LIMIT 1`;
  assert.equal(audit[0]?.changeMessage, 'Updated notification integration settings');
  assert.doesNotMatch(audit[0]?.changeMessage ?? '', /synthetic-token/);
});

test('reports Telegram webhook states, saves unreachable settings, and preserves a disabled secret', async () => {
  configureTelegram();
  telegramUnreachable = true;
  const unreachable = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ telegramEnabled: true, telegramBotUsername: 'offline_bot', telegramBotToken: '123456:offline-token' }),
  });
  assert.equal(body(unreachable).status, 'DONE', unreachable.body);
  assert.deepEqual((body(unreachable).body as Record<string, unknown>).telegramConnection, { state: 'unreachable', detail: '' });
  assert.equal(telegramCalls.length, 1);
  const [savedToken] = await prisma.$queryRaw<Array<{ token: string }>>`
    SELECT telegramBotToken AS token FROM IntegrationSetting WHERE id = 1
  `;
  assert.equal(decryptSecret(savedToken?.token ?? '', cipherKey), '123456:offline-token');

  telegramUnreachable = false;
  configureTelegram({
    getWebhookInfo: { ok: true, result: {
      url: 'https://blog.example/v1/telegram/webHook', pending_update_count: 4, last_error_message: 'Synthetic delivery failure',
    } },
  });
  const deliveryFailed = await app.inject({ url: '/v1/integration-settings', headers: headers(2) });
  assert.deepEqual((body(deliveryFailed).body as Record<string, unknown>).telegramConnection, {
    state: 'delivery_failed', detail: 'Synthetic delivery failure',
  });

  const disable = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ telegramEnabled: false }),
  });
  assert.equal(body(disable).status, 'DONE');
  assert.deepEqual((body(disable).body as Record<string, unknown>).telegramConnection, { state: 'disabled', detail: '' });
  assert.equal((body(disable).body as Record<string, unknown>).telegramHasBotToken, true);
  const [stillSaved] = await prisma.$queryRaw<Array<{ token: string; enabled: number }>>`
    SELECT telegramBotToken AS token, telegramEnabled AS enabled FROM IntegrationSetting WHERE id = 1
  `;
  assert.equal(decryptSecret(stillSaved?.token ?? '', cipherKey), '123456:offline-token');
  assert.equal(Number(stillSaved?.enabled), 0);
});

test('limits utility access to superusers and requires session-bound one-time cleanup previews', async () => {
  const guest = await app.inject({ url: '/v1/utilities/stats' });
  assert.equal(body(guest).errorCode, 'error:NL');
  const staff = await app.inject({ url: '/v1/utilities/stats', headers: headers(1) });
  assert.equal(body(staff).errorCode, 'error:RJ');
  const stats = await app.inject({ url: '/v1/utilities/stats', headers: headers(2) });
  assert.equal(body(stats).status, 'DONE');
  const statistics = body(stats).body as Record<string, unknown>;
  for (const field of ['totalPosts', 'publicPosts', 'totalUsers', 'totalSessions', 'logCount', 'developerRequestLogCount', 'dbSize']) {
    assert.ok(field in statistics, `missing ${field}`);
  }

  const database = new DatabaseSync(databasePath);
  database.exec(`
    INSERT INTO "Tag" ("id", "name") VALUES
    (1, 'kept'),
    (2, 'unused-before-preview');
    INSERT INTO "_PostToTag" ("A", "B") VALUES
    (1, 1);
  `);
  database.prepare(`
    INSERT INTO "User" (id, username, name, email, passwordHash, isActive, isStaff, isSuperuser, joinedAt, lastLoginAt)
    VALUES (?, ?, ?, ?, '', 1, 1, 1, ${Date.UTC(2025, 0, 1)}, NULL)
  `).run(6, 'second-superuser', 'Second', 'second@example.test');
  database.close();
  const preview = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: jsonHeaders(2),
    payload: JSON.stringify({ dryRun: true }),
  });
  assert.equal(body(preview).status, 'DONE', preview.body);
  const previewBody = body(preview).body as Record<string, unknown>;
  assert.equal(previewBody.dryRun, true);
  assert.equal(previewBody.cleanedCount, 1);
  const confirmation = String(previewBody.confirmationToken);
  assert.ok(confirmation.length > 32);
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM "Tag" WHERE name = 'unused-before-preview'`)[0]?.count), 1);

  const wrongSession = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: {
      ...jsonHeaders(2), cookie: `csrftoken=${csrfToken}; blexsessionid=${'z'.repeat(43)}`,
    },
    payload: JSON.stringify({ dryRun: false, confirmationToken: confirmation }),
  });
  assert.equal(body(wrongSession).errorCode, 'error:RJ');
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM "Tag" WHERE name = 'unused-before-preview'`)[0]?.count), 1);

  const otherUser = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: jsonHeaders(6),
    payload: JSON.stringify({ dryRun: false, confirmationToken: confirmation }),
  });
  assert.equal(body(otherUser).errorCode, 'error:RJ');
  const noCsrf = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: jsonHeaders(2, false),
    payload: JSON.stringify({ dryRun: true }),
  });
  assert.equal(noCsrf.statusCode, 403);

  const execute = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: jsonHeaders(2),
    payload: JSON.stringify({ dryRun: false, confirmationToken: confirmation }),
  });
  assert.equal(body(execute).status, 'DONE', execute.body);
  assert.equal((body(execute).body as Record<string, unknown>).dryRun, false);
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM "Tag" WHERE name = 'unused-before-preview'`)[0]?.count), 0);
  const reuse = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: jsonHeaders(2),
    payload: JSON.stringify({ dryRun: false, confirmationToken: confirmation }),
  });
  assert.equal(body(reuse).errorCode, 'error:RJ');
  const audit = await prisma.$queryRaw<Array<{ message: string }>>`SELECT message FROM AdminLog ORDER BY id DESC LIMIT 1`;
  assert.equal(audit[0]?.message, 'Executed unused tag cleanup');
});

test('binds session cleanup confirmation to its scope and deletes only the previewed session set', async () => {
  const now = BigInt(Date.now());
  const database = new DatabaseSync(databasePath);
  database.prepare('INSERT INTO "Session" (tokenHash, userId, credentialTag, expiresAt) VALUES (?, ?, \'\', ?)').run('expired', 3, now - 1_000n);
  database.prepare('INSERT INTO "Session" (tokenHash, userId, credentialTag, expiresAt) VALUES (?, ?, \'\', ?)').run('active', 3, now + 60_000n);
  database.close();

  const preview = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-sessions', headers: jsonHeaders(2),
    payload: JSON.stringify({ dryRun: true, cleanAll: false }),
  });
  const previewBody = body(preview).body as Record<string, unknown>;
  assert.equal(previewBody.expiredSessions, 1);
  const mismatch = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-sessions', headers: jsonHeaders(2),
    payload: JSON.stringify({ dryRun: false, cleanAll: true, confirmationToken: previewBody.confirmationToken }),
  });
  assert.equal(body(mismatch).errorCode, 'error:RJ');
  const execute = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-sessions', headers: jsonHeaders(2),
    payload: JSON.stringify({ dryRun: false, cleanAll: false, confirmationToken: previewBody.confirmationToken }),
  });
  assert.equal(body(execute).status, 'DONE', execute.body);
  assert.equal((body(execute).body as Record<string, unknown>).cleanedCount, 1);
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM "Session" WHERE tokenHash = 'active'`)[0]?.count), 1);
});

test('lets only one of two simultaneous requests spend a cleanup confirmation', async () => {
  const preview = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: jsonHeaders(2), payload: JSON.stringify({ dryRun: true }),
  });
  const confirmationToken = (body(preview).body as { confirmationToken: string }).confirmationToken;
  const attempt = () => app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: jsonHeaders(2),
    payload: JSON.stringify({ dryRun: false, confirmationToken }),
  });
  const results = (await Promise.all([attempt(), attempt()])).map((response) => body(response).status).sort();
  assert.deepEqual(results, ['DONE', 'ERROR']);
  assert.equal(await prisma.adminLog.count(), 1);
});

test('reading absent singleton settings shows defaults without creating rows, and the first write creates them', async () => {
  const database = new DatabaseSync(databasePath);
  database.exec('DELETE FROM SiteSetting; DELETE FROM LoginSetting; DELETE FROM IntegrationSetting;');
  database.close();

  const site = body(await app.inject({ url: '/v1/site-settings', headers: headers(2) })).body as Record<string, unknown>;
  assert.equal(site.siteName, 'BLEX');
  assert.equal(site.seoEnabled, true);
  assert.equal(site.updatedDate, '');
  const login = body(await app.inject({ url: '/v1/login-settings', headers: headers(2) })).body as Record<string, unknown>;
  assert.equal(login.welcomeNotificationUrl, '/');
  const integration = body(await app.inject({ url: '/v1/integration-settings', headers: headers(2) })).body as Record<string, unknown>;
  assert.equal(integration.telegramEnabled, false);
  const rejected = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2), payload: JSON.stringify({ telegramEnabled: true }),
  });
  assert.equal(body(rejected).errorCode, 'error:VA');
  assert.deepEqual(
    [await prisma.siteSetting.count(), await prisma.loginSetting.count(), await prisma.integrationSetting.count()],
    [0, 0, 0],
  );

  const saved = await app.inject({
    method: 'PUT', url: '/v1/site-settings', headers: jsonHeaders(2), payload: JSON.stringify({ aeoEnabled: true }),
  });
  assert.equal(body(saved).status, 'DONE', saved.body);
  const row = await prisma.siteSetting.findUniqueOrThrow({ where: { id: 1 } });
  assert.deepEqual([row.siteName, row.seoEnabled, row.aeoEnabled], ['BLEX', true, true]);
  await prisma.loginSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  assert.equal((await prisma.loginSetting.findUniqueOrThrow({ where: { id: 1 } })).welcomeNotificationUrl, '/');
});

test('previews and confirms expired log cleanup for superusers only', async () => {
  assert.equal(body(await app.inject({ url: '/v1/utilities/stats', headers: headers(1) })).errorCode, 'error:RJ');

  const database = new DatabaseSync(databasePath);
  database.prepare(`
    INSERT INTO AdminLog (objectName, action, message, userId, createdAt)
    VALUES ('old audit', 2, 'old', 2, 1577836800000)
  `).run();
  database.prepare(`INSERT INTO DeveloperRequestLog (id, userId, method, path, statusCode, createdAt) VALUES (1, 2, 'GET', '/api/developer/v1/me', 200, ?)`).run(Date.UTC(2020, 0, 1));
  database.prepare(`INSERT INTO DeveloperRequestLog (id, userId, method, path, statusCode, createdAt) VALUES (2, 2, 'GET', '/api/developer/v1/me', 200, ?)`).run(Date.now());
  database.close();

  const preview = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-logs', headers: jsonHeaders(2), payload: JSON.stringify({ dryRun: true }),
  });
  assert.equal(body(preview).status, 'DONE', preview.body);
  const confirmation = (body(preview).body as { confirmationToken?: string }).confirmationToken;
  assert.ok(confirmation);
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM AdminLog WHERE message = 'old'`)[0]?.count), 1);

  const execute = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-logs', headers: jsonHeaders(2),
    payload: JSON.stringify({ dryRun: false, confirmationToken: confirmation }),
  });
  assert.equal(body(execute).status, 'DONE', execute.body);
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM AdminLog WHERE message = 'old'`)[0]?.count), 0);
  assert.deepEqual((await prisma.developerRequestLog.findMany({ select: { id: true } })).map(({ id }) => id), [2]);
  const noCsrf = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: jsonHeaders(2, false), payload: JSON.stringify({ dryRun: true }),
  });
  assert.equal(noCsrf.statusCode, 403);
});

test('image cleanup retains every referenced asset and only clears cache rows for files it removed', async () => {
  const publicFiles = [
    'images/content/unused-content.png',
    'images/content/current-content.png',
    'images/content/archived-history.png',
    'images/content/notice-content.png',
    'images/content/banner-content.png',
    'images/content/inactive-banner-content.png',
    'images/content/worklog-content.png',
    'images/title/deleted-post-title.png',
    'images/title/banner-title.png',
    'images/avatar/profile-avatar.png',
    'images/avatar/banner-avatar.png',
    'images/avatar/orphan-avatar.png',
  ];
  for (const relativePath of publicFiles) {
    const path = join(mediaRoot, relativePath);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, relativePath.startsWith('images/title/') ? 'same-title-image' : relativePath);
  }
  await mkdir(join(mediaRoot, 'images/title'), { recursive: true });
  await writeFile(join(mediaRoot, 'images/title/duplicate-title.png'), 'same-title-image');
  await writeFile(join(mediaRoot, 'images/title/duplicate-title-copy.png'), 'same-title-image');

  const database = new DatabaseSync(databasePath);
  database.exec(`
    UPDATE "Post" SET image = '/resources/media/images/title/deleted-post-title.png' WHERE id = 3;
    UPDATE "Profile" SET avatar = '/resources/media/images/avatar/profile-avatar.png' WHERE userId = 1;
    INSERT INTO "PostContent" ("postId", "html") VALUES
    (1, '<img src="/resources/media/images/content/current-content.png">');
    INSERT INTO "PostRevision" (id, postId, type, tags, content)
      VALUES (1, 3, 'edit', '[]', '![](/resources/media/images/content/archived-history.png)');
    INSERT INTO SiteNotice (id, scope, userId, title, isActive, "order", createdAt, updatedAt, url)
      VALUES (1, 'global', NULL, 'Inactive notice', 0, 0, 1735689600000, 1735689600000, '/resources/media/images/content/notice-content.png');
    INSERT INTO SiteBanner (id, scope, type, position, userId, title, isActive, "order", createdAt, updatedAt, contentHtml)
      VALUES (1, 'global', 'horizontal', 'top', NULL, 'Active banner', 1, 0, 1735689600000, 1735689600000,
        '<img src="/resources/media/images/content/banner-content.png"><img src="/resources/media/images/title/banner-title.png"><img src="/resources/media/images/avatar/banner-avatar.png">');
    INSERT INTO SiteBanner (id, scope, type, position, userId, title, isActive, "order", createdAt, updatedAt, contentHtml)
      VALUES (2, 'global', 'horizontal', 'top', NULL, 'Inactive banner', 0, 1, 1735689600000, 1735689600000,
        '<img src="/resources/media/images/content/inactive-banner-content.png">');
    INSERT INTO WorkLogEntry (id, text) VALUES (1, '![](/resources/media/images/content/worklog-content.png)');
    INSERT INTO UploadedImage (id, key, path, size) VALUES
      (1, 'unused-image-cache', 'images/content/unused-content.png', 1),
      (2, 'current-image-cache', 'images/content/current-content.png', 1);
  `);
  database.close();

  const preview = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-images', headers: jsonHeaders(2),
    payload: JSON.stringify({ dryRun: true, target: 'all', removeDuplicates: true }),
  });
  assert.equal(body(preview).status, 'DONE', preview.body);
  const previewBody = body(preview).body as Record<string, unknown>;
  assert.equal(previewBody.totalUnused, 4);
  assert.equal(previewBody.totalDuplicates, 1);
  const confirmation = String(previewBody.confirmationToken);
  const previewHash = String(previewBody.previewHash);
  const previewFiles = previewBody.unusedFiles as Array<{ url: string }>;
  const candidateUrls = previewFiles.map((file) => file.url);
  for (const retained of [
    'current-content.png', 'archived-history.png', 'notice-content.png', 'banner-content.png',
    'inactive-banner-content.png', 'worklog-content.png', 'deleted-post-title.png', 'banner-title.png', 'profile-avatar.png', 'banner-avatar.png',
  ]) {
    assert.equal(candidateUrls.some((url) => url.endsWith(retained)), false, `${retained} should be retained`);
  }
  assert.equal(candidateUrls.some((url) => url.endsWith('unused-content.png')), true);

  await writeFile(join(mediaRoot, 'images/content/added-after-preview.png'), 'changed candidate set');
  const stale = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-images', headers: jsonHeaders(2),
    payload: JSON.stringify({ dryRun: false, target: 'all', removeDuplicates: true, confirmationToken: confirmation, previewHash: previewHash }),
  });
  assert.equal(body(stale).errorCode, 'error:RJ');
  assert.equal(await readFile(join(mediaRoot, 'images/content/unused-content.png'), 'utf8'), 'images/content/unused-content.png');

  const freshPreview = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-images', headers: jsonHeaders(2),
    payload: JSON.stringify({ dryRun: true, target: 'all', removeDuplicates: true }),
  });
  const freshBody = body(freshPreview).body as Record<string, unknown>;
  const execute = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-images', headers: jsonHeaders(2),
    payload: JSON.stringify({
      dryRun: false, target: 'all', removeDuplicates: true,
      confirmationToken: freshBody.confirmationToken,
    }),
  });
  assert.equal(body(execute).status, 'DONE', execute.body);
  const result = body(execute).body as Record<string, unknown>;
  assert.equal(result.hasErrors, false);
  assert.ok((result.messages as string[]).some((message) => /^콘텐츠 이미지 \d+개를 삭제했습니다\.$/.test(message)), String(result.messages));
  assert.equal(await readFile(join(mediaRoot, 'images/content/unused-content.png'), 'utf8').catch(() => null), null);
  assert.equal(await readFile(join(mediaRoot, 'images/content/current-content.png'), 'utf8'), 'images/content/current-content.png');
  assert.equal(await readFile(join(mediaRoot, 'images/content/archived-history.png'), 'utf8'), 'images/content/archived-history.png');
  assert.equal(await readFile(join(mediaRoot, 'images/title/deleted-post-title.png'), 'utf8'), 'same-title-image');
  assert.equal(await readFile(join(mediaRoot, 'images/avatar/profile-avatar.png'), 'utf8'), 'images/avatar/profile-avatar.png');
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM UploadedImage`)[0]?.count), 1);
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM UploadedImage WHERE path = 'images/content/current-content.png'`)[0]?.count), 1);
  const audit = await prisma.$queryRaw<Array<{ message: string }>>`SELECT message FROM AdminLog ORDER BY id DESC LIMIT 1`;
  assert.equal(audit[0]?.message, 'Executed unused image cleanup');
});

test('lists users with filters and safely updates only reader/editor roles', async () => {
  const denied = await app.inject({ url: '/v1/admin/users', headers: headers(3) });
  assert.equal(body(denied).errorCode, 'error:RJ');
  const list = await app.inject({ url: '/v1/admin/users?ordering=-postCount&page=1&pageSize=2', headers: headers(1) });
  assert.equal(body(list).status, 'DONE');
  const result = body(list).body as {
    users: Array<Record<string, unknown>>;
    pagination: Record<string, unknown>;
    stats: Record<string, unknown>;
  };
  assert.equal(result.users[0]?.username, 'site-editor');
  assert.equal(result.users[0]?.postCount, 2);
  assert.equal(result.pagination.pageSize, 2);
  assert.equal(result.pagination.totalPages, 3);
  assert.equal(result.stats.total, 5);
  assert.equal(result.stats.editors, 3);
  assert.equal(result.stats.readers, 1);
  assert.equal(result.stats.admins, 3);

  const readers = await app.inject({ url: '/v1/admin/users?role=reader&page=50&pageSize=200', headers: headers(2) });
  const readerList = (body(readers).body as { users: Array<Record<string, unknown>>; pagination: Record<string, unknown> });
  assert.equal(readerList.users.length, 1);
  assert.equal(readerList.users[0]?.username, 'reader');
  assert.equal(readerList.pagination.page, 1);
  assert.equal(readerList.pagination.pageSize, 100);

  const roleUpdate = await app.inject({
    method: 'PATCH', url: '/v1/admin/users/3/role', headers: jsonHeaders(1), payload: JSON.stringify({ role: 'EDITOR' }),
  });
  assert.equal(body(roleUpdate).status, 'DONE', roleUpdate.body);
  await prisma.post.update({ where: { id: 4 }, data: { deletedAt: new Date() } });
  await prisma.post.create({ data: { id: 40, authorId: 3, slug: 'post-40', title: '', updatedAt: new Date() } });
  const countedRole = await app.inject({
    method: 'PATCH', url: '/v1/admin/users/3/role', headers: jsonHeaders(1), payload: JSON.stringify({ role: 'EDITOR' }),
  });
  const listedUsers = await app.inject({ url: '/v1/admin/users?q=reader', headers: headers(1) });
  const listed = (body(listedUsers).body as { users: Array<{ id: number; postCount: number }> }).users.find((user) => user.id === 3);
  assert.equal((body(countedRole).body as { user: { postCount: number } }).user.postCount, 1);
  assert.equal(listed?.postCount, 1);
  await prisma.post.delete({ where: { id: 40 } });
  await prisma.post.update({ where: { id: 4 }, data: { deletedAt: null } });
  const [profile] = await prisma.$queryRaw<Array<{ role: string }>>`SELECT role FROM "Profile" WHERE userId = 3`;
  assert.equal(profile?.role, 'EDITOR');
  const [config] = await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM "UserPreference" WHERE userId = 3`;
  assert.equal(Number(config?.count), 1);

  const ownRole = await app.inject({
    method: 'PATCH', url: '/v1/admin/users/1/role', headers: jsonHeaders(1), payload: JSON.stringify({ role: 'READER' }),
  });
  assert.equal(body(ownRole).errorCode, 'error:RJ');
  const adminRole = await app.inject({
    method: 'PATCH', url: '/v1/admin/users/2/role', headers: jsonHeaders(1), payload: JSON.stringify({ role: 'READER' }),
  });
  assert.equal(body(adminRole).errorCode, 'error:RJ');
  const forbiddenRole = await app.inject({
    method: 'PATCH', url: '/v1/admin/users/3/role', headers: jsonHeaders(1), payload: JSON.stringify({ role: 'ADMIN' }),
  });
  assert.equal(body(forbiddenRole).errorCode, 'error:RJ');
  const noCsrf = await app.inject({
    method: 'PATCH', url: '/v1/admin/users/3/role', headers: jsonHeaders(1, false), payload: JSON.stringify({ role: 'READER' }),
  });
  assert.equal(noCsrf.statusCode, 403);
  const [staff] = await prisma.$queryRaw<Array<{ isStaff: number | bigint; isSuperuser: number | bigint }>>`
    SELECT isStaff, isSuperuser FROM "User" WHERE id = 3
  `;
  assert.equal(Number(staff?.isStaff), 0);
  assert.equal(Number(staff?.isSuperuser), 0);
  const demote = await app.inject({
    method: 'PATCH', url: '/v1/admin/users/3/role', headers: jsonHeaders(1), payload: JSON.stringify({ role: 'READER' }),
  });
  assert.equal(body(demote).status, 'DONE', demote.body);
  const [scheduledPost] = await prisma.$queryRaw<Array<{ publishedDate: string | null }>>`
    SELECT CAST(publishedAt AS TEXT) AS publishedDate FROM "Post" WHERE id = 4
  `;
  assert.equal(scheduledPost?.publishedDate, null);
  const profilelessPromotion = await app.inject({
    method: 'PATCH', url: '/v1/admin/users/5/role', headers: jsonHeaders(1), payload: JSON.stringify({ role: 'EDITOR' }),
  });
  assert.equal(body(profilelessPromotion).status, 'DONE', profilelessPromotion.body);
  const [newProfile] = await prisma.$queryRaw<Array<{ role: string }>>`SELECT role FROM "Profile" WHERE userId = 5`;
  assert.equal(newProfile?.role, 'EDITOR');
  const [newConfig] = await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM "UserPreference" WHERE userId = 5`;
  assert.equal(Number(newConfig?.count), 1);
});
