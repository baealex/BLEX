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
import { decryptDjangoSecret, encryptDjangoSecret } from '../src/features/auth/django-secret.js';
import { registerAdminSettings } from '../src/features/site-admin/index.js';

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
  database.exec(`
    CREATE TABLE auth_user (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL, first_name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT 1, is_staff BOOLEAN NOT NULL DEFAULT 0,
      is_superuser BOOLEAN NOT NULL DEFAULT 0, date_joined DATETIME NOT NULL DEFAULT '2025-01-01 00:00:00', last_login DATETIME
    );
    CREATE TABLE django_content_type (id INTEGER PRIMARY KEY, app_label TEXT NOT NULL, model TEXT NOT NULL, UNIQUE(app_label, model));
    CREATE TABLE auth_permission (id INTEGER PRIMARY KEY, content_type_id INTEGER NOT NULL, codename TEXT NOT NULL, name TEXT NOT NULL);
    CREATE TABLE auth_user_user_permissions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, permission_id INTEGER NOT NULL);
    CREATE TABLE auth_group (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE auth_user_groups (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, group_id INTEGER NOT NULL);
    CREATE TABLE auth_group_permissions (id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL, permission_id INTEGER NOT NULL);
    CREATE TABLE board_sitesetting (
      id INTEGER PRIMARY KEY, header_script TEXT NOT NULL, footer_script TEXT NOT NULL,
      updated_date DATETIME NOT NULL, aeo_enabled BOOLEAN NOT NULL, seo_enabled BOOLEAN NOT NULL,
      robots_txt_extra_rules TEXT NOT NULL, site_name TEXT NOT NULL, logo_svg TEXT NOT NULL,
      logo_svg_dark TEXT NOT NULL, icon_svg TEXT NOT NULL, icon_svg_dark TEXT NOT NULL,
      icon_manifest TEXT NOT NULL
    );
    CREATE TABLE board_loginsetting (
      id INTEGER PRIMARY KEY, welcome_notification_message TEXT NOT NULL,
      welcome_notification_url TEXT NOT NULL, account_deletion_redirect_url TEXT NOT NULL,
      hcaptcha_enabled BOOLEAN NOT NULL, hcaptcha_site_key TEXT NOT NULL,
      hcaptcha_secret_key TEXT NOT NULL, updated_date DATETIME NOT NULL
    );
    CREATE TABLE board_socialauthprovider (
      id INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE, client_id TEXT NOT NULL,
      client_secret TEXT NOT NULL, is_enabled BOOLEAN NOT NULL
    );
    CREATE TABLE board_integrationsetting (
      id INTEGER PRIMARY KEY, telegram_enabled BOOLEAN NOT NULL DEFAULT 0,
      telegram_bot_username TEXT NOT NULL DEFAULT '', telegram_bot_token TEXT NOT NULL DEFAULT '',
      updated_date DATETIME NOT NULL
    );
    CREATE TABLE board_authorinvite (
      id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, note TEXT NOT NULL, is_active BOOLEAN NOT NULL,
      created_date DATETIME NOT NULL, claimed_date DATETIME, claimed_by_id INTEGER, created_by_id INTEGER
    );
    CREATE TABLE board_staticpage (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, content TEXT NOT NULL DEFAULT '',
      meta_description TEXT NOT NULL DEFAULT '', is_published BOOLEAN NOT NULL DEFAULT 1,
      show_in_footer BOOLEAN NOT NULL DEFAULT 0, "order" INTEGER NOT NULL DEFAULT 0,
      created_date DATETIME NOT NULL, updated_date DATETIME NOT NULL, author_id INTEGER
    );
    CREATE TABLE board_sitenotice (
      id INTEGER PRIMARY KEY, scope TEXT NOT NULL, user_id INTEGER, title TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT 1, "order" INTEGER NOT NULL DEFAULT 0,
      created_date DATETIME NOT NULL, updated_date DATETIME NOT NULL, url TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE board_sitebanner (
      id INTEGER PRIMARY KEY, scope TEXT NOT NULL, user_id INTEGER, title TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT 1, "order" INTEGER NOT NULL DEFAULT 0,
      created_date DATETIME NOT NULL, updated_date DATETIME NOT NULL, content_html TEXT NOT NULL DEFAULT '',
      banner_type TEXT NOT NULL DEFAULT 'horizontal', position TEXT NOT NULL DEFAULT 'top'
    );
    CREATE TABLE WorkLogEntry (id INTEGER PRIMARY KEY, text TEXT NOT NULL DEFAULT '');
    CREATE TABLE board_profile (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE, role TEXT NOT NULL DEFAULT 'READER',
      about_md TEXT NOT NULL DEFAULT '', about_html TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', cover TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '', homepage TEXT NOT NULL DEFAULT '', analytics_share_url TEXT NOT NULL DEFAULT ''
  );
    CREATE TABLE board_config (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE, language TEXT, time_zone TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE board_post (
      id INTEGER PRIMARY KEY, author_id INTEGER NOT NULL, deleted_date DATETIME,
      published_date DATETIME, updated_date DATETIME NOT NULL DEFAULT '2025-01-01 00:00:00', image TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE board_postcontent (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL UNIQUE, content_html TEXT NOT NULL DEFAULT '');
    CREATE TABLE board_edithistory (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, content TEXT NOT NULL DEFAULT '');
    CREATE TABLE board_editrequest (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, content TEXT NOT NULL DEFAULT '');
    CREATE TABLE board_postconfig (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL UNIQUE, hide BOOLEAN NOT NULL DEFAULT 0);
    CREATE TABLE board_comment (id INTEGER PRIMARY KEY, text_md TEXT NOT NULL DEFAULT '', text_html TEXT NOT NULL DEFAULT '');
    CREATE TABLE board_series (id INTEGER PRIMARY KEY, text_md TEXT NOT NULL DEFAULT '', text_html TEXT NOT NULL DEFAULT '');
    CREATE TABLE board_form (id INTEGER PRIMARY KEY, content TEXT NOT NULL DEFAULT '');
    CREATE TABLE board_imagecache (id INTEGER PRIMARY KEY, key TEXT NOT NULL, path TEXT NOT NULL);
    CREATE TABLE board_tag (id INTEGER PRIMARY KEY, value TEXT NOT NULL UNIQUE);
    CREATE TABLE board_post_tags (post_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, UNIQUE(post_id, tag_id));
    CREATE TABLE board_developerrequestlog (id INTEGER PRIMARY KEY, created_date DATETIME NOT NULL);
    CREATE TABLE blex_session (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at BIGINT NOT NULL);
    CREATE TABLE django_session (session_key TEXT PRIMARY KEY, session_data TEXT NOT NULL, expire_date TEXT NOT NULL);
    CREATE TABLE board_utilitycleanupconfirmation (
      id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, action TEXT NOT NULL,
      session_fingerprint TEXT NOT NULL, expires_at DATETIME NOT NULL, consumed_at DATETIME,
      created_date DATETIME NOT NULL, user_id INTEGER NOT NULL
    );
    CREATE TABLE django_admin_log (
      id INTEGER PRIMARY KEY, object_id TEXT, object_repr TEXT NOT NULL, action_flag INTEGER NOT NULL,
      change_message TEXT NOT NULL, content_type_id INTEGER, user_id INTEGER NOT NULL, action_time DATETIME NOT NULL
    );
  `);
  database.close();
}

function seedDatabase() {
  const database = new DatabaseSync(databasePath);
  database.exec(`
    DELETE FROM django_admin_log;
    DELETE FROM board_authorinvite;
    DELETE FROM board_staticpage;
    DELETE FROM board_sitenotice;
    DELETE FROM board_sitebanner;
    DELETE FROM WorkLogEntry;
    DELETE FROM board_profile;
    DELETE FROM board_config;
    DELETE FROM board_post;
    DELETE FROM board_postcontent;
    DELETE FROM board_edithistory;
    DELETE FROM board_editrequest;
    DELETE FROM board_postconfig;
    DELETE FROM board_comment;
    DELETE FROM board_series;
    DELETE FROM board_form;
    DELETE FROM board_imagecache;
    DELETE FROM board_tag;
    DELETE FROM board_post_tags;
    DELETE FROM board_developerrequestlog;
    DELETE FROM blex_session;
    DELETE FROM board_utilitycleanupconfirmation;
    DELETE FROM board_socialauthprovider;
    DELETE FROM board_integrationsetting;
    DELETE FROM board_loginsetting;
    DELETE FROM board_sitesetting;
    DELETE FROM auth_user_user_permissions;
    DELETE FROM auth_group_permissions;
    DELETE FROM auth_user_groups;
    DELETE FROM auth_permission;
    DELETE FROM django_content_type;
    DELETE FROM auth_group;
    DELETE FROM auth_user;
    INSERT INTO auth_user (id, username, first_name, email, is_active, is_staff, is_superuser, date_joined, last_login) VALUES
      (1, 'site-editor', 'Site Editor', 'editor@example.test', 1, 1, 0, '2025-01-01 00:00:00', '2025-01-02 00:00:00'),
      (2, 'admin', 'Admin', 'admin@example.test', 1, 1, 1, '2025-01-01 00:00:00', '2025-01-03 00:00:00'),
      (3, 'reader', 'Reader', 'reader@example.test', 1, 0, 0, '2025-01-02 00:00:00', NULL),
      (4, 'inactive-admin', 'Inactive', 'inactive@example.test', 0, 1, 1, '2025-01-03 00:00:00', NULL),
      (5, 'profileless', 'No Profile', 'profileless@example.test', 1, 0, 0, '2025-01-04 00:00:00', NULL);
    INSERT INTO board_profile (id, user_id, role) VALUES
      (1, 1, 'EDITOR'), (2, 2, 'EDITOR'), (3, 3, 'READER'), (4, 4, 'EDITOR');
    INSERT INTO board_post (id, author_id, deleted_date, published_date) VALUES
      (1, 1, NULL, NULL), (2, 1, NULL, NULL), (3, 1, '2025-01-04 00:00:00', NULL), (4, 3, NULL, '2099-01-01 00:00:00');
    INSERT INTO django_content_type VALUES (1, 'board', 'sitesetting');
    INSERT INTO auth_permission VALUES (1, 1, 'change_sitesetting', 'Can change site settings');
    INSERT INTO auth_user_user_permissions VALUES (1, 1, 1);
    INSERT INTO board_sitesetting VALUES
      (1, '<script>hidden from delegated staff</script>', '', '2025-01-01 00:00:00', 0, 1, '', 'Test Blog', '', '', '', '', '{}');
    INSERT INTO board_loginsetting VALUES
      (1, 'Welcome {name}', '/welcome', '', 1, 'captcha-site-key', '${encryptDjangoSecret('hs_test_secret_99', cipherKey)}', '2025-01-01 00:00:00');
    INSERT INTO board_socialauthprovider VALUES
      (1, 'google', 'google-id', '${encryptDjangoSecret('oauth_test_secret_17', cipherKey)}', 1),
      (2, 'github', '', '', 0);
    INSERT INTO board_integrationsetting VALUES
      (1, 0, '', '', '2025-01-01 00:00:00');
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
    const user = database.prepare('SELECT id, username FROM auth_user WHERE id = ?').get(id) as { id: number; username: string } | undefined;
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

  const landing = await app.inject({ url: '/admin-settings/', headers: headers(1) });
  assert.equal(landing.statusCode, 302);
  assert.equal(landing.headers.location, '/admin-settings/site-settings');
});

test('uploads and deletes validated brand SVG assets under the legacy public media paths', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#123456"/></svg>');
  const form = multipartPayload({ asset_type: 'logo', theme: 'default' }, {
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
  const setting = await prisma.$queryRaw<Array<{ logoSvg: string }>>`SELECT logo_svg AS logoSvg FROM board_sitesetting WHERE id = 1`;
  assert.equal(logoUrl, `/resources/media/${setting[0]?.logoSvg}`);
  assert.deepEqual(await readFile(join(mediaRoot, setting[0]?.logoSvg ?? '')), svg);
  const page = await app.inject({ url: '/admin-settings/site-settings', headers: headers(1) });
  assert.equal(page.statusCode, 200, page.body);
  assert.match(page.body, /multipart\/form-data/);
  assert.match(page.body, /brand-logo-default/);
  assert.match(page.body, /<h1[^>]*>블로그 꾸미기<\/h1>/);
  assert.doesNotMatch(page.body, />Site identity<|name="png_512"/);

  const deleted = await app.inject({
    method: 'DELETE', url: '/v1/site-settings/brand-assets', headers: jsonHeaders(1),
    payload: JSON.stringify({ asset_type: 'logo', theme: 'default' }),
  });
  assert.equal(body(deleted).status, 'DONE', deleted.body);
  assert.equal((body(deleted).body as Record<string, unknown>).logoSvgUrl, '/resources/logob.svg');
  assert.equal((await prisma.$queryRaw<Array<{ logoSvg: string }>>`SELECT logo_svg AS logoSvg FROM board_sitesetting WHERE id = 1`)[0]?.logoSvg, '');
  await assert.rejects(readFile(join(mediaRoot, setting[0]?.logoSvg ?? '')));
});

test('generates icon derivatives for a single SVG uploaded through blog customization', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32"><rect width="64" height="32" fill="#123456"/></svg>');
  const form = multipartPayload({ asset_type: 'icon', theme: 'default', csrfmiddlewaretoken: csrfToken }, {
    svg: { name: 'icon.svg', type: 'image/svg+xml', data: svg },
  });
  const uploaded = await app.inject({
    method: 'POST', url: '/admin-settings/brand-assets', headers: { ...headers(1), ...form.headers }, payload: form.payload,
  });
  assert.equal(uploaded.statusCode, 303, uploaded.body);
  assert.equal(uploaded.headers.location, '/admin-settings/site-settings?saved=1');
  const [row] = await prisma.$queryRaw<Array<{ iconManifest: string }>>`SELECT icon_manifest AS iconManifest FROM board_sitesetting WHERE id = 1`;
  const manifest = JSON.parse(row?.iconManifest ?? '{}') as { png: Record<string, string>; ico: string };
  assert.equal(Object.keys(manifest.png).length, 14);
  const icon = await sharp(join(mediaRoot, manifest.png['512'])).metadata();
  assert.equal(icon.width, 512);
  assert.equal(icon.height, 512);
  const ico = await readFile(join(mediaRoot, manifest.ico));
  assert.equal(ico.readUInt16LE(4), 2);

  const missingDerivatives = await app.inject({
    method: 'POST', url: '/v1/site-settings/brand-assets', headers: { ...headers(1), ...form.headers }, payload: form.payload,
  });
  assert.equal(body(missingDerivatives).errorCode, 'error:VA');
});

test('requires a default asset for dark variants and validates every default icon derivative', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#123456"/></svg>');
  const dark = multipartPayload({ asset_type: 'icon', theme: 'dark' }, {
    svg: { name: 'icon.svg', type: 'image/svg+xml', data: svg },
  });
  const rejected = await app.inject({
    method: 'POST', url: '/v1/site-settings/brand-assets', headers: { ...headers(1), ...dark.headers }, payload: dark.payload,
  });
  assert.equal(body(rejected).errorCode, 'error:VA');
  assert.match(String(body(rejected).errorMessage), /default asset first/);

  const fields = {
    asset_type: 'icon',
    theme: 'default',
    manifest: JSON.stringify({ version: 1, pngSizes: [16, 32, 57, 72, 76, 96, 114, 120, 128, 144, 152, 192, 256, 512], ico: true }),
  };
  const files: Record<string, { name: string; type: string; data: Buffer }> = {
    svg: { name: 'icon.svg', type: 'image/svg+xml', data: svg },
    favicon_ico: { name: 'favicon.ico', type: 'image/x-icon', data: await icoFile() },
  };
  for (const size of [16, 32, 57, 72, 76, 96, 114, 120, 128, 144, 152, 192, 256, 512]) {
    files[`png_${size}`] = { name: `logo${size}.png`, type: 'image/png', data: await pngFile(size) };
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
  const rows = await prisma.$queryRaw<Array<{ iconManifest: string; iconSvg: string }>>`
    SELECT icon_manifest AS iconManifest, icon_svg AS iconSvg FROM board_sitesetting WHERE id = 1
  `;
  const manifest = JSON.parse(rows[0]?.iconManifest ?? '{}') as { png: Record<string, string>; ico: string };
  assert.equal(Object.keys(manifest.png).length, 14);
  assert.ok((await readFile(join(mediaRoot, manifest.png['128'] ?? ''))).length > 0);
  assert.ok((await readFile(join(mediaRoot, manifest.ico))).length > 22);

  const invalidSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" onload="alert(1)"><rect/></svg>');
  const badForm = multipartPayload({ asset_type: 'logo', theme: 'default' }, {
    svg: { name: 'unsafe.svg', type: 'image/svg+xml', data: invalidSvg },
  });
  const badUpload = await app.inject({
    method: 'POST', url: '/v1/site-settings/brand-assets', headers: { ...headers(1), ...badForm.headers }, payload: badForm.payload,
  });
  assert.equal(body(badUpload).errorCode, 'error:VA');
  assert.equal((await prisma.$queryRaw<Array<{ logoSvg: string }>>`SELECT logo_svg AS logoSvg FROM board_sitesetting WHERE id = 1`)[0]?.logoSvg, '');
});

test('updates site identity and SEO fields, validates names, and requires CSRF', async () => {
  const update = await app.inject({
    method: 'PUT', url: '/v1/site-settings', headers: jsonHeaders(1),
    payload: JSON.stringify({ site_name: '  BLEX Journal  ', seo_enabled: false, aeo_enabled: true, robots_txt_extra_rules: 'User-agent: DemoBot\nDisallow: /drafts/' }),
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
    payload: JSON.stringify({ site_name: 'Must not save', header_script: '<script>no</script>' }),
  });
  assert.equal(body(deniedScript).errorCode, 'error:RJ');
  const invalid = await app.inject({
    method: 'PUT', url: '/v1/site-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ site_name: 'x'.repeat(81) }),
  });
  assert.equal(body(invalid).errorCode, 'error:VA');

  const noCsrf = await app.inject({
    method: 'PUT', url: '/v1/site-settings', headers: jsonHeaders(2, false),
    payload: JSON.stringify({ site_name: 'Blocked' }),
  });
  assert.equal(noCsrf.statusCode, 403);
  assert.equal(Number((await prisma.$queryRaw<Array<{ total: number | bigint }>>`SELECT COUNT(*) AS total FROM django_admin_log`)[0]?.total), 1);
});

test('renders progressive site and login pages with role checks and private headers', async () => {
  const sitePage = await app.inject({ url: '/admin-settings/site-settings', headers: headers(1) });
  assert.equal(sitePage.statusCode, 200, sitePage.body);
  assert.match(sitePage.headers['cache-control'] ?? '', /no-store/);
  assert.equal(sitePage.headers['x-robots-tag'], 'noindex, nofollow, noarchive');
  assert.match(sitePage.body, /name="site_name"/);
  assert.match(sitePage.body, /action="\/admin-settings\/site-settings"/);
  assert.doesNotMatch(sitePage.body, /hidden from delegated staff/);
  assert.equal((await app.inject({ url: '/admin-settings/login', headers: headers(1) })).statusCode, 404);

  const loginPage = await app.inject({ url: '/admin-settings/login', headers: headers(2) });
  assert.equal(loginPage.statusCode, 200, loginPage.body);
  assert.match(loginPage.body, /hCaptcha/);
  assert.match(loginPage.body, /placeholder="기존 키를 유지하려면 비워 두세요."/);
  assert.doesNotMatch(loginPage.body, /hs_test_secret_99|oauth_test_secret_17/);
  assert.match(loginPage.body, /name="provider_google_client_secret"/);
  assert.equal((await app.inject('/admin-settings/site-settings')).statusCode, 302);
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
      welcome_notification_message: 'Hello {name}',
      welcome_notification_url: '/hello',
      account_deletion_redirect_url: 'https://forms.example/exit',
      hcaptcha_enabled: true,
      hcaptcha_site_key: 'new-site-key',
      hcaptcha_secret_key: 'new-captcha-secret',
      social_auth_providers: [
        { key: 'google', is_enabled: true, client_id: 'google-new-id', client_secret: 'google-new-secret' },
        { key: 'github', is_enabled: true, client_id: 'github-id' },
      ],
    }),
  });
  assert.equal(body(update).status, 'DONE', update.body);
  assert.doesNotMatch(update.body, /new-captcha-secret|google-new-secret/);
  const settings = body(update).body as Record<string, unknown>;
  assert.equal(settings.welcomeNotificationMessage, 'Hello {name}');
  assert.equal(settings.hcaptchaSiteKey, 'new-site-key');
  assert.equal(settings.hcaptchaHasSecretKey, true);
  const row = await prisma.$queryRaw<Array<{ hcaptchaSecretKey: string }>>`SELECT hcaptcha_secret_key AS hcaptchaSecretKey FROM board_loginsetting WHERE id = 1`;
  assert.notEqual(row[0]?.hcaptchaSecretKey, 'new-captcha-secret');
  assert.equal(decryptDjangoSecret(row[0]?.hcaptchaSecretKey ?? '', cipherKey), 'new-captcha-secret');
  const social = await prisma.$queryRaw<Array<{ key: string; clientSecret: string; isEnabled: number }>>`SELECT key, client_secret AS clientSecret, is_enabled AS isEnabled FROM board_socialauthprovider ORDER BY id`;
  assert.equal(decryptDjangoSecret(social.find((item) => item.key === 'google')?.clientSecret ?? '', cipherKey), 'google-new-secret');
  assert.equal(Boolean(social.find((item) => item.key === 'github')?.isEnabled), true);
  assert.equal(decryptDjangoSecret(social.find((item) => item.key === 'google')?.clientSecret ?? '', cipherKey), 'google-new-secret');
  const audit = await prisma.$queryRaw<Array<{ changeMessage: string }>>`SELECT change_message AS changeMessage FROM django_admin_log ORDER BY id DESC LIMIT 1`;
  assert.equal(audit[0]?.changeMessage, 'Updated login and security settings');
  assert.doesNotMatch(audit[0]?.changeMessage ?? '', /secret/);
});

test('rejects unsafe login URLs and prevents invalid hCaptcha settings from partial writes', async () => {
  const unsafeUrl = await app.inject({
    method: 'PUT', url: '/v1/login-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ welcome_notification_message: 'Must not persist', welcome_notification_url: 'javascript:alert(1)' }),
  });
  assert.equal(body(unsafeUrl).errorCode, 'error:VA');
  const invalidCaptcha = await app.inject({
    method: 'PUT', url: '/v1/login-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ welcome_notification_message: 'Must not persist', hcaptcha_enabled: true, hcaptcha_site_key: '' }),
  });
  assert.equal(body(invalidCaptcha).errorCode, 'error:VA');
  const message = await prisma.$queryRaw<Array<{ welcomeMessage: string }>>`SELECT welcome_notification_message AS welcomeMessage FROM board_loginsetting WHERE id = 1`;
  assert.equal(message[0]?.welcomeMessage, 'Welcome {name}');
  assert.equal(Number((await prisma.$queryRaw<Array<{ total: number | bigint }>>`SELECT COUNT(*) AS total FROM django_admin_log`)[0]?.total), 0);
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

test('renders progressive staff invitation forms and refuses deletion after claim', async () => {
  const page = await app.inject({ url: '/admin-settings/users', headers: headers(1) });
  assert.equal(page.statusCode, 200, page.body);
  assert.match(page.body, /name="note"/);
  assert.match(page.body, /작가 초대 만들기/);

  const create = await app.inject({
    method: 'POST', url: '/admin-settings/users', headers: formHeaders(1),
    payload: new URLSearchParams([['csrfmiddlewaretoken', csrfToken], ['note', 'Release reviewers']]).toString(),
  });
  assert.equal(create.statusCode, 303, create.body);
  const [created] = await prisma.$queryRaw<Array<{ id: number; code: string }>>`SELECT id, code FROM board_authorinvite LIMIT 1`;
  assert.ok(created);
  assert.equal((await app.inject({ url: '/admin-settings/users', headers: headers(1) })).statusCode, 200);

  const database = new DatabaseSync(databasePath);
  database.prepare('UPDATE board_authorinvite SET is_active = 0, claimed_by_id = 3, claimed_date = ? WHERE id = ?').run('2025-03-01 00:00:00', created.id);
  database.close();
  const deletion = await app.inject({
    method: 'POST', url: `/admin-settings/users/${created.id}/delete`, headers: formHeaders(1),
    payload: new URLSearchParams([['csrfmiddlewaretoken', csrfToken]]).toString(),
  });
  assert.equal(deletion.statusCode, 200);
  assert.match(deletion.body, /사용된 초대 링크는 삭제할 수 없습니다/);
  assert.equal(Number((await prisma.$queryRaw<Array<{ total: number | bigint }>>`SELECT COUNT(*) AS total FROM board_authorinvite WHERE id = ${created.id}`)[0]?.total), 1);
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
      meta_description: 'Privacy details', is_published: true, show_in_footer: true, order: 3,
    }),
  });
  assert.equal(body(created).status, 'DONE', created.body);
  const page = body(created).body as Record<string, unknown>;
  assert.equal(page.slug, 'privacy');
  assert.equal(page.is_published, true);
  assert.equal(page.show_in_footer, true);
  assert.match(String(page.content), /onclick/, 'staff edit the stored page source as in 3.x');
  const pageId = Number(page.id);

  const duplicate = await app.inject({
    method: 'POST', url: '/v1/static-pages', headers: jsonHeaders(1),
    payload: JSON.stringify({ title: 'Duplicate', slug: 'privacy' }),
  });
  assert.equal(body(duplicate).errorCode, 'error:AE');
  const detail = await app.inject({ url: `/v1/static-pages/${pageId}`, headers: headers(1) });
  assert.equal((body(detail).body as Record<string, unknown>).meta_description, 'Privacy details');
  const update = await app.inject({
    method: 'PUT', url: `/v1/static-pages/${pageId}`, headers: jsonHeaders(1),
    payload: JSON.stringify({ is_published: false, content: '<h2>Updated</h2>' }),
  });
  assert.equal(body(update).status, 'DONE');
  assert.equal((body(update).body as Record<string, unknown>).is_published, false);
  const list = await app.inject({ url: '/v1/static-pages', headers: headers(1) });
  assert.equal(((body(list).body as { pages: Array<Record<string, unknown>> }).pages[0]?.slug), 'privacy');
  const deleted = await app.inject({ method: 'DELETE', url: `/v1/static-pages/${pageId}`, headers: headers(1) });
  assert.equal((body(deleted).body as Record<string, unknown>).message, 'Static page deleted.');

  const form = await app.inject({ url: '/admin-settings/static-pages/create', headers: headers(1) });
  assert.equal(form.statusCode, 200);
  assert.match(form.body, /name="content"/);
  const savedForm = await app.inject({
    method: 'POST', url: '/admin-settings/static-pages/create', headers: formHeaders(1),
    payload: new URLSearchParams([
      ['csrfmiddlewaretoken', csrfToken], ['title', 'About'], ['slug', 'about'], ['content', '<p>About us</p>'],
      ['meta_description', 'About'], ['is_published', 'true'], ['show_in_footer', 'true'], ['order', '1'],
    ]).toString(),
  });
  assert.equal(savedForm.statusCode, 303, savedForm.body);
  const pagesPage = await app.inject({ url: '/admin-settings/static-pages', headers: headers(1) });
  assert.equal(pagesPage.statusCode, 200);
  assert.match(pagesPage.body, /About/);
  assert.equal((await app.inject({ url: '/admin-settings/static-pages', headers: headers(3) })).statusCode, 404);
});

test('manages global notices and sanitized banners through APIs and staff forms', async () => {
  const noticeCreate = await app.inject({
    method: 'POST', url: '/v1/global-notices', headers: jsonHeaders(1),
    payload: JSON.stringify({ title: 'Maintenance', url: 'javascript:alert(1)', is_active: true }),
  });
  assert.equal(body(noticeCreate).status, 'DONE', noticeCreate.body);
  const notice = body(noticeCreate).body as Record<string, unknown>;
  const noticeId = Number(notice.id);
  assert.equal(notice.url, '');
  assert.equal(typeof notice.created_date, 'string');
  const noticeGet = await app.inject({ url: `/v1/global-notices/${noticeId}`, headers: headers(1) });
  assert.equal((body(noticeGet).body as Record<string, unknown>).title, 'Maintenance');
  const noticeUpdate = await app.inject({
    method: 'PUT', url: `/v1/global-notices/${noticeId}`, headers: jsonHeaders(1),
    payload: JSON.stringify({ url: '/status', is_active: false }),
  });
  assert.equal((body(noticeUpdate).body as Record<string, unknown>).url, '/status');
  assert.equal((body(noticeUpdate).body as Record<string, unknown>).is_active, false);
  assert.equal(((body(await app.inject({ url: '/v1/global-notices', headers: headers(1) })).body as { notices: unknown[] }).notices.length), 1);
  const noticePage = await app.inject({ url: '/admin-settings/global-notices', headers: headers(1) });
  assert.match(noticePage.body, /Maintenance/);
  const noticeForm = await app.inject({
    method: 'POST', url: `/admin-settings/global-notices/${noticeId}/delete`, headers: formHeaders(1),
    payload: new URLSearchParams([['csrfmiddlewaretoken', csrfToken]]).toString(),
  });
  assert.equal(noticeForm.statusCode, 303);

  const invalidPosition = await app.inject({
    method: 'POST', url: '/v1/global-banners', headers: jsonHeaders(1),
    payload: JSON.stringify({ title: 'Invalid', content_html: '<p>Banner</p>', banner_type: 'horizontal', position: 'left' }),
  });
  assert.equal(body(invalidPosition).errorCode, 'error:VA');
  const bannerCreate = await app.inject({
    method: 'POST', url: '/v1/global-banners', headers: jsonHeaders(1),
    payload: JSON.stringify({
      title: 'Welcome', content_html: '<p onclick="evil()">Hello</p><script>alert(1)</script>',
      banner_type: 'horizontal', position: 'top', order: 5,
    }),
  });
  assert.equal(body(bannerCreate).status, 'DONE', bannerCreate.body);
  const banner = body(bannerCreate).body as Record<string, unknown>;
  const bannerId = Number(banner.id);
  assert.equal(banner.created_by, 'site-editor');
  assert.match(String(banner.content_html), /onclick/, 'global banners keep their source as in 3.x');
  const bannerPage = await app.inject({ url: '/admin-settings/global-banners', headers: headers(1) });
  assert.match(bannerPage.body, /Welcome/);
  assert.doesNotMatch(bannerPage.body, /<p onclick|<script>alert/);
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
    payload: JSON.stringify({ position: 'bottom', content_html: '<p>Safe update</p>' }),
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
    payload: JSON.stringify({ title: 'Author notice', url: '/author-status', is_active: true }),
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
      title: 'Author banner', content_html: '<p onclick="bad()">Hello</p><script>bad()</script>',
      banner_type: 'horizontal', position: 'top', order: 4,
    }),
  });
  assert.equal(body(bannerCreate).status, 'DONE', bannerCreate.body);
  const banner = body(bannerCreate).body as Record<string, unknown>;
  const bannerId = Number(banner.id);
  assert.equal('created_by' in banner, false);
  assert.doesNotMatch(String(banner.content_html), /script|onclick|bad\(\)/i);
  const editorTwoBanner = await app.inject({
    method: 'POST', url: '/v1/banners', headers: jsonHeaders(2),
    payload: JSON.stringify({ title: 'Other author banner', content_html: '<p>Other</p>' }),
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

test('renders owner-only author notice and banner forms with reorder controls', async () => {
  const notice = await app.inject({
    method: 'POST', url: '/settings/notices', headers: formHeaders(1),
    payload: new URLSearchParams([
      ['csrfmiddlewaretoken', csrfToken], ['title', 'SSR author notice'], ['url', '/my-status'], ['is_active', 'true'],
    ]).toString(),
  });
  assert.equal(notice.statusCode, 303, notice.body);
  const noticePage = await app.inject({ url: '/settings/notices', headers: headers(1) });
  assert.equal(noticePage.statusCode, 200);
  assert.match(noticePage.body, /SSR author notice/);
  assert.match(noticePage.body, /action="\/settings\/notices\/\d+\/delete"/);
  assert.equal((await app.inject({ url: '/settings/notices', headers: headers(3) })).statusCode, 404);
  const privateNoticePage = await app.inject({ url: '/settings/notices', headers: headers(2) });
  assert.equal(privateNoticePage.statusCode, 200);
  assert.doesNotMatch(privateNoticePage.body, /SSR author notice/);

  const banner = await app.inject({
    method: 'POST', url: '/settings/banners', headers: formHeaders(1),
    payload: new URLSearchParams([
      ['csrfmiddlewaretoken', csrfToken], ['title', 'SSR author banner'],
      ['content_html', '<p onclick="bad()">Safe text</p><script>bad()</script>'],
      ['banner_type', 'horizontal'], ['position', 'top'], ['order', '7'], ['is_active', 'true'],
    ]).toString(),
  });
  assert.equal(banner.statusCode, 303, banner.body);
  const bannerRows = await prisma.$queryRaw<Array<{ id: number; contentHtml: string }>>`
    SELECT id, content_html AS contentHtml FROM board_sitebanner WHERE scope = 'user' AND user_id = 1
  `;
  const bannerId = Number(bannerRows[0]?.id);
  assert.doesNotMatch(String(bannerRows[0]?.contentHtml), /script|onclick|bad\(\)/i);
  const bannerPage = await app.inject({ url: '/settings/banners', headers: headers(1) });
  assert.equal(bannerPage.statusCode, 200);
  assert.match(bannerPage.body, /SSR author banner/);
  assert.match(bannerPage.body, /action="\/settings\/banners\/order"/);
  assert.match(bannerPage.body, new RegExp(`name="order_${bannerId}"`));
  assert.match(bannerPage.body, /배너 순서 저장/);
  assert.doesNotMatch(bannerPage.body, /onclick|bad\(\)/i);

  const reordered = await app.inject({
    method: 'POST', url: '/settings/banners/order', headers: formHeaders(1),
    payload: new URLSearchParams([['csrfmiddlewaretoken', csrfToken], [`order_${bannerId}`, '1']]).toString(),
  });
  assert.equal(reordered.statusCode, 303, reordered.body);
  const storedOrder = await prisma.$queryRaw<Array<{ order: number }>>`
    SELECT "order" AS "order" FROM board_sitebanner WHERE id = ${bannerId} AND scope = 'user' AND user_id = 1
  `;
  assert.equal(storedOrder[0]?.order, 1);
  const crossDelete = await app.inject({
    method: 'POST', url: `/settings/banners/${bannerId}/delete`, headers: formHeaders(2),
    payload: new URLSearchParams([['csrfmiddlewaretoken', csrfToken]]).toString(),
  });
  assert.equal(crossDelete.statusCode, 200);
  assert.match(crossDelete.body, /배너를 찾을 수 없습니다/);
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
    telegram_enabled: false,
    telegram_bot_username: '',
    telegram_has_bot_token: false,
    updated_date: '2025-01-01T00:00:00+00:00',
    telegram_connection: { state: 'disabled', detail: '' },
  });
  assert.equal(telegramCalls.length, 0);

  const page = await app.inject({ url: '/admin-settings/integrations', headers: headers(2) });
  assert.equal(page.statusCode, 200, page.body);
  assert.match(page.body, /name="telegram_bot_token"/);
  assert.match(page.body, /설정되지 않음/);
  assert.doesNotMatch(page.body, /telegram-token|botToken/);
  assert.equal((await app.inject({ url: '/admin-settings/integrations', headers: headers(1) })).statusCode, 404);
  const noCsrf = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2, false),
    payload: JSON.stringify({ telegram_enabled: true, telegram_bot_token: '123456:valid-token' }),
  });
  assert.equal(noCsrf.statusCode, 403);
  const noCsrfForm = await app.inject({
    method: 'POST', url: '/admin-settings/integrations',
    headers: { ...headers(2, false), 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams([['telegram_enabled', 'true'], ['telegram_bot_token', '123456:blocked-token']]).toString(),
  });
  assert.equal(noCsrfForm.statusCode, 403);

  configureTelegram({ getMe: { ok: true, result: { username: 'page_bot' } }, setWebhook: { ok: true } });
  const savedForm = await app.inject({
    method: 'POST', url: '/admin-settings/integrations', headers: formHeaders(2),
    payload: new URLSearchParams([
      ['csrfmiddlewaretoken', csrfToken], ['telegram_enabled', 'true'],
      ['telegram_bot_username', ''], ['telegram_bot_token', '123456:page-token'],
    ]).toString(),
  });
  assert.equal(savedForm.statusCode, 303, savedForm.body);
  const updatedPage = await app.inject({ url: '/admin-settings/integrations', headers: headers(2) });
  assert.match(updatedPage.body, /page_bot/);
  assert.match(updatedPage.body, /기존 토큰을 유지하려면 비워 두세요./);
  assert.doesNotMatch(updatedPage.body, /page-token/);
});

test('validates and encrypts Telegram tokens, confirms bots, and registers HMAC webhooks after saving', async () => {
  const missingToken = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ telegram_enabled: true }),
  });
  assert.equal(body(missingToken).errorCode, 'error:VA');
  const malformed = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ telegram_enabled: true, telegram_bot_token: '123/../../getMe' }),
  });
  assert.equal(body(malformed).errorCode, 'error:VA');
  assert.equal(telegramCalls.length, 0);

  configureTelegram({ getMe: { ok: false, error_code: 401, description: 'Unauthorized' } });
  const invalidTelegramToken = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ telegram_enabled: true, telegram_bot_token: '123456:invalid-token' }),
  });
  assert.equal(body(invalidTelegramToken).errorCode, 'error:VA');
  assert.deepEqual(telegramCalls.map((call) => new URL(call.url).pathname.split('/').at(-1)), ['getMe']);
  const [unchanged] = await prisma.$queryRaw<Array<{ token: string; enabled: number }>>`
    SELECT telegram_bot_token AS token, telegram_enabled AS enabled FROM board_integrationsetting WHERE id = 1
  `;
  assert.equal(unchanged?.token, '');
  assert.equal(Number(unchanged?.enabled), 0);
  assert.equal(Number((await prisma.$queryRaw<Array<{ total: number | bigint }>>`SELECT COUNT(*) AS total FROM django_admin_log`)[0]?.total), 0);

  configureTelegram({
    getMe: { ok: true, result: { username: 'verified_bot' } },
    setWebhook: { ok: true, result: true },
  });
  const update = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ telegram_enabled: true, telegram_bot_username: '@old_name', telegram_bot_token: '123456:synthetic-token' }),
  });
  assert.equal(body(update).status, 'DONE', update.body);
  const settings = body(update).body as Record<string, unknown>;
  assert.equal(settings.telegram_enabled, true);
  assert.equal(settings.telegram_bot_username, 'verified_bot');
  assert.equal(settings.telegram_has_bot_token, true);
  assert.deepEqual(settings.telegram_connection, { state: 'connected', detail: '' });
  assert.doesNotMatch(update.body, /synthetic-token|telegramToken|telegram_bot_token/);
  assert.deepEqual(telegramCalls.map((call) => new URL(call.url).pathname.split('/').at(-1)), ['getMe', 'setWebhook']);
  const webhookCall = telegramCalls[1];
  assert.equal(webhookCall?.init?.method, 'POST');
  const webhookBody = JSON.parse(String(webhookCall?.init?.body)) as Record<string, unknown>;
  assert.equal(webhookBody.url, 'https://blog.example/v1/telegram/webHook');
  assert.equal(webhookBody.secret_token, createHmac('sha256', secretKey).update('telegram-webhook:123456:synthetic-token').digest('hex'));
  assert.deepEqual(webhookBody.allowed_updates, ['message']);

  const [saved] = await prisma.$queryRaw<Array<{ token: string; username: string; enabled: number }>>`
    SELECT telegram_bot_token AS token, telegram_bot_username AS username, telegram_enabled AS enabled
    FROM board_integrationsetting WHERE id = 1
  `;
  assert.notEqual(saved?.token, '123456:synthetic-token');
  assert.equal(decryptDjangoSecret(saved?.token ?? '', cipherKey), '123456:synthetic-token');
  assert.equal(saved?.username, 'verified_bot');
  assert.equal(Number(saved?.enabled), 1);
  const audit = await prisma.$queryRaw<Array<{ changeMessage: string }>>`SELECT change_message AS changeMessage FROM django_admin_log ORDER BY id DESC LIMIT 1`;
  assert.equal(audit[0]?.changeMessage, 'Updated notification integration settings');
  assert.doesNotMatch(audit[0]?.changeMessage ?? '', /synthetic-token/);
});

test('reports Telegram webhook states, saves unreachable settings, and preserves a disabled secret', async () => {
  configureTelegram();
  telegramUnreachable = true;
  const unreachable = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ telegram_enabled: true, telegram_bot_username: 'offline_bot', telegram_bot_token: '123456:offline-token' }),
  });
  assert.equal(body(unreachable).status, 'DONE', unreachable.body);
  assert.deepEqual((body(unreachable).body as Record<string, unknown>).telegram_connection, { state: 'unreachable', detail: '' });
  assert.equal(telegramCalls.length, 1);
  const [savedToken] = await prisma.$queryRaw<Array<{ token: string }>>`
    SELECT telegram_bot_token AS token FROM board_integrationsetting WHERE id = 1
  `;
  assert.equal(decryptDjangoSecret(savedToken?.token ?? '', cipherKey), '123456:offline-token');

  telegramUnreachable = false;
  configureTelegram({
    getWebhookInfo: { ok: true, result: {
      url: 'https://blog.example/v1/telegram/webHook', pending_update_count: 4, last_error_message: 'Synthetic delivery failure',
    } },
  });
  const deliveryFailed = await app.inject({ url: '/v1/integration-settings', headers: headers(2) });
  assert.deepEqual((body(deliveryFailed).body as Record<string, unknown>).telegram_connection, {
    state: 'delivery_failed', detail: 'Synthetic delivery failure',
  });

  const disable = await app.inject({
    method: 'PUT', url: '/v1/integration-settings', headers: jsonHeaders(2),
    payload: JSON.stringify({ telegram_enabled: false }),
  });
  assert.equal(body(disable).status, 'DONE');
  assert.deepEqual((body(disable).body as Record<string, unknown>).telegram_connection, { state: 'disabled', detail: '' });
  assert.equal((body(disable).body as Record<string, unknown>).telegram_has_bot_token, true);
  const [stillSaved] = await prisma.$queryRaw<Array<{ token: string; enabled: number }>>`
    SELECT telegram_bot_token AS token, telegram_enabled AS enabled FROM board_integrationsetting WHERE id = 1
  `;
  assert.equal(decryptDjangoSecret(stillSaved?.token ?? '', cipherKey), '123456:offline-token');
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
    INSERT INTO board_tag (id, value) VALUES (1, 'kept'), (2, 'unused-before-preview');
    INSERT INTO board_post_tags (post_id, tag_id) VALUES (1, 1);
  `);
  database.prepare(`
    INSERT INTO auth_user (id, username, first_name, email, is_active, is_staff, is_superuser, date_joined, last_login)
    VALUES (?, ?, ?, ?, 1, 1, 1, '2025-01-01 00:00:00', NULL)
  `).run(6, 'second-superuser', 'Second', 'second@example.test');
  database.close();
  const preview = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: jsonHeaders(2),
    payload: JSON.stringify({ dry_run: true }),
  });
  assert.equal(body(preview).status, 'DONE', preview.body);
  const previewBody = body(preview).body as Record<string, unknown>;
  assert.equal(previewBody.dryRun, true);
  assert.equal(previewBody.cleanedCount, 1);
  const confirmation = String(previewBody.confirmationToken);
  assert.ok(confirmation.length > 32);
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM board_tag WHERE value = 'unused-before-preview'`)[0]?.count), 1);

  const wrongSession = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: {
      ...jsonHeaders(2), cookie: `csrftoken=${csrfToken}; blexsessionid=${'z'.repeat(43)}`,
    },
    payload: JSON.stringify({ dry_run: false, confirmation_token: confirmation }),
  });
  assert.equal(body(wrongSession).errorCode, 'error:RJ');
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM board_tag WHERE value = 'unused-before-preview'`)[0]?.count), 1);

  const otherUser = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: jsonHeaders(6),
    payload: JSON.stringify({ dry_run: false, confirmation_token: confirmation }),
  });
  assert.equal(body(otherUser).errorCode, 'error:RJ');
  const noCsrf = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: jsonHeaders(2, false),
    payload: JSON.stringify({ dry_run: true }),
  });
  assert.equal(noCsrf.statusCode, 403);

  const execute = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: jsonHeaders(2),
    payload: JSON.stringify({ dry_run: false, confirmation_token: confirmation }),
  });
  assert.equal(body(execute).status, 'DONE', execute.body);
  assert.equal((body(execute).body as Record<string, unknown>).dryRun, false);
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM board_tag WHERE value = 'unused-before-preview'`)[0]?.count), 0);
  const reuse = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-tags', headers: jsonHeaders(2),
    payload: JSON.stringify({ dry_run: false, confirmation_token: confirmation }),
  });
  assert.equal(body(reuse).errorCode, 'error:RJ');
  const audit = await prisma.$queryRaw<Array<{ message: string }>>`SELECT change_message AS message FROM django_admin_log ORDER BY id DESC LIMIT 1`;
  assert.equal(audit[0]?.message, 'Executed unused tag cleanup');
});

test('binds session cleanup confirmation to its scope and deletes only the previewed session set', async () => {
  const now = BigInt(Date.now());
  const database = new DatabaseSync(databasePath);
  database.prepare('INSERT INTO blex_session (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run('expired', 3, now - 1_000n);
  database.prepare('INSERT INTO blex_session (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run('active', 3, now + 60_000n);
  database.prepare('INSERT INTO django_session (session_key, session_data, expire_date) VALUES (?, ?, ?)').run('legacy-expired', 'x', '2020-01-01 00:00:00.000000');
  database.prepare('INSERT INTO django_session (session_key, session_data, expire_date) VALUES (?, ?, ?)').run('legacy-active', 'x', '2999-01-01 00:00:00.000000');
  database.close();

  const preview = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-sessions', headers: jsonHeaders(2),
    payload: JSON.stringify({ dry_run: true, clean_all: false }),
  });
  const previewBody = body(preview).body as Record<string, unknown>;
  assert.equal(previewBody.expiredSessions, 2);
  const mismatch = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-sessions', headers: jsonHeaders(2),
    payload: JSON.stringify({ dry_run: false, clean_all: true, confirmation_token: previewBody.confirmationToken }),
  });
  assert.equal(body(mismatch).errorCode, 'error:RJ');
  const execute = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-sessions', headers: jsonHeaders(2),
    payload: JSON.stringify({ dry_run: false, clean_all: false, confirmation_token: previewBody.confirmationToken }),
  });
  assert.equal(body(execute).status, 'DONE', execute.body);
  assert.equal((body(execute).body as Record<string, unknown>).cleanedCount, 2);
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM blex_session WHERE token_hash = 'active'`)[0]?.count), 1);
  const legacy = await prisma.$queryRaw<Array<{ key: string }>>`SELECT session_key AS key FROM django_session WHERE session_key LIKE 'legacy-%'`;
  assert.deepEqual(legacy.map((row) => row.key), ['legacy-active']);
});

test('previews and confirms expired log cleanup, with a progressive superuser utility page', async () => {
  const page = await app.inject({ url: '/admin-settings/utilities', headers: headers(2) });
  assert.equal(page.statusCode, 200, page.body);
  assert.match(page.body, /미사용 태그/);
  assert.match(page.body, /만료된 세션/);
  assert.match(page.body, /보존 기간이 지난 로그/);
  assert.equal((await app.inject({ url: '/admin-settings/utilities', headers: headers(1) })).statusCode, 404);

  const database = new DatabaseSync(databasePath);
  database.prepare(`
    INSERT INTO django_admin_log (object_id, object_repr, action_flag, change_message, content_type_id, user_id, action_time)
    VALUES (NULL, 'old audit', 2, 'old', NULL, 2, '2020-01-01 00:00:00')
  `).run();
  database.prepare('INSERT INTO board_developerrequestlog (id, created_date) VALUES (1, ?)').run('2020-01-01 00:00:00');
  database.close();

  const preview = await app.inject({
    method: 'POST', url: '/admin-settings/utilities', headers: formHeaders(2),
    payload: new URLSearchParams([['csrfmiddlewaretoken', csrfToken], ['action', 'clean_logs'], ['dry_run', 'true']]).toString(),
  });
  assert.equal(preview.statusCode, 200, preview.body);
  assert.match(preview.body, /정리 미리보기/);
  assert.doesNotMatch(preview.body, /name="confirmationToken"/);
  const confirmation = preview.body.match(/name="confirmation_token" value="([^"]+)"/)?.[1];
  assert.ok(confirmation);
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM django_admin_log WHERE change_message = 'old'`)[0]?.count), 1);

  const execute = await app.inject({
    method: 'POST', url: '/admin-settings/utilities', headers: formHeaders(2),
    payload: new URLSearchParams([
      ['csrfmiddlewaretoken', csrfToken], ['action', 'clean_logs'], ['dry_run', 'false'], ['confirmation_token', confirmation],
    ]).toString(),
  });
  assert.equal(execute.statusCode, 200, execute.body);
  assert.match(execute.body, /정리 결과/);
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM django_admin_log WHERE change_message = 'old'`)[0]?.count), 0);
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM board_developerrequestlog`)[0]?.count), 0);
  const noCsrf = await app.inject({
    method: 'POST', url: '/admin-settings/utilities',
    headers: { ...headers(2, false), 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams([['action', 'clean_tags'], ['dry_run', 'true']]).toString(),
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
    UPDATE board_post SET image = '/resources/media/images/title/deleted-post-title.png' WHERE id = 3;
    UPDATE board_profile SET avatar = '/resources/media/images/avatar/profile-avatar.png' WHERE user_id = 1;
    INSERT INTO board_postcontent (id, post_id, content_html)
      VALUES (1, 1, '<img src="/resources/media/images/content/current-content.png">');
    INSERT INTO board_edithistory (id, post_id, content)
      VALUES (1, 3, '![](/resources/media/images/content/archived-history.png)');
    INSERT INTO board_sitenotice (id, scope, user_id, title, is_active, "order", created_date, updated_date, url)
      VALUES (1, 'global', NULL, 'Inactive notice', 0, 0, '2025-01-01', '2025-01-01', '/resources/media/images/content/notice-content.png');
    INSERT INTO board_sitebanner (id, scope, user_id, title, is_active, "order", created_date, updated_date, content_html)
      VALUES (1, 'global', NULL, 'Active banner', 1, 0, '2025-01-01', '2025-01-01',
        '<img src="/resources/media/images/content/banner-content.png"><img src="/resources/media/images/title/banner-title.png"><img src="/resources/media/images/avatar/banner-avatar.png">');
    INSERT INTO board_sitebanner (id, scope, user_id, title, is_active, "order", created_date, updated_date, content_html)
      VALUES (2, 'global', NULL, 'Inactive banner', 0, 1, '2025-01-01', '2025-01-01',
        '<img src="/resources/media/images/content/inactive-banner-content.png">');
    INSERT INTO WorkLogEntry (id, text) VALUES (1, '![](/resources/media/images/content/worklog-content.png)');
    INSERT INTO board_imagecache (id, key, path) VALUES
      (1, 'unused-image-cache', 'images/content/unused-content.png'),
      (2, 'current-image-cache', 'images/content/current-content.png');
  `);
  database.close();

  const preview = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-images', headers: jsonHeaders(2),
    payload: JSON.stringify({ dry_run: true, target: 'all', remove_duplicates: true }),
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
    payload: JSON.stringify({ dry_run: false, target: 'all', remove_duplicates: true, confirmation_token: confirmation, preview_hash: previewHash }),
  });
  assert.equal(body(stale).errorCode, 'error:RJ');
  assert.equal(await readFile(join(mediaRoot, 'images/content/unused-content.png'), 'utf8'), 'images/content/unused-content.png');

  const freshPreview = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-images', headers: jsonHeaders(2),
    payload: JSON.stringify({ dry_run: true, target: 'all', remove_duplicates: true }),
  });
  const freshBody = body(freshPreview).body as Record<string, unknown>;
  const execute = await app.inject({
    method: 'POST', url: '/v1/utilities/clean-images', headers: jsonHeaders(2),
    payload: JSON.stringify({
      dry_run: false, target: 'all', remove_duplicates: true,
      confirmation_token: freshBody.confirmationToken,
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
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM board_imagecache`)[0]?.count), 1);
  assert.equal(Number((await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM board_imagecache WHERE path = 'images/content/current-content.png'`)[0]?.count), 1);
  const audit = await prisma.$queryRaw<Array<{ message: string }>>`SELECT change_message AS message FROM django_admin_log ORDER BY id DESC LIMIT 1`;
  assert.equal(audit[0]?.message, 'Executed unused image cleanup');
});

test('lists users with filters and safely updates only reader/editor roles', async () => {
  const denied = await app.inject({ url: '/v1/admin/users', headers: headers(3) });
  assert.equal(body(denied).errorCode, 'error:RJ');
  const list = await app.inject({ url: '/v1/admin/users?ordering=-post_count&page=1&page_size=2', headers: headers(1) });
  assert.equal(body(list).status, 'DONE');
  const result = body(list).body as {
    users: Array<Record<string, unknown>>;
    pagination: Record<string, unknown>;
    stats: Record<string, unknown>;
  };
  assert.equal(result.users[0]?.username, 'site-editor');
  assert.equal(result.users[0]?.post_count, 2);
  assert.equal(result.pagination.page_size, 2);
  assert.equal(result.pagination.total_pages, 3);
  assert.equal(result.stats.total, 5);
  assert.equal(result.stats.editors, 3);
  assert.equal(result.stats.readers, 1);
  assert.equal(result.stats.admins, 3);

  const readers = await app.inject({ url: '/v1/admin/users?role=reader&page=50&page_size=200', headers: headers(2) });
  const readerList = (body(readers).body as { users: Array<Record<string, unknown>>; pagination: Record<string, unknown> });
  assert.equal(readerList.users.length, 1);
  assert.equal(readerList.users[0]?.username, 'reader');
  assert.equal(readerList.pagination.page, 1);
  assert.equal(readerList.pagination.page_size, 100);

  const rolePage = await app.inject({ url: '/admin-settings/users', headers: headers(1) });
  assert.match(rolePage.body, /회원 권한/);
  assert.match(rolePage.body, /운영 권한은 별도로 관리합니다/);
  assert.match(rolePage.body, /name="role"/);
  const formRole = await app.inject({
    method: 'POST', url: '/admin-settings/users/3/role', headers: formHeaders(1),
    payload: new URLSearchParams([['csrfmiddlewaretoken', csrfToken], ['role', 'EDITOR']]).toString(),
  });
  assert.equal(formRole.statusCode, 303, formRole.body);
  const [profile] = await prisma.$queryRaw<Array<{ role: string }>>`SELECT role FROM board_profile WHERE user_id = 3`;
  assert.equal(profile?.role, 'EDITOR');
  const [config] = await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM board_config WHERE user_id = 3`;
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
    SELECT is_staff AS isStaff, is_superuser AS isSuperuser FROM auth_user WHERE id = 3
  `;
  assert.equal(Number(staff?.isStaff), 0);
  assert.equal(Number(staff?.isSuperuser), 0);
  const demote = await app.inject({
    method: 'PATCH', url: '/v1/admin/users/3/role', headers: jsonHeaders(1), payload: JSON.stringify({ role: 'READER' }),
  });
  assert.equal(body(demote).status, 'DONE', demote.body);
  const [scheduledPost] = await prisma.$queryRaw<Array<{ publishedDate: string | null }>>`
    SELECT CAST(published_date AS TEXT) AS publishedDate FROM board_post WHERE id = 4
  `;
  assert.equal(scheduledPost?.publishedDate, null);
  const profilelessPromotion = await app.inject({
    method: 'PATCH', url: '/v1/admin/users/5/role', headers: jsonHeaders(1), payload: JSON.stringify({ role: 'EDITOR' }),
  });
  assert.equal(body(profilelessPromotion).status, 'DONE', profilelessPromotion.body);
  const [newProfile] = await prisma.$queryRaw<Array<{ role: string }>>`SELECT role FROM board_profile WHERE user_id = 5`;
  assert.equal(newProfile?.role, 'EDITOR');
  const [newConfig] = await prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM board_config WHERE user_id = 5`;
  assert.equal(Number(newConfig?.count), 1);
});
