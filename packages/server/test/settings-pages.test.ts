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
import { accountTables, createMigratedTables, migratedTableSql } from './fixtures/migrated-database.js';

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-settings-pages-'));
const databasePath = join(directory, 'synthetic-settings.sqlite3');
const csrfToken = 'n'.repeat(43);
const siteUrl = new URL('https://blog.example');

function createSchema() {
  const fixture = new DatabaseSync(databasePath);
  createMigratedTables(fixture, 'IntegrationSetting', 'Notification', 'TelegramConnection');
  fixture.exec(`
  ${migratedTableSql(...accountTables)}
    ${migratedTableSql('AuthorSubscription')}
  `);
  fixture.close();
}

function seed() {
  const fixture = new DatabaseSync(databasePath);
  fixture.exec(`
    DELETE FROM Notification;
    DELETE FROM "AuthorSubscription";
    DELETE FROM TelegramConnection;
    DELETE FROM IntegrationSetting;
    DELETE FROM "UserPreference";
    DELETE FROM "Profile";
    DELETE FROM "User";
    INSERT INTO "User" ("id", "username", "name", "isActive", "email", "passwordHash", "joinedAt") VALUES
    (1, 'reader', 'Reader', 1, '', '', 1577836800000),
    (2, 'author', 'Author Name', 1, '', '', 1577836800000);
    INSERT INTO "Profile" ("userId", "bio", "avatar", "role") VALUES
    (1, 'Reader bio', '', 'READER'),
    (2, '<unsafe bio>', 'author.png', 'EDITOR');
    INSERT INTO "UserPreference" ("userId", "language") VALUES
    (1, 'en');
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
  const prefs = await db.userPreference.findUnique({
    where: { userId: 1 },
    select: { notifyCommentLike: true, notifyMention: true, notifyPostLike: true, notifyPostComment: true },
  });
  assert.deepEqual(prefs, { notifyCommentLike: false, notifyMention: true, notifyPostLike: null, notifyPostComment: null });
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
