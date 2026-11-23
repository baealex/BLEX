import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { Secret, TOTP } from 'otpauth';
import { buildApp } from '../src/app.js';
import { DatabaseSetupError, portMappingProblem, prepareDatabase } from '../src/startup/prepare-database.js';
import { encryptSecret } from '../src/features/auth/encrypted-secret.js';
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
  db.prepare('INSERT INTO django_migrations (app, name, applied) VALUES (?, ?, ?)').run(
    'board',
    version,
    '2026-01-01 00:00:00',
  );
  return db;
}

const fileHash = async (path: string) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
const count = (db: DatabaseSync, table: string) =>
  Number((db.prepare(`SELECT COUNT(*) AS total FROM "${table}"`).get() as { total: number }).total);

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
    insertRow(first, 'User', { id: 1, username: 'kept' });
    first.close();

    await prepareDatabase(space.options);
    const second = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.equal(count(second, 'User'), 1);
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
    insertRow(legacy, 'board_post', {
      id: 5,
      author_id: 7,
      url: 'scheduled',
      title: 'Scheduled',
      published_date: '2099-01-01 00:00:00',
    });
    insertRow(legacy, 'board_post', {
      id: 6,
      author_id: 7,
      url: 'published',
      title: 'Published',
      published_date: '2020-01-01 00:00:00.123456',
    });
    insertRow(legacy, 'board_comment', {
      id: 1,
      post_id: 6,
      author_id: 7,
      text_md: 'Hello',
      text_html: '<p>Hello</p>',
    });
    insertRow(legacy, 'django_session', { session_key: 'discarded', session_data: 'x', expire_date: '2099-01-01' });
    insertRow(legacy, 'board_worklog', {
      id: 3,
      owner_id: 7,
      title: 'Imported log',
      created_at: '2024-02-03 04:05:06.789000',
    });
    insertRow(legacy, 'board_worklogentry', {
      id: 4,
      log_id: 3,
      title: 'Imported entry',
      created_at: '2024-02-03 04:05:07+09:00',
    });
    insertRow(legacy, 'board_worklogshare', {
      id: 5,
      log_id: 3,
      token: 'a'.repeat(32),
      headline: 'Shared',
      created_at: '2024-02-03 04:05:08',
    });
    insertRow(legacy, 'board_worklogshare_entries', { worklogshare_id: 5, worklogentry_id: 4 });
    insertRow(legacy, 'board_form', {
      id: 2,
      user_id: 7,
      title: 'Template',
      content: 'Body',
      is_public: 1,
      created_date: '2024-03-01 01:02:03.456789',
      updated_date: '2024-03-02 01:02:03',
    });
    insertRow(legacy, 'board_staticpage', {
      id: 3,
      author_id: 7,
      slug: 'about',
      title: 'About',
      content: '<p>About</p>',
      meta_description: 'Summary',
      is_published: 1,
      show_in_footer: 1,
      order: 4,
      created_date: '2024-03-03 00:00:00',
      updated_date: '2024-03-04 00:00:00',
    });
    insertRow(legacy, 'board_sitenotice', {
      id: 4,
      user_id: 7,
      scope: 'user',
      title: 'Notice',
      url: '/notice',
      is_active: 0,
      order: 2,
      created_date: '2024-03-05 00:00:00',
      updated_date: '2024-03-06 00:00:00',
    });
    insertRow(legacy, 'board_sitebanner', {
      id: 5,
      scope: 'global',
      banner_type: 'sidebar',
      position: 'right',
      title: 'Banner',
      content_html: '<script>trusted()</script>',
      is_active: 1,
      order: 3,
      created_date: '2024-03-07 00:00:00',
      updated_date: '2024-03-08 00:00:00',
    });
    insertRow(legacy, 'django_content_type', { id: 30, app_label: 'board', model: 'sitesetting' });
    insertRow(legacy, 'django_site', { id: 1, name: 'site', domain: 'feeds.example.test' });
    insertRow(legacy, 'board_oauthauthorization', { state_hash: 'discarded', expires_at: '2099-01-01' });
    insertRow(legacy, 'board_sitesetting', {
      id: 1,
      site_name: 'Imported',
      header_script: '<script>kept()</script>',
      seo_enabled: 0,
      aeo_enabled: 1,
      robots_txt_extra_rules: 'Disallow: /x',
      logo_svg: 'brand/logo.svg',
      icon_manifest: '{"ico":"brand/favicon.ico"}',
      updated_date: '2024-04-01 00:00:00',
    });
    insertRow(legacy, 'board_sitesetting', {
      id: 2,
      site_name: 'Ignored second row',
      updated_date: '2024-04-02 00:00:00',
    });
    insertRow(legacy, 'board_loginsetting', {
      id: 1,
      welcome_notification_message: 'Hi',
      welcome_notification_url: '/hi',
      hcaptcha_enabled: 1,
      hcaptcha_site_key: 'site',
      hcaptcha_secret_key: 'stored-ciphertext',
      updated_date: '2024-04-03 00:00:00',
    });
    insertRow(legacy, 'board_loginsetting', {
      id: 2,
      welcome_notification_message: 'Unread row',
      updated_date: '2024-04-03 00:00:00',
    });
    insertRow(legacy, 'board_integrationsetting', {
      id: 1,
      telegram_enabled: 1,
      telegram_bot_username: 'bot',
      telegram_bot_token: 'stored-token',
      updated_date: '2024-04-04 00:00:00',
    });
    insertRow(legacy, 'django_admin_log', {
      id: 8,
      object_id: '1',
      object_repr: 'Site settings',
      action_flag: 2,
      change_message: 'Changed',
      content_type_id: 30,
      user_id: 7,
      action_time: '2024-04-05 00:00:00',
    });
    insertRow(legacy, 'django_admin_log', {
      id: 9,
      object_repr: 'No type',
      action_flag: 1,
      change_message: '',
      user_id: 7,
      action_time: '2024-04-06 00:00:00',
    });
    insertRow(legacy, 'board_utilitycleanupconfirmation', {
      id: 3,
      token_hash: 'hash',
      action: 'clean_tags',
      session_fingerprint: 'print',
      expires_at: '2024-04-07 00:00:00',
      consumed_at: '2024-04-07 00:01:00',
      created_date: '2024-04-06 23:55:00',
      user_id: 7,
    });
    insertRow(legacy, 'board_imagecache', {
      id: 6,
      key: 'image-key',
      path: 'images/content/a.png',
      size: 12,
      user_id: 7,
    });
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
    assert.equal(count(imported, 'User'), 1);
    assert.equal(count(imported, 'Post'), 2);
    assert.equal(count(imported, 'Comment'), 1);
    for (const table of ['django_migrations', 'django_session', 'django_site', 'board_oauthauthorization']) {
      assert.equal(imported.prepare('SELECT 1 FROM sqlite_schema WHERE name = ?').get(table), undefined, table);
    }
    assert.equal(
      (imported.prepare('SELECT passwordHash FROM User WHERE id = 7').get() as { passwordHash: string }).passwordHash,
      'pbkdf2_sha256$fixture$hash',
    );
    assert.deepEqual(
      { ...imported.prepare('SELECT postId, publishAt FROM "ScheduledPublication"').get() },
      { postId: 5, publishAt: Date.UTC(2099, 0, 1) },
    );
    assert.equal(
      Number((imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'Post'`).get() as { seq: number }).seq),
      40,
    );
    assert.equal(count(imported, '_prisma_migrations'), 1);
    assert.equal(
      Number((imported.prepare('SELECT createdAt FROM WorkLog WHERE id = 3').get() as { createdAt: number }).createdAt),
      Date.UTC(2024, 1, 3, 4, 5, 6, 789),
    );
    assert.equal(
      Number(
        (imported.prepare('SELECT createdAt FROM WorkLogEntry WHERE id = 4').get() as { createdAt: number }).createdAt,
      ),
      Date.UTC(2024, 1, 2, 19, 5, 7),
    );
    assert.deepEqual({ ...imported.prepare('SELECT A, B FROM _WorkLogEntryToWorkLogShare').get() }, { A: 4, B: 5 });
    assert.deepEqual(
      {
        ...imported
          .prepare('SELECT userId, title, content, isPublic, createdAt, updatedAt FROM FormTemplate WHERE id = 2')
          .get(),
      },
      {
        userId: 7,
        title: 'Template',
        content: 'Body',
        isPublic: 1,
        createdAt: Date.UTC(2024, 2, 1, 1, 2, 3, 456),
        updatedAt: Date.UTC(2024, 2, 2, 1, 2, 3),
      },
    );
    assert.deepEqual(
      {
        ...imported
          .prepare(
            'SELECT authorId, slug, description, isPublished, showInFooter, "order", updatedAt FROM StaticPage WHERE id = 3',
          )
          .get(),
      },
      {
        authorId: 7,
        slug: 'about',
        description: 'Summary',
        isPublished: 1,
        showInFooter: 1,
        order: 4,
        updatedAt: Date.UTC(2024, 2, 4),
      },
    );
    assert.deepEqual(
      {
        ...imported
          .prepare('SELECT userId, scope, url, isActive, "order", createdAt FROM SiteNotice WHERE id = 4')
          .get(),
      },
      {
        userId: 7,
        scope: 'user',
        url: '/notice',
        isActive: 0,
        order: 2,
        createdAt: Date.UTC(2024, 2, 5),
      },
    );
    assert.deepEqual(
      {
        ...imported
          .prepare('SELECT userId, scope, type, position, contentHtml, "order" FROM SiteBanner WHERE id = 5')
          .get(),
      },
      {
        userId: null,
        scope: 'global',
        type: 'sidebar',
        position: 'right',
        contentHtml: '<script>trusted()</script>',
        order: 3,
      },
    );
    assert.equal(
      Number(
        (imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'SiteBanner'`).get() as { seq: number }).seq,
      ),
      90,
    );
    assert.equal(count(imported, 'SiteSetting'), 1);
    assert.deepEqual(
      {
        ...imported
          .prepare(
            'SELECT id, siteName, domain, headerScript, seoEnabled, aeoEnabled, robotsTxtExtraRules, logoSvg, iconManifest, updatedAt FROM SiteSetting',
          )
          .get(),
      },
      {
        id: 1,
        siteName: 'Imported',
        domain: 'feeds.example.test',
        headerScript: '<script>kept()</script>',
        seoEnabled: 0,
        aeoEnabled: 1,
        robotsTxtExtraRules: 'Disallow: /x',
        logoSvg: 'brand/logo.svg',
        iconManifest: '{"ico":"brand/favicon.ico"}',
        updatedAt: Date.UTC(2024, 3, 1),
      },
    );
    assert.equal(count(imported, 'LoginSetting'), 1);
    assert.deepEqual(
      {
        ...imported
          .prepare(
            'SELECT id, welcomeNotificationMessage, welcomeNotificationUrl, hcaptchaEnabled, hcaptchaSecretKey FROM LoginSetting',
          )
          .get(),
      },
      {
        id: 1,
        welcomeNotificationMessage: 'Hi',
        welcomeNotificationUrl: '/hi',
        hcaptchaEnabled: 1,
        hcaptchaSecretKey: 'stored-ciphertext',
      },
    );
    assert.deepEqual(
      {
        ...imported
          .prepare('SELECT id, telegramEnabled, telegramBotUsername, telegramBotToken FROM IntegrationSetting')
          .get(),
      },
      {
        id: 1,
        telegramEnabled: 1,
        telegramBotUsername: 'bot',
        telegramBotToken: 'stored-token',
      },
    );
    assert.deepEqual(
      {
        ...imported
          .prepare('SELECT userId, target, objectId, objectName, action, message, createdAt FROM AdminLog WHERE id = 8')
          .get(),
      },
      {
        userId: 7,
        target: 'sitesetting',
        objectId: '1',
        objectName: 'Site settings',
        action: 2,
        message: 'Changed',
        createdAt: Date.UTC(2024, 3, 5),
      },
    );
    assert.equal((imported.prepare('SELECT target FROM AdminLog WHERE id = 9').get() as { target: string }).target, '');
    assert.equal(
      Number(
        (imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'AdminLog'`).get() as { seq: number }).seq,
      ),
      70,
    );
    assert.deepEqual(
      {
        ...imported
          .prepare('SELECT userId, tokenHash, expiresAt, consumedAt, createdAt FROM CleanupConfirmation WHERE id = 3')
          .get(),
      },
      {
        userId: 7,
        tokenHash: 'hash',
        expiresAt: Date.UTC(2024, 3, 7),
        consumedAt: Date.UTC(2024, 3, 7, 0, 1),
        createdAt: Date.UTC(2024, 3, 6, 23, 55),
      },
    );
    assert.deepEqual(
      { ...imported.prepare('SELECT key, path, size, userId FROM UploadedImage WHERE id = 6').get() },
      { key: 'image-key', path: 'images/content/a.png', size: 12, userId: 7 },
    );
    imported.close();

    const changed = new DatabaseSync(source);
    insertRow(changed, 'auth_user', { id: 8, username: 'after-import' });
    changed.close();
    await prepareDatabase(space.options);
    const again = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.equal(count(again, 'User'), 1);
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
    insertRow(legacy, 'board_notify', {
      id: 11,
      key: 'object',
      user_id: 7,
      url: '/a',
      content: 'A',
      has_read: 1,
      message_key: 'post.liked',
      message_params: '{"actor":"a","post_title":"T"}',
      created_date: '2024-05-01 01:02:03.456789',
      updated_date: '2024-05-02 00:00:00',
    });
    insertRow(legacy, 'board_notify', { id: 12, key: 'array', user_id: 7, has_read: 0, message_params: '[1]' });
    insertRow(legacy, 'board_notify', { id: 13, key: 'number', user_id: 7, has_read: 0, message_params: '5' });
    insertRow(legacy, 'board_webhooksubscription', {
      id: 21,
      scope: 'user',
      author_id: 70,
      webhook_url: 'https://hooks.example.com/seven',
      name: 'Seven',
      is_active: 1,
      failure_count: 2,
      last_success_date: '2024-05-03 00:00:00',
      created_date: '2024-05-04 00:00:00',
    });
    insertRow(legacy, 'board_webhooksubscription', {
      id: 22,
      scope: 'user',
      author_id: 7,
      webhook_url: 'https://hooks.example.com/eight',
      is_active: 0,
      created_date: '2024-05-04 00:00:00',
    });
    insertRow(legacy, 'board_webhooksubscription', {
      id: 23,
      scope: 'global',
      webhook_url: 'https://hooks.example.com/all',
      is_active: 1,
      created_date: '2024-05-04 00:00:00',
    });
    insertRow(legacy, 'board_telegramsync', {
      id: 31,
      user_id: 7,
      tid: 'cipher-seven',
      auth_token: '',
      auth_token_exp: '2020-01-01 00:00:00',
      created_date: '2024-05-05 00:00:00',
    });
    insertRow(legacy, 'board_telegramsync', {
      id: 32,
      user_id: 8,
      tid: '',
      auth_token: 'pend01',
      auth_token_exp: '2099-01-01 00:00:00',
      created_date: '2024-05-05 00:00:00',
    });
    insertRow(legacy, 'board_telegramsync', {
      id: 33,
      user_id: 9,
      tid: '',
      auth_token: 'late01',
      auth_token_exp: '2000-01-01 00:00:00',
      created_date: '2024-05-05 00:00:00',
    });
    insertRow(legacy, 'board_telegramsync', {
      id: 34,
      user_id: 10,
      tid: 'cipher-ten',
      auth_token: 'next01',
      auth_token_exp: '2099-01-02 00:00:00',
      created_date: '2024-05-05 00:00:00',
    });
    legacy.exec(`UPDATE sqlite_sequence SET seq = 99 WHERE name = 'board_notify'`);
    legacy.exec(`UPDATE sqlite_sequence SET seq = 77 WHERE name = 'board_webhooksubscription'`);
    legacy.close();

    await prepareDatabase(space.options);

    const imported = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.deepEqual(
      {
        ...imported
          .prepare(
            'SELECT userId, key, url, content, messageKey, messageParams, isRead, createdAt, updatedAt FROM Notification WHERE id = 11',
          )
          .get(),
      },
      {
        userId: 7,
        key: 'object',
        url: '/a',
        content: 'A',
        messageKey: 'post.liked',
        messageParams: '{"actor":"a","post_title":"T"}',
        isRead: 1,
        createdAt: Date.UTC(2024, 4, 1, 1, 2, 3, 456),
        updatedAt: Date.UTC(2024, 4, 2),
      },
    );
    assert.deepEqual(
      imported
        .prepare('SELECT messageParams FROM Notification WHERE id IN (12, 13) ORDER BY id')
        .all()
        .map((row) => row.messageParams),
      ['{}', '{}'],
    );
    assert.deepEqual(
      imported
        .prepare('SELECT id, ownerId, scope, url, isActive FROM WebhookChannel ORDER BY id')
        .all()
        .map((row) => ({ ...row })),
      [
        { id: 21, ownerId: 7, scope: 'user', url: 'https://hooks.example.com/seven', isActive: 1 },
        { id: 22, ownerId: 8, scope: 'user', url: 'https://hooks.example.com/eight', isActive: 0 },
        { id: 23, ownerId: null, scope: 'global', url: 'https://hooks.example.com/all', isActive: 1 },
      ],
    );
    assert.deepEqual(
      { ...imported.prepare('SELECT failureCount, lastSuccessAt, createdAt FROM WebhookChannel WHERE id = 21').get() },
      {
        failureCount: 2,
        lastSuccessAt: Date.UTC(2024, 4, 3),
        createdAt: Date.UTC(2024, 4, 4),
      },
    );
    assert.deepEqual(
      imported
        .prepare('SELECT userId, telegramId, authToken, authTokenExpiresAt FROM TelegramConnection ORDER BY userId')
        .all()
        .map((row) => ({ ...row })),
      [
        { userId: 7, telegramId: 'cipher-seven', authToken: '', authTokenExpiresAt: null },
        { userId: 8, telegramId: '', authToken: 'pend01', authTokenExpiresAt: Date.UTC(2099, 0, 1) },
        { userId: 9, telegramId: '', authToken: 'late01', authTokenExpiresAt: Date.UTC(2000, 0, 1) },
        { userId: 10, telegramId: 'cipher-ten', authToken: 'next01', authTokenExpiresAt: Date.UTC(2099, 0, 2) },
      ],
    );
    assert.equal(
      Number(
        (imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'Notification'`).get() as { seq: number }).seq,
      ),
      99,
    );
    assert.equal(
      Number(
        (imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'WebhookChannel'`).get() as { seq: number })
          .seq,
      ),
      77,
    );
    assert.notEqual(
      Number(
        (
          imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'TelegramConnection'`).get() as
            | { seq: number }
            | undefined
        )?.seq ?? 0,
      ),
      34,
    );
    imported.close();

    const client = new PrismaClient({ datasourceUrl: `file:${space.databasePath}` });
    try {
      const rows = await client.notification.findMany({ orderBy: { id: 'asc' }, select: { messageParams: true } });
      assert.deepEqual(
        rows.map((row) => row.messageParams),
        [{ actor: 'a', post_title: 'T' }, {}, {}],
      );
    } finally {
      await client.$disconnect();
    }
  } finally {
    await space.cleanup();
  }
});

test('imports 3.14 comments, series, and subscriptions with their counters and reply cycles', async () => {
  const space = await workspace();
  const source = join(space.legacyRoot, 'db.sqlite3');
  try {
    const legacy = await createLegacyDatabase(source);
    for (const id of [7, 8]) insertRow(legacy, 'auth_user', { id, username: `user-${id}`, is_active: 1 });
    insertRow(legacy, 'board_series', {
      id: 3,
      owner_id: 7,
      name: 'Guide',
      url: 'guide',
      text_md: 'md',
      text_html: '<p>md</p>',
      hide: 1,
      layout: 'list',
      order: 4,
      created_date: '2024-01-02 03:04:05.123456',
      updated_date: '2024-01-03 00:00:00',
    });
    insertRow(legacy, 'board_seriesconfigmeta', {
      id: 1,
      post_id: 3,
      name: 'unused',
      value: 'x',
      created_date: '2024-01-01 00:00:00',
      updated_date: '2024-01-01 00:00:00',
    });
    insertRow(legacy, 'board_post', {
      id: 5,
      author_id: 7,
      series_id: 3,
      url: 'first',
      title: 'First',
      published_date: '2024-01-01 00:00:00',
    });
    insertRow(legacy, 'board_post', {
      id: 6,
      author_id: 7,
      url: 'second',
      title: 'Second',
      published_date: '2024-01-01 00:00:00',
    });
    legacy.exec('BEGIN; PRAGMA defer_foreign_keys = ON');
    insertRow(legacy, 'board_comment', {
      id: 10,
      post_id: 5,
      author_id: 8,
      parent_id: 11,
      text_md: 'a',
      text_html: '<p>a</p>',
      edited: 1,
      heart: 1,
      created_date: '2024-02-01 01:02:03.456789',
    });
    insertRow(legacy, 'board_comment', {
      id: 11,
      post_id: 6,
      parent_id: 10,
      text_md: 'b',
      text_html: '<p>b</p>',
      created_date: '2024-02-02 00:00:00',
    });
    insertRow(legacy, 'board_comment', {
      id: 12,
      post_id: 6,
      author_id: 7,
      parent_id: 12,
      text_md: 'self',
      text_html: 'self',
      created_date: '2024-02-03 00:00:00',
    });
    legacy.exec('COMMIT');
    insertRow(legacy, 'board_comment_likes', { id: 30, comment_id: 10, user_id: 7 });
    insertRow(legacy, 'board_authorsubscription', {
      id: 40,
      subscriber_id: 8,
      author_id: 7,
      created_date: '2024-03-01 00:00:00',
    });
    insertRow(legacy, 'board_authorsubscriptionlog', {
      id: 50,
      subscriber_id: 8,
      author_id: 7,
      action: 'subscribe',
      created_date: '2024-03-01 00:00:00',
    });
    insertRow(legacy, 'board_authorsubscriptionlog', {
      id: 51,
      subscriber_id: 8,
      author_id: 7,
      action: 'unsubscribe',
      created_date: '2024-03-02 00:00:00',
    });
    for (const [name, seq] of [
      ['board_series', 60],
      ['board_comment', 70],
      ['board_authorsubscription', 80],
      ['board_authorsubscriptionlog', 90],
    ] as const) {
      legacy.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?').run(seq, name);
    }
    legacy.close();

    await prepareDatabase(space.options);

    const imported = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.deepEqual(
      {
        ...imported
          .prepare(
            'SELECT ownerId, slug, name, descriptionMarkdown, descriptionHtml, isHidden, layout, "order", createdAt, updatedAt FROM Series WHERE id = 3',
          )
          .get(),
      },
      {
        ownerId: 7,
        slug: 'guide',
        name: 'Guide',
        descriptionMarkdown: 'md',
        descriptionHtml: '<p>md</p>',
        isHidden: 1,
        layout: 'list',
        order: 4,
        createdAt: Date.UTC(2024, 0, 2, 3, 4, 5, 123),
        updatedAt: Date.UTC(2024, 0, 3),
      },
    );
    assert.equal(
      imported.prepare('SELECT 1 FROM sqlite_schema WHERE name = ?').get('board_seriesconfigmeta'),
      undefined,
    );
    assert.deepEqual(
      imported
        .prepare(
          'SELECT id, postId, authorId, parentId, markdown, html, isEdited, isHearted, createdAt FROM Comment ORDER BY id',
        )
        .all()
        .map((row) => ({ ...row })),
      [
        {
          id: 10,
          postId: 5,
          authorId: 8,
          parentId: 11,
          markdown: 'a',
          html: '<p>a</p>',
          isEdited: 1,
          isHearted: 1,
          createdAt: Date.UTC(2024, 1, 1, 1, 2, 3, 456),
        },
        {
          id: 11,
          postId: 6,
          authorId: null,
          parentId: 10,
          markdown: 'b',
          html: '<p>b</p>',
          isEdited: 0,
          isHearted: 0,
          createdAt: Date.UTC(2024, 1, 2),
        },
        {
          id: 12,
          postId: 6,
          authorId: 7,
          parentId: 12,
          markdown: 'self',
          html: 'self',
          isEdited: 0,
          isHearted: 0,
          createdAt: Date.UTC(2024, 1, 3),
        },
      ],
    );
    assert.deepEqual({ ...imported.prepare('SELECT * FROM CommentLike').get() }, { commentId: 10, userId: 7 });
    assert.deepEqual(
      { ...imported.prepare('SELECT id, subscriberId, authorId, createdAt FROM AuthorSubscription').get() },
      { id: 40, subscriberId: 8, authorId: 7, createdAt: Date.UTC(2024, 2, 1) },
    );
    assert.deepEqual(
      imported
        .prepare('SELECT id, action, createdAt FROM AuthorSubscriptionLog ORDER BY id')
        .all()
        .map((row) => ({ ...row })),
      [
        { id: 50, action: 'subscribe', createdAt: Date.UTC(2024, 2, 1) },
        { id: 51, action: 'unsubscribe', createdAt: Date.UTC(2024, 2, 2) },
      ],
    );
    for (const [table, seq] of [
      ['Series', 60],
      ['Comment', 70],
      ['AuthorSubscription', 80],
      ['AuthorSubscriptionLog', 90],
    ] as const) {
      assert.equal(
        Number((imported.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').get(table) as { seq: number }).seq),
        seq,
        table,
      );
    }
    assert.equal(imported.prepare('SELECT 1 FROM sqlite_sequence WHERE name = ?').get('CommentLike'), undefined);
    assert.deepEqual(imported.prepare('PRAGMA foreign_key_check').all(), []);
    imported.close();
  } finally {
    await space.cleanup();
  }
});

test('imports the 3.14 post domain with merged settings, keys, and counters', async () => {
  const space = await workspace();
  const source = join(space.legacyRoot, 'db.sqlite3');
  try {
    const legacy = await createLegacyDatabase(source);
    for (const id of [7, 8]) insertRow(legacy, 'auth_user', { id, username: `user-${id}`, is_active: 1 });
    insertRow(legacy, 'board_post', {
      id: 5,
      author_id: 7,
      url: 'configured',
      title: 'Configured',
      subtitle: 'Sub',
      meta_description: 'Desc',
      image: 'images/a.png',
      image_hash: 'hash',
      read_time: 3,
      created_date: '2024-01-01 00:00:00.123456',
      updated_date: '2024-01-02 00:00:00.654321',
      published_date: '2024-01-03 00:00:00',
    });
    insertRow(legacy, 'board_post', {
      id: 6,
      author_id: 7,
      url: 'no-settings',
      title: 'No settings',
      created_date: '2024-01-01 00:00:00',
      updated_date: '2024-01-01 00:00:00',
      published_date: '2024-01-03 00:00:00',
    });
    insertRow(legacy, 'board_post', {
      id: 9,
      author_id: 7,
      url: 'draft',
      title: 'Draft',
      created_date: '2024-01-01 00:00:00',
      updated_date: '2024-01-01 00:00:00',
    });
    insertRow(legacy, 'board_post', {
      id: 10,
      author_id: 7,
      url: 'bad-date',
      title: 'Bad date',
      created_date: '2024-01-01 00:00:00',
      updated_date: '2024-01-01 00:00:00',
    });
    insertRow(legacy, 'board_postconfig', {
      id: 1,
      post_id: 5,
      hide: 1,
      advertise: 1,
      block_comment: 1,
      cover_layout: 'split',
      cover_image_position: 'left',
      cover_image_ratio: '4:3',
    });
    insertRow(legacy, 'board_postcontent', { id: 40, post_id: 5, content_html: '<p>Body</p>' });
    insertRow(legacy, 'board_postconfigmeta', {
      id: 1,
      post_id: 9,
      name: 'draft_reserved_date',
      value: '2099-01-01T09:00:00+09:00',
      created_date: '2024-01-01',
      updated_date: '2024-01-01',
    });
    insertRow(legacy, 'board_postconfigmeta', {
      id: 2,
      post_id: 9,
      name: 'draft_reserved_date',
      value: '2099-02-02 00:00:00',
      created_date: '2024-01-01',
      updated_date: '2024-01-01',
    });
    insertRow(legacy, 'board_postconfigmeta', {
      id: 3,
      post_id: 9,
      name: 'unused',
      value: 'discarded',
      created_date: '2024-01-01',
      updated_date: '2024-01-01',
    });
    insertRow(legacy, 'board_postconfigmeta', {
      id: 4,
      post_id: 10,
      name: 'draft_reserved_date',
      value: 'not a date',
      created_date: '2024-01-01',
      updated_date: '2024-01-01',
    });
    insertRow(legacy, 'board_tag', { id: 3, value: 'kept' });
    insertRow(legacy, 'board_post_tags', { id: 8, post_id: 5, tag_id: 3 });
    insertRow(legacy, 'board_edithistory', {
      id: 11,
      post_id: 5,
      actor_id: 7,
      change_type: 'edit',
      title: 'Old',
      tags: '["a", 1]',
      source_updated_date: '2023-12-31 00:00:00',
      created_date: '2024-01-01 00:00:00',
    });
    insertRow(legacy, 'board_edithistory', {
      id: 12,
      post_id: 5,
      change_type: 'restore',
      restored_from_id: 11,
      tags: '{"not":"a list"}',
      created_date: '2024-01-02 00:00:00',
    });
    insertRow(legacy, 'board_post_likes', {
      id: 21,
      post_id: 5,
      user_id: 8,
      created_date: '2024-02-01 00:00:00.999999',
    });
    insertRow(legacy, 'board_pinnedpost', {
      id: 22,
      post_id: 5,
      user_id: 7,
      order: 4,
      created_date: '2024-02-02 00:00:00',
    });
    insertRow(legacy, 'board_postsharelink', {
      id: 23,
      post_id: 5,
      token: 'share-token',
      label: 'Link',
      is_paused: 1,
      created_date: '2024-02-03 00:00:00',
    });
    insertRow(legacy, 'board_post_share_link_daily_counts', { id: 24, link_id: 23, day: '2024-02-04', clicks: 9 });
    insertRow(legacy, 'board_editrequest', {
      id: 25,
      post_id: 5,
      user_id: 8,
      title: 'Discarded',
      content: 'x',
      is_merged: 0,
      created_date: '2024-01-01',
      updated_date: '2024-01-01',
    });
    for (const [name, seq] of [
      ['board_post', 90],
      ['board_tag', 91],
      ['board_edithistory', 92],
      ['board_postsharelink', 93],
    ] as const) {
      legacy.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?').run(seq, name);
    }
    legacy.close();

    await prepareDatabase(space.options);

    const imported = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.deepEqual(
      {
        ...imported
          .prepare(`SELECT authorId, slug, title, subtitle, description, image, imageHash, readTime, isHidden, isAdvertised, commentsBlocked,
      coverLayout, coverImagePosition, coverImageRatio, createdAt, updatedAt, publishedAt, draftScheduledAt FROM Post WHERE id = 5`)
          .get(),
      },
      {
        authorId: 7,
        slug: 'configured',
        title: 'Configured',
        subtitle: 'Sub',
        description: 'Desc',
        image: 'images/a.png',
        imageHash: 'hash',
        readTime: 3,
        isHidden: 1,
        isAdvertised: 1,
        commentsBlocked: 1,
        coverLayout: 'split',
        coverImagePosition: 'left',
        coverImageRatio: '4:3',
        createdAt: Date.UTC(2024, 0, 1, 0, 0, 0, 123),
        updatedAt: Date.UTC(2024, 0, 2, 0, 0, 0, 654),
        publishedAt: Date.UTC(2024, 0, 3),
        draftScheduledAt: null,
      },
    );
    assert.deepEqual(
      {
        ...imported
          .prepare(
            'SELECT isHidden, isAdvertised, commentsBlocked, coverLayout, coverImagePosition, coverImageRatio FROM Post WHERE id = 6',
          )
          .get(),
      },
      {
        isHidden: 0,
        isAdvertised: 0,
        commentsBlocked: 0,
        coverLayout: 'default',
        coverImagePosition: 'right',
        coverImageRatio: 'auto',
      },
    );
    assert.equal(
      (imported.prepare('SELECT draftScheduledAt AS date FROM Post WHERE id = 9').get() as { date: number }).date,
      Date.UTC(2099, 1, 2),
    );
    assert.equal(
      (imported.prepare('SELECT draftScheduledAt AS date FROM Post WHERE id = 10').get() as { date: number | null })
        .date,
      null,
    );
    assert.deepEqual({ ...imported.prepare('SELECT * FROM PostContent').get() }, { postId: 5, html: '<p>Body</p>' });
    assert.deepEqual({ ...imported.prepare('SELECT * FROM Tag').get() }, { id: 3, name: 'kept' });
    assert.deepEqual({ ...imported.prepare('SELECT * FROM _PostToTag').get() }, { A: 5, B: 3 });
    assert.deepEqual(
      imported
        .prepare(
          `SELECT id, actorId, restoredFromId, type, json(tags) AS tags, sourceUpdatedAt FROM PostRevision ORDER BY id`,
        )
        .all()
        .map((row) => ({ ...row })),
      [
        {
          id: 11,
          actorId: 7,
          restoredFromId: null,
          type: 'edit',
          tags: '["a"]',
          sourceUpdatedAt: Date.UTC(2023, 11, 31),
        },
        { id: 12, actorId: null, restoredFromId: 11, type: 'restore', tags: '[]', sourceUpdatedAt: null },
      ],
    );
    assert.deepEqual(
      { ...imported.prepare('SELECT * FROM PostLike').get() },
      { postId: 5, userId: 8, createdAt: Date.UTC(2024, 1, 1, 0, 0, 0, 999) },
    );
    assert.deepEqual(
      { ...imported.prepare('SELECT * FROM PinnedPost').get() },
      { userId: 7, postId: 5, order: 4, createdAt: Date.UTC(2024, 1, 2) },
    );
    assert.deepEqual(
      { ...imported.prepare('SELECT id, postId, token, label, isPaused FROM PostShareLink').get() },
      { id: 23, postId: 5, token: 'share-token', label: 'Link', isPaused: 1 },
    );
    assert.deepEqual(
      { ...imported.prepare('SELECT * FROM PostShareDailyCount').get() },
      { linkId: 23, day: Date.UTC(2024, 1, 4), clicks: 9 },
    );
    for (const [table, seq] of [
      ['Post', 90],
      ['Tag', 91],
      ['PostRevision', 92],
      ['PostShareLink', 93],
    ] as const) {
      assert.equal(
        Number((imported.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').get(table) as { seq: number }).seq),
        seq,
        table,
      );
    }
    for (const table of ['board_post', 'board_postconfig', 'board_postconfigmeta', 'board_editrequest']) {
      assert.equal(imported.prepare('SELECT 1 FROM sqlite_schema WHERE name = ?').get(table), undefined, table);
    }
    assert.deepEqual(imported.prepare('PRAGMA foreign_key_check').all(), []);
    imported.close();
  } finally {
    await space.cleanup();
  }
});

test('names the row when a 3.14 subscription log has an unknown action', async () => {
  const space = await workspace();
  const source = join(space.legacyRoot, 'db.sqlite3');
  try {
    const legacy = await createLegacyDatabase(source);
    for (const id of [7, 8]) insertRow(legacy, 'auth_user', { id, username: `user-${id}`, is_active: 1 });
    insertRow(legacy, 'board_authorsubscriptionlog', {
      id: 51,
      subscriber_id: 8,
      author_id: 7,
      action: 'paused',
      created_date: '2024-03-02 00:00:00',
    });
    legacy.close();
    await assert.rejects(prepareDatabase(space.options), /board_authorsubscriptionlog\.action in row 51 is "paused"/);
    assert.equal(existsSync(space.databasePath), false);
  } finally {
    await space.cleanup();
  }
});

test('imports 3.14 developer tokens and request logs so they keep authenticating and auditing', async () => {
  const space = await workspace();
  const source = join(space.legacyRoot, 'db.sqlite3');
  try {
    const legacy = await createLegacyDatabase(source);
    insertRow(legacy, 'auth_user', { id: 7, username: 'writer', password: 'pbkdf2_sha256$fixture$hash', is_active: 1 });
    insertRow(legacy, 'board_profile', { id: 7, user_id: 7, role: 'EDITOR' });
    const activeToken = 'blex_pat_activetoken1_imported-secret';
    insertRow(legacy, 'board_developertoken', {
      id: 12,
      user_id: 7,
      name: 'Active',
      token_prefix: 'activetoken1',
      token_hash: createHash('sha256').update(activeToken).digest('hex'),
      scopes: '["posts:read"]',
      expires_at: '2099-01-01 00:00:00.000000',
      created_date: '2024-01-01 00:00:00',
      updated_date: '2024-01-01 00:00:00',
    });
    insertRow(legacy, 'board_developertoken', {
      id: 3,
      user_id: 7,
      name: 'Automation',
      token_prefix: 'aaaaaaaaaaaa',
      token_hash: 'a'.repeat(64),
      scopes: '["posts:read", "posts:write"]',
      expires_at: '2030-01-02 03:04:05.678901',
      revoked_at: '2024-05-06 07:08:09+09:00',
      last_used_at: '2024-05-01 00:00:00',
      last_used_ip: '203.0.113.9',
      created_date: '2024-01-01 00:00:00',
      updated_date: '2024-05-01 00:00:00',
    });
    const malformedScopes: Array<[number, string, string]> = [
      [5, '{"posts:read":true}', '[]'],
      [6, '["posts:read", 1, null]', '["posts:read"]'],
      [8, '7', '[]'],
    ];
    for (const [id, scopes] of malformedScopes) {
      insertRow(legacy, 'board_developertoken', {
        id,
        user_id: 7,
        name: `Token ${id}`,
        token_prefix: `prefix${id}`,
        token_hash: `hash${id}`,
        scopes,
        created_date: '2024-01-01 00:00:00',
        updated_date: '2024-01-01 00:00:00',
      });
    }
    insertRow(legacy, 'board_developerrequestlog', {
      id: 9,
      user_id: 7,
      token_id: 3,
      method: 'PATCH',
      path: '/api/developer/v1/posts/1',
      status_code: 409,
      ip_address: '203.0.113.9',
      user_agent: 'blex-mcp',
      created_date: '2024-05-01 00:00:00.250000',
    });
    insertRow(legacy, 'board_developerrequestlog', {
      id: 10,
      user_id: 7,
      token_id: null,
      method: 'GET',
      path: '/api/developer/v1/me',
      status_code: 200,
      ip_address: null,
      user_agent: '',
      created_date: '2024-05-02 00:00:00',
    });
    legacy.exec(`
      UPDATE sqlite_sequence SET seq = 50 WHERE name = 'board_developertoken';
      UPDATE sqlite_sequence SET seq = 60 WHERE name = 'board_developerrequestlog';
    `);
    legacy.close();

    await prepareDatabase(space.options);

    const imported = new DatabaseSync(space.databasePath);
    assert.deepEqual(
      {
        ...imported
          .prepare(
            'SELECT userId, name, tokenPrefix, tokenHash, scopes, expiresAt, revokedAt, lastUsedAt, lastUsedIp, createdAt, updatedAt FROM DeveloperToken WHERE id = 3',
          )
          .get(),
      },
      {
        userId: 7,
        name: 'Automation',
        tokenPrefix: 'aaaaaaaaaaaa',
        tokenHash: 'a'.repeat(64),
        scopes: '["posts:read","posts:write"]',
        expiresAt: Date.UTC(2030, 0, 2, 3, 4, 5, 678),
        revokedAt: Date.UTC(2024, 4, 5, 22, 8, 9),
        lastUsedAt: Date.UTC(2024, 4, 1),
        lastUsedIp: '203.0.113.9',
        createdAt: Date.UTC(2024, 0, 1),
        updatedAt: Date.UTC(2024, 4, 1),
      },
    );
    for (const [id, , scopes] of malformedScopes) {
      assert.equal(
        (imported.prepare('SELECT scopes FROM DeveloperToken WHERE id = ?').get(id) as { scopes: string }).scopes,
        scopes,
      );
    }
    assert.deepEqual(
      {
        ...imported
          .prepare(
            'SELECT userId, tokenId, method, path, statusCode, ipAddress, userAgent, createdAt FROM DeveloperRequestLog WHERE id = 9',
          )
          .get(),
      },
      {
        userId: 7,
        tokenId: 3,
        method: 'PATCH',
        path: '/api/developer/v1/posts/1',
        statusCode: 409,
        ipAddress: '203.0.113.9',
        userAgent: 'blex-mcp',
        createdAt: Date.UTC(2024, 4, 1, 0, 0, 0, 250),
      },
    );
    assert.deepEqual(
      { ...imported.prepare('SELECT tokenId, ipAddress, userAgent FROM DeveloperRequestLog WHERE id = 10').get() },
      { tokenId: null, ipAddress: null, userAgent: '' },
    );
    assert.equal(
      Number(
        (imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'DeveloperToken'`).get() as { seq: number })
          .seq,
      ),
      50,
    );
    assert.equal(
      Number(
        (
          imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'DeveloperRequestLog'`).get() as {
            seq: number;
          }
        ).seq,
      ),
      60,
    );
    imported.close();

    const db = new PrismaClient({ datasourceUrl: `file:${space.databasePath}` });
    try {
      const scopes = await db.developerToken.findMany({ orderBy: { id: 'asc' }, select: { scopes: true } });
      assert.deepEqual(
        scopes.map((token) => token.scopes),
        [['posts:read', 'posts:write'], [], ['posts:read'], [], ['posts:read']],
      );
    } finally {
      await db.$disconnect();
    }

    const app = await buildApp(space.databasePath, new URL('http://site.test'), {
      secretKey: 'import-secret',
      cipherKey: '0123456789abcdef0123456789abcdef',
    });
    try {
      const me = await app.inject({
        url: '/api/developer/v1/me',
        headers: { authorization: `Bearer ${activeToken}`, 'user-agent': 'after-import' },
      });
      assert.equal(me.statusCode, 200, me.body);
      assert.equal(me.json().data.token.token_prefix, 'activetoken1');
    } finally {
      await app.close();
    }
    const audited = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.deepEqual(
      {
        ...audited
          .prepare(
            `SELECT id, tokenId, userId, statusCode, userAgent FROM DeveloperRequestLog WHERE userAgent = 'after-import'`,
          )
          .get(),
      },
      {
        id: 61,
        tokenId: 12,
        userId: 7,
        statusCode: 200,
        userAgent: 'after-import',
      },
    );
    assert.equal(
      (
        audited.prepare('SELECT lastUsedAt IS NOT NULL AS used FROM DeveloperToken WHERE id = 12').get() as {
          used: number;
        }
      ).used,
      1,
    );
    audited.close();
  } finally {
    await space.cleanup();
  }
});

test('keeps what public pages showed when a 3.14 database has no site settings row 1', async () => {
  const space = await workspace();
  try {
    const legacy = await createLegacyDatabase(join(space.legacyRoot, 'db.sqlite3'));
    insertRow(legacy, 'django_site', { id: 1, name: 'site', domain: 'feeds.example.test' });
    insertRow(legacy, 'board_sitesetting', {
      id: 4,
      site_name: 'Brand row',
      logo_svg: 'brand/logo.svg',
      seo_enabled: 0,
      aeo_enabled: 1,
      robots_txt_extra_rules: 'Disallow: /x',
      header_script: '<script>unread()</script>',
      icon_manifest: '[]',
      updated_date: '2024-04-01 00:00:00',
    });
    insertRow(legacy, 'board_integrationsetting', { id: 3, telegram_enabled: 1, updated_date: '2024-04-01 00:00:00' });
    legacy.close();
    await prepareDatabase(space.options);
    const imported = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.deepEqual(
      {
        ...imported
          .prepare(
            'SELECT id, siteName, domain, logoSvg, seoEnabled, aeoEnabled, robotsTxtExtraRules, headerScript, iconManifest FROM SiteSetting',
          )
          .get(),
      },
      {
        id: 1,
        siteName: 'Brand row',
        domain: 'feeds.example.test',
        logoSvg: 'brand/logo.svg',
        seoEnabled: 0,
        aeoEnabled: 0,
        robotsTxtExtraRules: '',
        headerScript: '',
        iconManifest: null,
      },
    );
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
    assert.deepEqual(
      { ...imported.prepare('SELECT id, siteName, domain, seoEnabled, aeoEnabled FROM SiteSetting').get() },
      {
        id: 1,
        siteName: 'BLEX',
        domain: 'feeds.example.test',
        seoEnabled: 1,
        aeoEnabled: 0,
      },
    );
    imported.close();
  } finally {
    await space.cleanup();
  }
});

test('asks older 3.x installs to reach 3.14 first and creates nothing', async () => {
  const space = await workspace();
  try {
    (await createLegacyDatabase(join(space.legacyRoot, 'db.sqlite3'), '0069_older')).close();
    await assert.rejects(
      prepareDatabase(space.options),
      (error: Error) => error instanceof DatabaseSetupError && /to 3\.14 first/.test(error.message),
    );
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
    prerelease.exec(
      `CREATE TABLE _prisma_migrations (migration_name TEXT); INSERT INTO _prisma_migrations VALUES ('0000_django_3x');`,
    );
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
    [
      'board_sitebanner',
      { scope: 'global', banner_type: 'floating', position: 'top' },
      /board_sitebanner\.banner_type in row 9 is "floating".*horizontal, sidebar/,
    ],
    [
      'board_sitebanner',
      { scope: 'global', banner_type: 'horizontal', position: 'center' },
      /board_sitebanner\.position in row 9 is "center".*top, bottom, left, right/,
    ],
    ['board_sitenotice', { scope: 'team' }, /board_sitenotice\.scope in row 9 is "team".*user, global/],
    [
      'board_sitenotice',
      { scope: 'global', order: 3_000_000_000 },
      /board_sitenotice\.order in row 9 is "3000000000".*32-bit/,
    ],
  ];
  for (const [table, values, message] of cases) {
    const space = await workspace();
    try {
      const legacy = await createLegacyDatabase(join(space.legacyRoot, 'db.sqlite3'));
      insertRow(legacy, table, {
        id: 9,
        created_date: '2024-01-01 00:00:00',
        updated_date: '2024-01-01 00:00:00',
        ...values,
      });
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

test('imports 3.14 accounts with credentials, permissions, and preferences intact', async () => {
  const space = await workspace();
  const source = join(space.legacyRoot, 'db.sqlite3');
  const cipherKey = '0123456789abcdef0123456789abcdef';
  const password = 'compatibility-비밀번호-2026';
  const passwordHash =
    'pbkdf2_sha256$100000$TestOnlyBlexCompatibilitySalt$C7LHeNRVZX18ry19YwDvmo1l7q8hcL5jtbv2QGe2x8E=';
  const totpSecret = encryptSecret('JBSWY3DPEHPK3PXP', cipherKey);
  const recoveryKey = '831c28715dcd5f61787dc41ad7bf1663f904ab40c6220da4630e7fddecae6fe8';
  const clientSecret = encryptSecret('oauth-client-secret', cipherKey);
  try {
    const legacy = await createLegacyDatabase(source);
    insertRow(legacy, 'auth_user', {
      id: 7,
      username: 'writer',
      password: passwordHash,
      first_name: 'Writer',
      last_name: 'Discarded',
      email: 'writer@example.test',
      is_active: 1,
      is_staff: 1,
      is_superuser: 0,
      last_login: '2024-01-02 03:04:05.678901',
      date_joined: '2023-01-01 00:00:00',
    });
    for (const [id, username] of [
      [8, 'direct'],
      [9, 'grouped'],
      [10, 'viewonly'],
      [11, 'otherapp'],
    ] as const) {
      insertRow(legacy, 'auth_user', {
        id,
        username,
        password: passwordHash,
        is_active: 1,
        is_staff: 1,
        date_joined: '2023-01-01 00:00:00',
      });
    }
    insertRow(legacy, 'auth_user', {
      id: 12,
      username: 'root',
      password: passwordHash,
      is_active: 1,
      is_staff: 1,
      is_superuser: 1,
      date_joined: '2023-01-01 00:00:00',
    });
    insertRow(legacy, 'auth_user', {
      id: 13,
      username: 'noprofile',
      password: passwordHash,
      is_active: 0,
      date_joined: '2023-01-01 00:00:00',
    });
    insertRow(legacy, 'django_content_type', { id: 30, app_label: 'board', model: 'sitesetting' });
    insertRow(legacy, 'django_content_type', { id: 31, app_label: 'other', model: 'sitesetting' });
    insertRow(legacy, 'auth_permission', {
      id: 40,
      content_type_id: 30,
      codename: 'change_sitesetting',
      name: 'Can change',
    });
    insertRow(legacy, 'auth_permission', {
      id: 41,
      content_type_id: 30,
      codename: 'view_sitesetting',
      name: 'Can view',
    });
    insertRow(legacy, 'auth_permission', {
      id: 42,
      content_type_id: 31,
      codename: 'change_sitesetting',
      name: 'Other app',
    });
    insertRow(legacy, 'auth_group', { id: 50, name: 'Editors' });
    insertRow(legacy, 'auth_group_permissions', { id: 1, group_id: 50, permission_id: 40 });
    insertRow(legacy, 'auth_user_groups', { id: 1, user_id: 9, group_id: 50 });
    insertRow(legacy, 'auth_user_user_permissions', { id: 1, user_id: 8, permission_id: 40 });
    insertRow(legacy, 'auth_user_user_permissions', { id: 2, user_id: 10, permission_id: 41 });
    insertRow(legacy, 'auth_user_user_permissions', { id: 3, user_id: 11, permission_id: 42 });
    insertRow(legacy, 'board_profile', {
      id: 70,
      user_id: 7,
      role: 'EDITOR',
      bio: 'Bio',
      avatar: 'a.png',
      cover: 'c.png',
      homepage: 'https://w.example',
      about_md: '# About',
      about_html: '<h1>About</h1>',
      analytics_share_url: 'https://discarded.example',
    });
    insertRow(legacy, 'board_profile', { id: 71, user_id: 8, role: 'READER' });
    insertRow(legacy, 'board_config', { id: 1, user_id: 7, language: 'en', time_zone: 'Asia/Seoul' });
    insertRow(legacy, 'board_config', { id: 2, user_id: 8, language: null, time_zone: '' });
    const meta = (id: number, user_id: number, name: string, value: string) =>
      insertRow(legacy, 'board_userconfigmeta', {
        id,
        user_id,
        name,
        value,
        created_date: '2024-01-01 00:00:00',
        updated_date: '2024-01-01 00:00:00',
      });
    meta(3, 7, 'NOTIFY_MENTION', 'true');
    meta(4, 7, 'NOTIFY_MENTION', 'false');
    meta(1, 7, 'NOTIFY_POSTS_LIKE', 'false');
    meta(2, 7, 'NOTIFY_POSTS_LIKE', 'true');
    meta(5, 7, 'NOTIFY_COMMENT_LIKE', 'True');
    meta(6, 9, 'NOTIFY_POSTS_COMMENT', 'true');
    insertRow(legacy, 'board_userlinkmeta', {
      id: 21,
      user_id: 7,
      name: 'github',
      value: 'https://github.com/w',
      order: 2,
      created_date: '2024-01-01 00:00:00',
      updated_date: '2024-01-02 00:00:00',
    });
    insertRow(legacy, 'board_socialauthprovider', {
      id: 3,
      key: 'google',
      client_id: 'client',
      client_secret: clientSecret,
      is_enabled: 1,
    });
    insertRow(legacy, 'board_socialauth', {
      id: 4,
      provider_id: 3,
      uid: 'uid-1',
      user_id: 7,
      extra_data: '{"name":"W"}',
      created_date: '2024-01-03 00:00:00',
    });
    insertRow(legacy, 'board_twofactorauth', {
      id: 5,
      user_id: 7,
      totp_secret: totpSecret,
      recovery_key: recoveryKey,
      created_date: '2024-01-04 00:00:00',
    });
    insertRow(legacy, 'board_usernamechangelog', {
      id: 6,
      user_id: 7,
      username: 'oldwriter',
      created_date: '2024-01-05 00:00:00',
    });
    insertRow(legacy, 'board_authorinvite', {
      id: 8,
      code: 'claimed',
      note: 'n',
      is_active: 0,
      created_by_id: 7,
      claimed_by_id: 8,
      created_date: '2024-01-06 00:00:00',
      claimed_date: '2024-01-07 00:00:00',
    });
    insertRow(legacy, 'board_loginattempt', { key: 'k'.repeat(64), window: 123, count: 4 });
    insertRow(legacy, 'board_emailchange', {
      id: 1,
      user_id: 7,
      email: 'discarded@example.test',
      auth_token: 'tok',
      created_date: '2024-01-01 00:00:00',
    });
    for (const [name, seq] of [
      ['auth_user', 500],
      ['board_userlinkmeta', 501],
      ['board_socialauthprovider', 502],
      ['board_socialauth', 503],
      ['board_twofactorauth', 504],
      ['board_usernamechangelog', 505],
      ['board_authorinvite', 506],
    ] as const) {
      legacy.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?').run(seq, name);
    }
    legacy.close();

    await prepareDatabase(space.options);

    const imported = new DatabaseSync(space.databasePath, { readOnly: true });
    const one = (sql: string) => ({ ...imported.prepare(sql).get() });
    assert.deepEqual(
      one(
        'SELECT username, email, passwordHash, name, isActive, isStaff, isSuperuser, canManageSiteSettings, lastLoginAt, joinedAt FROM User WHERE id = 7',
      ),
      {
        username: 'writer',
        email: 'writer@example.test',
        passwordHash,
        name: 'Writer',
        isActive: 1,
        isStaff: 1,
        isSuperuser: 0,
        canManageSiteSettings: 0,
        lastLoginAt: Date.UTC(2024, 0, 2, 3, 4, 5, 678),
        joinedAt: Date.UTC(2023, 0, 1),
      },
    );
    const granted = imported
      .prepare('SELECT id FROM User WHERE canManageSiteSettings = 1 ORDER BY id')
      .all()
      .map((row) => row.id);
    assert.deepEqual(granted, [8, 9]);
    assert.deepEqual(
      one('SELECT role, bio, avatar, cover, homepage, aboutMarkdown, aboutHtml FROM Profile WHERE userId = 7'),
      {
        role: 'EDITOR',
        bio: 'Bio',
        avatar: 'a.png',
        cover: 'c.png',
        homepage: 'https://w.example',
        aboutMarkdown: '# About',
        aboutHtml: '<h1>About</h1>',
      },
    );
    assert.equal(count(imported, 'Profile'), 2);
    assert.deepEqual(
      one(
        'SELECT language, timeZone, notifyPostLike, notifyPostComment, notifyCommentLike, notifyMention FROM UserPreference WHERE userId = 7',
      ),
      {
        language: 'en',
        timeZone: 'Asia/Seoul',
        notifyPostLike: 0,
        notifyPostComment: null,
        notifyCommentLike: 0,
        notifyMention: 1,
      },
    );
    assert.deepEqual(
      one('SELECT language, timeZone, notifyPostComment, notifyMention FROM UserPreference WHERE userId = 9'),
      {
        language: null,
        timeZone: '',
        notifyPostComment: 1,
        notifyMention: null,
      },
    );
    assert.deepEqual(one('SELECT language, timeZone, notifyPostLike FROM UserPreference WHERE userId = 8'), {
      language: null,
      timeZone: '',
      notifyPostLike: null,
    });
    assert.equal(count(imported, 'UserPreference'), 3);
    assert.deepEqual(one('SELECT id, userId, platform, url, "order", createdAt, updatedAt FROM SocialLink'), {
      id: 21,
      userId: 7,
      platform: 'github',
      url: 'https://github.com/w',
      order: 2,
      createdAt: Date.UTC(2024, 0, 1),
      updatedAt: Date.UTC(2024, 0, 2),
    });
    assert.deepEqual(one('SELECT id, key, clientId, clientSecret, isEnabled FROM SocialProvider'), {
      id: 3,
      key: 'google',
      clientId: 'client',
      clientSecret,
      isEnabled: 1,
    });
    assert.deepEqual(one('SELECT id, providerId, uid, userId, extraData, createdAt FROM SocialAccount'), {
      id: 4,
      providerId: 3,
      uid: 'uid-1',
      userId: 7,
      extraData: '{"name":"W"}',
      createdAt: Date.UTC(2024, 0, 3),
    });
    assert.deepEqual(one('SELECT id, userId, totpSecret, recoveryKey, createdAt FROM TwoFactorAuth'), {
      id: 5,
      userId: 7,
      totpSecret,
      recoveryKey,
      createdAt: Date.UTC(2024, 0, 4),
    });
    assert.deepEqual(one('SELECT id, userId, username, createdAt FROM UsernameChange'), {
      id: 6,
      userId: 7,
      username: 'oldwriter',
      createdAt: Date.UTC(2024, 0, 5),
    });
    assert.deepEqual(
      one('SELECT id, code, note, isActive, createdById, claimedById, createdAt, claimedAt FROM AuthorInvite'),
      {
        id: 8,
        code: 'claimed',
        note: 'n',
        isActive: 0,
        createdById: 7,
        claimedById: 8,
        createdAt: Date.UTC(2024, 0, 6),
        claimedAt: Date.UTC(2024, 0, 7),
      },
    );
    assert.deepEqual(one('SELECT key, window, count FROM LoginAttempt'), {
      key: 'k'.repeat(64),
      window: 123,
      count: 4,
    });
    for (const [name, seq] of [
      ['User', 500],
      ['SocialLink', 501],
      ['SocialProvider', 502],
      ['SocialAccount', 503],
      ['TwoFactorAuth', 504],
      ['UsernameChange', 505],
      ['AuthorInvite', 506],
    ] as const) {
      assert.equal(
        Number((imported.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').get(name) as { seq: number }).seq),
        seq,
        name,
      );
    }
    for (const table of [
      'auth_user',
      'auth_group',
      'auth_group_permissions',
      'auth_permission',
      'auth_user_groups',
      'auth_user_user_permissions',
      'django_content_type',
      'board_emailchange',
      'board_config',
      'board_userconfigmeta',
    ]) {
      assert.equal(imported.prepare('SELECT 1 FROM sqlite_schema WHERE name = ?').get(table), undefined, table);
    }
    assert.deepEqual(imported.prepare('PRAGMA foreign_key_check').all(), []);
    imported.close();

    const siteUrl = new URL('https://blex.example');
    const app = await buildApp(space.databasePath, siteUrl, { secretKey: 'import-account-secret', cipherKey });
    try {
      const page = await app.inject('/v1/login');
      const csrf = String(page.headers['set-cookie']).match(/csrftoken=([^;]+)/)?.[1] ?? '';
      const headers = { origin: siteUrl.origin, cookie: `csrftoken=${csrf}`, 'x-csrftoken': csrf };
      const login = (payload: Record<string, string>) =>
        app.inject({ method: 'POST', url: '/v1/login', headers, payload });
      assert.equal((await login({ username: 'writer', password })).json().body.security, true);
      const code = new TOTP({ secret: Secret.fromBase32('JBSWY3DPEHPK3PXP') }).generate();
      assert.equal((await login({ username: 'writer', password, code })).json().body.username, 'writer');
      assert.equal(
        (await login({ username: 'writer', password, code: 'test-only-recovery-code' })).json().body.recoveryKeyUsed,
        true,
      );
      assert.equal((await login({ username: 'noprofile', password })).json().errorCode, 'error:AT');
      assert.deepEqual((await app.inject('/v1/social-providers')).json().body, [
        { key: 'google', name: 'Google', clientId: 'client' },
      ]);
    } finally {
      await app.close();
    }
  } finally {
    await space.cleanup();
  }
});

test('imports retired 3.x roles as readers and oversized social links without breaking later saves', async () => {
  const space = await workspace();
  const source = join(space.legacyRoot, 'db.sqlite3');
  try {
    const legacy = await createLegacyDatabase(source);
    insertRow(legacy, 'auth_user', { id: 7, username: 'writer', date_joined: '2023-01-01 00:00:00' });
    insertRow(legacy, 'board_profile', { id: 1, user_id: 7, role: 'ADMIN' });
    const link = (id: number, order: number) =>
      insertRow(legacy, 'board_userlinkmeta', {
        id,
        user_id: 7,
        name: 'github',
        value: `https://github.com/${id}`,
        order,
        created_date: '2024-01-01 00:00:00',
        updated_date: '2024-01-01 00:00:00',
      });
    link(5, 3_000_000_000);
    link(3_000_000_000, 1);
    legacy.close();

    await prepareDatabase(space.options);

    const imported = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.equal(
      (imported.prepare('SELECT role FROM Profile WHERE userId = 7').get() as { role: string }).role,
      'READER',
    );
    assert.deepEqual(
      imported
        .prepare('SELECT id, url, "order" FROM SocialLink ORDER BY id')
        .all()
        .map((row) => ({ ...row })),
      [
        { id: 5, url: 'https://github.com/5', order: 2_147_483_647 },
        { id: 6, url: 'https://github.com/3000000000', order: 1 },
      ],
    );
    assert.equal(
      Number(
        (imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'SocialLink'`).get() as { seq: number }).seq,
      ),
      6,
    );
    imported.close();

    const db = new PrismaClient({ datasourceUrl: `file:${space.databasePath}?connection_limit=1` });
    try {
      const created = await db.socialLink.create({
        data: { userId: 7, platform: 'github', url: 'https://github.com/new' },
        select: { id: true },
      });
      assert.equal(created.id, 7);
      assert.equal((await db.socialLink.findMany({ select: { id: true } })).length, 3);
    } finally {
      await db.$disconnect();
    }
  } finally {
    await space.cleanup();
  }
});

test('an unreadable 3.14 media folder stops the import with the command that fixes it', {
  skip: process.getuid?.() === 0,
}, async () => {
  const space = await workspace();
  const source = join(space.legacyRoot, 'db.sqlite3');
  const privateFolder = join(space.legacyRoot, 'resources', 'media', '_work_logs');
  try {
    (await createLegacyDatabase(source)).close();
    await mkdir(privateFolder, { mode: 0o700 });
    await writeFile(join(privateFolder, 'attachment.txt'), 'private');
    const before = await fileHash(source);
    await chmod(privateFolder, 0o000);

    await assert.rejects(prepareDatabase(space.options), (error: Error) => {
      assert.ok(error instanceof DatabaseSetupError);
      assert.match(error.message, /sudo chown -R 1000:1000 backend\/src\/resources\/media\/_work_logs/);
      return true;
    });
    assert.equal(existsSync(space.databasePath), false);
    assert.equal(existsSync(`${space.databasePath}.importing`), false);

    await chmod(privateFolder, 0o700);
    assert.equal(await fileHash(source), before);
    await prepareDatabase(space.options);
    assert.equal(existsSync(space.databasePath), true);
    assert.equal(await readFile(join(space.mediaRoot, '_work_logs', 'attachment.txt'), 'utf8'), 'private');
  } finally {
    await chmod(privateFolder, 0o700).catch(() => undefined);
    await space.cleanup();
  }
});
