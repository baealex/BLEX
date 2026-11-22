import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { after, beforeEach, test } from 'node:test';
import { registerNotifications } from '../src/features/notifications/index.js';
import { mySubscriptions } from '../src/features/engagement/services/subscriptions.js';
import { createMigratedTables, migratedTableSql } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-settings-pages-'));
const databasePath = join(directory, 'synthetic-settings.sqlite3');
const csrfToken = 'n'.repeat(43);
const siteUrl = new URL('https://blog.example');

function createSchema() {
  const fixture = new DatabaseSync(databasePath);
  createMigratedTables(fixture, 'IntegrationSetting', 'Notification', 'TelegramConnection');
  fixture.exec(`
    CREATE TABLE auth_user (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, first_name TEXT NOT NULL DEFAULT '', is_active BOOLEAN NOT NULL DEFAULT 1
    );
    CREATE TABLE board_profile (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE, bio TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'READER'
    );
    CREATE TABLE board_config (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE, language TEXT);
    CREATE TABLE board_userconfigmeta (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, value TEXT NOT NULL,
      created_date DATETIME NOT NULL, updated_date DATETIME NOT NULL, user_id INTEGER NOT NULL
    );
    ${migratedTableSql('AuthorSubscription')}
  `);
  fixture.close();
}

function seed() {
  const fixture = new DatabaseSync(databasePath);
  fixture.exec(`
    DELETE FROM board_userconfigmeta;
    DELETE FROM Notification;
    DELETE FROM "AuthorSubscription";
    DELETE FROM TelegramConnection;
    DELETE FROM IntegrationSetting;
    DELETE FROM board_config;
    DELETE FROM board_profile;
    DELETE FROM auth_user;
    INSERT INTO auth_user VALUES (1, 'reader', 'Reader', 1), (2, 'author', 'Author Name', 1);
    INSERT INTO board_profile VALUES (1, 1, 'Reader bio', '', 'READER'), (2, 2, '<unsafe bio>', 'author.png', 'EDITOR');
    INSERT INTO board_config VALUES (1, 1, 'en');
    INSERT INTO Notification (id, userId, key, url, content, messageKey, messageParams, isRead, createdAt, updatedAt) VALUES
      (1, 1, 'first', '/@author/post-one', 'Author posted a new article.', 'UNKNOWN', '{}', 0, ${Date.now()}, ${Date.now()}),
      (2, 1, 'second', 'javascript:alert(1)', 'A mention without a safe link.', 'UNKNOWN', '{}', 1, ${Date.now()}, ${Date.now()});
    INSERT INTO "AuthorSubscription" ("id", "createdAt", "authorId", "subscriberId") VALUES
    (1, 1795168800000, 2, 1);
    INSERT INTO IntegrationSetting (id, telegramEnabled, telegramBotUsername, telegramBotToken, updatedAt) VALUES (1, 1, 'synthetic_bot', 'synthetic-token', 946684800000);
  `);
  fixture.close();
}

createSchema();
const db = new PrismaClient({ datasourceUrl: `file:${databasePath}?connection_limit=1` });
const app = Fastify();
await app.register(cookie);
registerNotifications(app, db, {
  siteUrl,
  currentUser: async (request) => {
    const value = request.headers['x-test-user'];
    const id = typeof value === 'string' ? Number(value) : NaN;
    if (id !== 1) return null;
    return { id, username: 'reader', hasEditorRole: false, isStaff: false, hasConnectedTelegram: false, notifyCount: 1 };
  },
  validateCsrf: (request) => request.headers.origin === siteUrl.origin
    && request.headers.cookie?.includes(`csrftoken=${csrfToken}`) === true
    && (request.headers['x-csrftoken'] === csrfToken || (request.body as Record<string, unknown> | undefined)?.csrfmiddlewaretoken === csrfToken),
});
await app.ready();

after(async () => {
  await app.close();
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

beforeEach(() => seed());

const signedInHeaders = {
  'x-test-user': '1',
  cookie: `csrftoken=${csrfToken}`,
  origin: siteUrl.origin,
  'x-csrftoken': csrfToken,
};

test('protects the notification API and keeps read and preference changes scoped', async () => {
  assert.equal((await app.inject('/v1/setting/notify')).json().errorCode, 'error:NL');
  assert.equal((await app.inject('/v1/setting/notify-config')).json().errorCode, 'error:NL');

  const inbox = await app.inject({ url: '/v1/setting/notify', headers: signedInHeaders });
  assert.equal(inbox.statusCode, 200);
  assert.equal(inbox.headers['cache-control'], 'private, no-store');
  assert.deepEqual(inbox.json().body.notify.map((item: { id: number; isRead: boolean }) => [item.id, item.isRead]).sort(), [[1, false], [2, true]]);

  const config = await app.inject({ url: '/v1/setting/notify-config', headers: signedInHeaders });
  assert.deepEqual(config.json().body.config.map((item: { name: string }) => item.name), ['NOTIFY_COMMENT_LIKE', 'NOTIFY_MENTION']);

  const noCsrf = await app.inject({ method: 'PUT', url: '/v1/setting/notify', headers: { 'x-test-user': '1' }, payload: { id: 1 } });
  assert.equal(noCsrf.statusCode, 403);
  const marked = await app.inject({ method: 'PUT', url: '/v1/setting/notify', headers: signedInHeaders, payload: { id: 1 } });
  assert.equal(marked.json().status, 'DONE');
  assert.equal((await db.notification.findUnique({ where: { id: 1 } }))?.isRead, true);

  const saved = await app.inject({
    method: 'PUT', url: '/v1/setting/notify-config', headers: signedInHeaders,
    payload: { NOTIFY_MENTION: true, NOTIFY_COMMENT_LIKE: false, NOTIFY_POSTS_LIKE: true },
  });
  assert.equal(saved.json().status, 'DONE');
  const prefs = await db.$queryRaw<Array<{ name: string; value: string }>>`
    SELECT name, value FROM board_userconfigmeta WHERE user_id = 1 ORDER BY name
  `;
  assert.deepEqual(prefs, [
    { name: 'NOTIFY_COMMENT_LIKE', value: 'false' },
    { name: 'NOTIFY_MENTION', value: 'true' },
  ]);
});

test('reads subscriptions with author details and the Telegram connection state', async () => {
  const before = await mySubscriptions(db, 1);
  assert.equal(before.isTelegramConnected, false);
  assert.equal(before.subscriptions[0]?.username, 'author');
  assert.equal(before.subscriptions[0]?.name, 'Author Name');
  assert.equal(before.subscriptions[0]?.bio, '<unsafe bio>');

  const fixture = new DatabaseSync(databasePath);
  fixture.exec("INSERT INTO TelegramConnection (userId, telegramId) VALUES (1, '123456')");
  fixture.close();
  assert.equal((await mySubscriptions(db, 1)).isTelegramConnected, true);
});
