import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { DatabaseSetupError, portMappingProblem, prepareDatabase } from '../src/startup/prepare-database.js';
import { insertRow } from './fixtures/migrated-database.js';

const legacySchema = new URL('../../prisma/legacy/django-3.14.sql', import.meta.url);

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), 'blex-startup-'));
  const paths = {
    root,
    databasePath: join(root, 'data', 'db.sqlite3'),
    mediaRoot: join(root, 'data', 'media'),
    legacyRoot: join(root, 'legacy'),
    oldComposeDatabase: join(root, 'old-compose.sqlite3'),
  };
  await mkdir(paths.mediaRoot, { recursive: true });
  await mkdir(join(paths.legacyRoot, 'resources', 'media', 'images'), { recursive: true });
  return { ...paths, options: { ...paths, log: () => {} }, cleanup: () => rm(root, { recursive: true, force: true }) };
}

async function createLegacyDatabase(path: string, version = '0070_author_subscription') {
  const db = new DatabaseSync(path);
  db.exec(await readFile(legacySchema, 'utf8'));
  db.prepare('INSERT INTO django_migrations (app, name, applied) VALUES (?, ?, ?)').run('board', version, '2026-01-01 00:00:00');
  return db;
}

const fileHash = async (path: string) => createHash('sha256').update(await readFile(path)).digest('hex');
const count = (db: DatabaseSync, table: string) => Number((db.prepare(`SELECT COUNT(*) AS total FROM "${table}"`).get() as { total: number }).total);

test('stops a Compose file that still maps the 3.x container port', async () => {
  assert.equal(portMappingProblem(undefined, '8040'), null);
  assert.equal(portMappingProblem('127.0.0.1:20002:8040', '8040'), null);
  assert.equal(portMappingProblem('8080:8040/tcp', '8040'), null);
  assert.equal(portMappingProblem('9000:9000', '9000'), null);
  assert.match(portMappingProblem('127.0.0.1:20002:80', '8040') ?? '', /Change it to 127\.0\.0\.1:20002:8040/);

  const space = await workspace();
  try {
    await assert.rejects(prepareDatabase({ ...space.options, portMapping: '20002:80' }), DatabaseSetupError);
    assert.equal(existsSync(space.databasePath), false);
  } finally {
    await space.cleanup();
  }
});

test('creates a new database and leaves it in place on the next start', async () => {
  const space = await workspace();
  try {
    await prepareDatabase(space.options);
    const first = new DatabaseSync(space.databasePath);
    insertRow(first, 'auth_user', { id: 1, username: 'kept' });
    first.close();

    await prepareDatabase(space.options);
    const second = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.equal(count(second, 'auth_user'), 1);
    assert.equal(count(second, '_prisma_migrations'), 1);
    second.close();
  } finally {
    await space.cleanup();
  }
});

test('imports a 3.14 installation once and leaves the original unchanged', async () => {
  const space = await workspace();
  const source = join(space.legacyRoot, 'db.sqlite3');
  try {
    const legacy = await createLegacyDatabase(source);
    insertRow(legacy, 'auth_user', { id: 7, username: 'writer', password: 'pbkdf2_sha256$fixture$hash', is_active: 1 });
    insertRow(legacy, 'board_post', { id: 5, author_id: 7, url: 'scheduled', title: 'Scheduled', published_date: '2099-01-01 00:00:00' });
    insertRow(legacy, 'board_post', { id: 6, author_id: 7, url: 'published', title: 'Published', published_date: '2020-01-01 00:00:00.123456' });
    insertRow(legacy, 'board_comment', { id: 1, post_id: 6, author_id: 7, text_md: 'Hello', text_html: '<p>Hello</p>' });
    insertRow(legacy, 'django_session', { session_key: 'discarded', session_data: 'x', expire_date: '2099-01-01' });
    insertRow(legacy, 'board_worklog', { id: 3, owner_id: 7, title: 'Imported log', created_at: '2024-02-03 04:05:06.789000' });
    insertRow(legacy, 'board_worklogentry', { id: 4, log_id: 3, title: 'Imported entry', created_at: '2024-02-03 04:05:07+09:00' });
    insertRow(legacy, 'board_worklogshare', { id: 5, log_id: 3, token: 'a'.repeat(32), headline: 'Shared', created_at: '2024-02-03 04:05:08' });
    insertRow(legacy, 'board_worklogshare_entries', { worklogshare_id: 5, worklogentry_id: 4 });
    insertRow(legacy, 'board_form', { id: 2, user_id: 7, title: 'Template', content: 'Body', is_public: 1, created_date: '2024-03-01 01:02:03.456789', updated_date: '2024-03-02 01:02:03' });
    insertRow(legacy, 'board_staticpage', { id: 3, author_id: 7, slug: 'about', title: 'About', content: '<p>About</p>', meta_description: 'Summary', is_published: 1, show_in_footer: 1, order: 4, created_date: '2024-03-03 00:00:00', updated_date: '2024-03-04 00:00:00' });
    insertRow(legacy, 'board_sitenotice', { id: 4, user_id: 7, scope: 'user', title: 'Notice', url: '/notice', is_active: 0, order: 2, created_date: '2024-03-05 00:00:00', updated_date: '2024-03-06 00:00:00' });
    insertRow(legacy, 'board_sitebanner', { id: 5, scope: 'global', banner_type: 'sidebar', position: 'right', title: 'Banner', content_html: '<script>trusted()</script>', is_active: 1, order: 3, created_date: '2024-03-07 00:00:00', updated_date: '2024-03-08 00:00:00' });
    insertRow(legacy, 'django_content_type', { id: 30, app_label: 'board', model: 'sitesetting' });
    insertRow(legacy, 'django_site', { id: 1, name: 'site', domain: 'feeds.example.test' });
    insertRow(legacy, 'board_oauthauthorization', { state_hash: 'discarded', expires_at: '2099-01-01' });
    insertRow(legacy, 'board_sitesetting', { id: 1, site_name: 'Imported', header_script: '<script>kept()</script>', seo_enabled: 0, aeo_enabled: 1, robots_txt_extra_rules: 'Disallow: /x', logo_svg: 'brand/logo.svg', icon_manifest: '{"ico":"brand/favicon.ico"}', updated_date: '2024-04-01 00:00:00' });
    insertRow(legacy, 'board_sitesetting', { id: 2, site_name: 'Ignored second row', updated_date: '2024-04-02 00:00:00' });
    insertRow(legacy, 'board_loginsetting', { id: 1, welcome_notification_message: 'Hi', welcome_notification_url: '/hi', hcaptcha_enabled: 1, hcaptcha_site_key: 'site', hcaptcha_secret_key: 'stored-ciphertext', updated_date: '2024-04-03 00:00:00' });
    insertRow(legacy, 'board_loginsetting', { id: 2, welcome_notification_message: 'Unread row', updated_date: '2024-04-03 00:00:00' });
    insertRow(legacy, 'board_integrationsetting', { id: 1, telegram_enabled: 1, telegram_bot_username: 'bot', telegram_bot_token: 'stored-token', updated_date: '2024-04-04 00:00:00' });
    insertRow(legacy, 'django_admin_log', { id: 8, object_id: '1', object_repr: 'Site settings', action_flag: 2, change_message: 'Changed', content_type_id: 30, user_id: 7, action_time: '2024-04-05 00:00:00' });
    insertRow(legacy, 'django_admin_log', { id: 9, object_repr: 'No type', action_flag: 1, change_message: '', user_id: 7, action_time: '2024-04-06 00:00:00' });
    insertRow(legacy, 'board_utilitycleanupconfirmation', { id: 3, token_hash: 'hash', action: 'clean_tags', session_fingerprint: 'print', expires_at: '2024-04-07 00:00:00', consumed_at: '2024-04-07 00:01:00', created_date: '2024-04-06 23:55:00', user_id: 7 });
    insertRow(legacy, 'board_imagecache', { id: 6, key: 'image-key', path: 'images/content/a.png', size: 12, user_id: 7 });
    legacy.exec(`UPDATE sqlite_sequence SET seq = 70 WHERE name = 'django_admin_log'`);
    legacy.exec(`UPDATE sqlite_sequence SET seq = 40 WHERE name = 'board_post'`);
    legacy.exec(`UPDATE sqlite_sequence SET seq = 90 WHERE name = 'board_sitebanner'`);
    legacy.close();
    await writeFile(join(space.legacyRoot, 'resources', 'media', 'images', 'cover.png'), 'image');
    const before = await fileHash(source);

    await prepareDatabase(space.options);

    assert.equal(await fileHash(source), before);
    assert.equal(existsSync(`${space.databasePath}.importing`), false);
    assert.equal(await readFile(join(space.mediaRoot, 'images', 'cover.png'), 'utf8'), 'image');
    const imported = new DatabaseSync(space.databasePath);
    assert.equal(count(imported, 'auth_user'), 1);
    assert.equal(count(imported, 'board_post'), 2);
    assert.equal(count(imported, 'board_comment'), 1);
    for (const table of ['django_migrations', 'django_session', 'django_site', 'board_oauthauthorization']) {
      assert.equal(imported.prepare('SELECT 1 FROM sqlite_schema WHERE name = ?').get(table), undefined, table);
    }
    assert.equal((imported.prepare('SELECT password FROM auth_user WHERE id = 7').get() as { password: string }).password, 'pbkdf2_sha256$fixture$hash');
    assert.deepEqual({ ...imported.prepare('SELECT post_id, publish_at FROM blex_scheduled_publication').get() }, { post_id: 5, publish_at: '2099-01-01 00:00:00' });
    assert.equal(Number((imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'board_post'`).get() as { seq: number }).seq), 40);
    assert.equal(count(imported, '_prisma_migrations'), 1);
    assert.equal(Number((imported.prepare('SELECT createdAt FROM WorkLog WHERE id = 3').get() as { createdAt: number }).createdAt), Date.UTC(2024, 1, 3, 4, 5, 6, 789));
    assert.equal(Number((imported.prepare('SELECT createdAt FROM WorkLogEntry WHERE id = 4').get() as { createdAt: number }).createdAt), Date.UTC(2024, 1, 2, 19, 5, 7));
    assert.deepEqual({ ...imported.prepare('SELECT A, B FROM _WorkLogEntryToWorkLogShare').get() }, { A: 4, B: 5 });
    assert.deepEqual({ ...imported.prepare('SELECT userId, title, content, isPublic, createdAt, updatedAt FROM FormTemplate WHERE id = 2').get() }, {
      userId: 7, title: 'Template', content: 'Body', isPublic: 1, createdAt: Date.UTC(2024, 2, 1, 1, 2, 3, 456), updatedAt: Date.UTC(2024, 2, 2, 1, 2, 3),
    });
    assert.deepEqual({ ...imported.prepare('SELECT authorId, slug, description, isPublished, showInFooter, "order", updatedAt FROM StaticPage WHERE id = 3').get() }, {
      authorId: 7, slug: 'about', description: 'Summary', isPublished: 1, showInFooter: 1, order: 4, updatedAt: Date.UTC(2024, 2, 4),
    });
    assert.deepEqual({ ...imported.prepare('SELECT userId, scope, url, isActive, "order", createdAt FROM SiteNotice WHERE id = 4').get() }, {
      userId: 7, scope: 'user', url: '/notice', isActive: 0, order: 2, createdAt: Date.UTC(2024, 2, 5),
    });
    assert.deepEqual({ ...imported.prepare('SELECT userId, scope, type, position, contentHtml, "order" FROM SiteBanner WHERE id = 5').get() }, {
      userId: null, scope: 'global', type: 'sidebar', position: 'right', contentHtml: '<script>trusted()</script>', order: 3,
    });
    assert.equal(Number((imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'SiteBanner'`).get() as { seq: number }).seq), 90);
    assert.equal(count(imported, 'SiteSetting'), 1);
    assert.deepEqual({ ...imported.prepare('SELECT id, siteName, domain, headerScript, seoEnabled, aeoEnabled, robotsTxtExtraRules, logoSvg, iconManifest, updatedAt FROM SiteSetting').get() }, {
      id: 1, siteName: 'Imported', domain: 'feeds.example.test', headerScript: '<script>kept()</script>', seoEnabled: 0, aeoEnabled: 1,
      robotsTxtExtraRules: 'Disallow: /x', logoSvg: 'brand/logo.svg', iconManifest: '{"ico":"brand/favicon.ico"}', updatedAt: Date.UTC(2024, 3, 1),
    });
    assert.equal(count(imported, 'LoginSetting'), 1);
    assert.deepEqual({ ...imported.prepare('SELECT id, welcomeNotificationMessage, welcomeNotificationUrl, hcaptchaEnabled, hcaptchaSecretKey FROM LoginSetting').get() }, {
      id: 1, welcomeNotificationMessage: 'Hi', welcomeNotificationUrl: '/hi', hcaptchaEnabled: 1, hcaptchaSecretKey: 'stored-ciphertext',
    });
    assert.deepEqual({ ...imported.prepare('SELECT id, telegramEnabled, telegramBotUsername, telegramBotToken FROM IntegrationSetting').get() }, {
      id: 1, telegramEnabled: 1, telegramBotUsername: 'bot', telegramBotToken: 'stored-token',
    });
    assert.deepEqual({ ...imported.prepare('SELECT userId, target, objectId, objectName, action, message, createdAt FROM AdminLog WHERE id = 8').get() }, {
      userId: 7, target: 'sitesetting', objectId: '1', objectName: 'Site settings', action: 2, message: 'Changed', createdAt: Date.UTC(2024, 3, 5),
    });
    assert.equal((imported.prepare('SELECT target FROM AdminLog WHERE id = 9').get() as { target: string }).target, '');
    assert.equal(Number((imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'AdminLog'`).get() as { seq: number }).seq), 70);
    assert.deepEqual({ ...imported.prepare('SELECT userId, tokenHash, expiresAt, consumedAt, createdAt FROM CleanupConfirmation WHERE id = 3').get() }, {
      userId: 7, tokenHash: 'hash', expiresAt: Date.UTC(2024, 3, 7), consumedAt: Date.UTC(2024, 3, 7, 0, 1), createdAt: Date.UTC(2024, 3, 6, 23, 55),
    });
    assert.deepEqual({ ...imported.prepare('SELECT key, path, size, userId FROM UploadedImage WHERE id = 6').get() }, { key: 'image-key', path: 'images/content/a.png', size: 12, userId: 7 });
    imported.close();

    const changed = new DatabaseSync(source);
    insertRow(changed, 'auth_user', { id: 8, username: 'after-import' });
    changed.close();
    await prepareDatabase(space.options);
    const again = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.equal(count(again, 'auth_user'), 1);
    again.close();
  } finally {
    await space.cleanup();
  }
});

test('imports 3.14 notifications, webhook owners, and Telegram connection states', async () => {
  const space = await workspace();
  const source = join(space.legacyRoot, 'db.sqlite3');
  try {
    const legacy = await createLegacyDatabase(source);
    for (const id of [7, 8, 9, 10]) insertRow(legacy, 'auth_user', { id, username: `user-${id}`, is_active: 1 });
    // Profile ids deliberately collide with other accounts' user ids.
    insertRow(legacy, 'board_profile', { id: 70, user_id: 7, role: 'EDITOR' });
    insertRow(legacy, 'board_profile', { id: 7, user_id: 8, role: 'EDITOR' });
    insertRow(legacy, 'board_notify', { id: 11, key: 'object', user_id: 7, url: '/a', content: 'A', has_read: 1, message_key: 'post.liked', message_params: '{"actor":"a","post_title":"T"}', created_date: '2024-05-01 01:02:03.456789', updated_date: '2024-05-02 00:00:00' });
    insertRow(legacy, 'board_notify', { id: 12, key: 'array', user_id: 7, has_read: 0, message_params: '[1]' });
    insertRow(legacy, 'board_notify', { id: 13, key: 'number', user_id: 7, has_read: 0, message_params: '5' });
    insertRow(legacy, 'board_webhooksubscription', { id: 21, scope: 'user', author_id: 70, webhook_url: 'https://hooks.example.com/seven', name: 'Seven', is_active: 1, failure_count: 2, last_success_date: '2024-05-03 00:00:00', created_date: '2024-05-04 00:00:00' });
    insertRow(legacy, 'board_webhooksubscription', { id: 22, scope: 'user', author_id: 7, webhook_url: 'https://hooks.example.com/eight', is_active: 0, created_date: '2024-05-04 00:00:00' });
    insertRow(legacy, 'board_webhooksubscription', { id: 23, scope: 'global', webhook_url: 'https://hooks.example.com/all', is_active: 1, created_date: '2024-05-04 00:00:00' });
    insertRow(legacy, 'board_telegramsync', { id: 31, user_id: 7, tid: 'cipher-seven', auth_token: '', auth_token_exp: '2020-01-01 00:00:00', created_date: '2024-05-05 00:00:00' });
    insertRow(legacy, 'board_telegramsync', { id: 32, user_id: 8, tid: '', auth_token: 'pend01', auth_token_exp: '2099-01-01 00:00:00', created_date: '2024-05-05 00:00:00' });
    insertRow(legacy, 'board_telegramsync', { id: 33, user_id: 9, tid: '', auth_token: 'late01', auth_token_exp: '2000-01-01 00:00:00', created_date: '2024-05-05 00:00:00' });
    insertRow(legacy, 'board_telegramsync', { id: 34, user_id: 10, tid: 'cipher-ten', auth_token: 'next01', auth_token_exp: '2099-01-02 00:00:00', created_date: '2024-05-05 00:00:00' });
    legacy.exec(`UPDATE sqlite_sequence SET seq = 99 WHERE name = 'board_notify'`);
    legacy.exec(`UPDATE sqlite_sequence SET seq = 77 WHERE name = 'board_webhooksubscription'`);
    legacy.close();

    await prepareDatabase(space.options);

    const imported = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.deepEqual({ ...imported.prepare('SELECT userId, key, url, content, messageKey, messageParams, isRead, createdAt, updatedAt FROM Notification WHERE id = 11').get() }, {
      userId: 7, key: 'object', url: '/a', content: 'A', messageKey: 'post.liked', messageParams: '{"actor":"a","post_title":"T"}', isRead: 1,
      createdAt: Date.UTC(2024, 4, 1, 1, 2, 3, 456), updatedAt: Date.UTC(2024, 4, 2),
    });
    assert.deepEqual(imported.prepare('SELECT messageParams FROM Notification WHERE id IN (12, 13) ORDER BY id').all().map((row) => row.messageParams), ['{}', '{}']);
    assert.deepEqual(imported.prepare('SELECT id, ownerId, scope, url, isActive FROM WebhookChannel ORDER BY id').all().map((row) => ({ ...row })), [
      { id: 21, ownerId: 7, scope: 'user', url: 'https://hooks.example.com/seven', isActive: 1 },
      { id: 22, ownerId: 8, scope: 'user', url: 'https://hooks.example.com/eight', isActive: 0 },
      { id: 23, ownerId: null, scope: 'global', url: 'https://hooks.example.com/all', isActive: 1 },
    ]);
    assert.deepEqual({ ...imported.prepare('SELECT failureCount, lastSuccessAt, createdAt FROM WebhookChannel WHERE id = 21').get() }, {
      failureCount: 2, lastSuccessAt: Date.UTC(2024, 4, 3), createdAt: Date.UTC(2024, 4, 4),
    });
    assert.deepEqual(imported.prepare('SELECT userId, telegramId, authToken, authTokenExpiresAt FROM TelegramConnection ORDER BY userId').all().map((row) => ({ ...row })), [
      { userId: 7, telegramId: 'cipher-seven', authToken: '', authTokenExpiresAt: null },
      { userId: 8, telegramId: '', authToken: 'pend01', authTokenExpiresAt: Date.UTC(2099, 0, 1) },
      { userId: 9, telegramId: '', authToken: 'late01', authTokenExpiresAt: Date.UTC(2000, 0, 1) },
      { userId: 10, telegramId: 'cipher-ten', authToken: 'next01', authTokenExpiresAt: Date.UTC(2099, 0, 2) },
    ]);
    assert.equal(Number((imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'Notification'`).get() as { seq: number }).seq), 99);
    assert.equal(Number((imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'WebhookChannel'`).get() as { seq: number }).seq), 77);
    assert.notEqual(Number((imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'TelegramConnection'`).get() as { seq: number } | undefined)?.seq ?? 0), 34);
    imported.close();

    const client = new PrismaClient({ datasourceUrl: `file:${space.databasePath}` });
    try {
      const rows = await client.notification.findMany({ orderBy: { id: 'asc' }, select: { messageParams: true } });
      assert.deepEqual(rows.map((row) => row.messageParams), [{ actor: 'a', post_title: 'T' }, {}, {}]);
    } finally {
      await client.$disconnect();
    }
  } finally {
    await space.cleanup();
  }
});

test('keeps what public pages showed when a 3.14 database has no site settings row 1', async () => {
  const space = await workspace();
  try {
    const legacy = await createLegacyDatabase(join(space.legacyRoot, 'db.sqlite3'));
    insertRow(legacy, 'django_site', { id: 1, name: 'site', domain: 'feeds.example.test' });
    insertRow(legacy, 'board_sitesetting', { id: 4, site_name: 'Brand row', logo_svg: 'brand/logo.svg', seo_enabled: 0, aeo_enabled: 1, robots_txt_extra_rules: 'Disallow: /x', header_script: '<script>unread()</script>', icon_manifest: '[]', updated_date: '2024-04-01 00:00:00' });
    insertRow(legacy, 'board_integrationsetting', { id: 3, telegram_enabled: 1, updated_date: '2024-04-01 00:00:00' });
    legacy.close();
    await prepareDatabase(space.options);
    const imported = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.deepEqual({ ...imported.prepare('SELECT id, siteName, domain, logoSvg, seoEnabled, aeoEnabled, robotsTxtExtraRules, headerScript, iconManifest FROM SiteSetting').get() }, {
      id: 1, siteName: 'Brand row', domain: 'feeds.example.test', logoSvg: 'brand/logo.svg', seoEnabled: 0, aeoEnabled: 0, robotsTxtExtraRules: '', headerScript: '', iconManifest: null,
    });
    assert.equal(count(imported, 'IntegrationSetting'), 0);
    imported.close();
  } finally {
    await space.cleanup();
  }
});

test('keeps the RSS host when 3.14 has no site settings row at all', async () => {
  const space = await workspace();
  try {
    const legacy = await createLegacyDatabase(join(space.legacyRoot, 'db.sqlite3'));
    insertRow(legacy, 'django_site', { id: 1, name: 'site', domain: 'feeds.example.test' });
    legacy.close();
    await prepareDatabase(space.options);
    const imported = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.deepEqual({ ...imported.prepare('SELECT id, siteName, domain, seoEnabled, aeoEnabled FROM SiteSetting').get() }, {
      id: 1, siteName: 'BLEX', domain: 'feeds.example.test', seoEnabled: 1, aeoEnabled: 0,
    });
    imported.close();
  } finally {
    await space.cleanup();
  }
});

test('asks older 3.x installs to reach 3.14 first and creates nothing', async () => {
  const space = await workspace();
  try {
    (await createLegacyDatabase(join(space.legacyRoot, 'db.sqlite3'), '0069_older')).close();
    await assert.rejects(prepareDatabase(space.options), (error: Error) => error instanceof DatabaseSetupError && /to 3\.14 first/.test(error.message));
    assert.equal(existsSync(space.databasePath), false);
    assert.equal(existsSync(`${space.databasePath}.importing`), false);
  } finally {
    await space.cleanup();
  }
});

test('stops without changing data for a 3.x Compose file or an unrecognized database', async () => {
  const space = await workspace();
  try {
    await writeFile(space.oldComposeDatabase, 'old');
    await assert.rejects(prepareDatabase(space.options), /3\.x Compose setup.*not changed/s);
    await rm(space.oldComposeDatabase);

    (await createLegacyDatabase(space.databasePath)).close();
    const legacy = await fileHash(space.databasePath);
    await assert.rejects(prepareDatabase(space.options), /BLEX 3\.x database.*read-only at \/legacy/s);
    assert.equal(await fileHash(space.databasePath), legacy);
    await rm(space.databasePath);

    const prerelease = new DatabaseSync(space.databasePath);
    prerelease.exec(`CREATE TABLE _prisma_migrations (migration_name TEXT); INSERT INTO _prisma_migrations VALUES ('0000_django_3x');`);
    prerelease.close();
    await assert.rejects(prepareDatabase(space.options), /pre-release BLEX 4/);
    await rm(space.databasePath);

    await writeFile(space.databasePath, 'not a database');
    await assert.rejects(prepareDatabase(space.options), /not a BLEX database/);
  } finally {
    await space.cleanup();
  }
});

test('names the row when a 3.14 site content value cannot be imported', async () => {
  const cases: Array<[string, Record<string, string | number>, RegExp]> = [
    ['board_sitebanner', { scope: 'global', banner_type: 'floating', position: 'top' }, /board_sitebanner\.banner_type in row 9 is "floating".*horizontal, sidebar/],
    ['board_sitebanner', { scope: 'global', banner_type: 'horizontal', position: 'center' }, /board_sitebanner\.position in row 9 is "center".*top, bottom, left, right/],
    ['board_sitenotice', { scope: 'team' }, /board_sitenotice\.scope in row 9 is "team".*user, global/],
    ['board_sitenotice', { scope: 'global', order: 3_000_000_000 }, /board_sitenotice\.order in row 9 is "3000000000".*32-bit/],
  ];
  for (const [table, values, message] of cases) {
    const space = await workspace();
    try {
      const legacy = await createLegacyDatabase(join(space.legacyRoot, 'db.sqlite3'));
      insertRow(legacy, table, { id: 9, created_date: '2024-01-01 00:00:00', updated_date: '2024-01-01 00:00:00', ...values });
      legacy.close();
      await assert.rejects(prepareDatabase(space.options), (error: Error) => {
        assert.ok(error instanceof DatabaseSetupError);
        assert.match(error.message, message);
        assert.match(error.message, /The original was not changed/);
        return true;
      });
      assert.equal(existsSync(space.databasePath), false);
      assert.equal(existsSync(`${space.databasePath}.importing`), false);
    } finally {
      await space.cleanup();
    }
  }
});

test('leaves no database behind when the import fails', async () => {
  const space = await workspace();
  const media = join(space.legacyRoot, 'resources', 'media');
  try {
    (await createLegacyDatabase(join(space.legacyRoot, 'db.sqlite3'))).close();
    await rm(media, { recursive: true });
    await writeFile(media, 'not a directory');
    await assert.rejects(prepareDatabase(space.options), /Could not import the BLEX 3\.14 data.*not changed/s);
    assert.equal(existsSync(space.databasePath), false);
    assert.equal(existsSync(`${space.databasePath}.importing`), false);
  } finally {
    await space.cleanup();
  }
});
