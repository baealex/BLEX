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

const directory = await mkdtemp(join(tmpdir(), 'blex-v4-settings-pages-'));
const databasePath = join(directory, 'synthetic-settings.sqlite3');
const csrfToken = 'n'.repeat(43);
const siteUrl = new URL('https://blog.example');

function createSchema() {
  const fixture = new DatabaseSync(databasePath);
  fixture.exec(`
    CREATE TABLE auth_user (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, first_name TEXT NOT NULL DEFAULT '', is_active BOOLEAN NOT NULL DEFAULT 1
    );
    CREATE TABLE board_profile (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE, bio TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'READER'
    );
    CREATE TABLE board_config (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE, language TEXT);
    CREATE TABLE board_notify (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, url TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
      message_key TEXT NOT NULL DEFAULT '', message_params TEXT NOT NULL DEFAULT '{}', has_read BOOLEAN NOT NULL DEFAULT 0,
      created_date DATETIME NOT NULL
    );
    CREATE TABLE board_userconfigmeta (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, value TEXT NOT NULL,
      created_date DATETIME NOT NULL, updated_date DATETIME NOT NULL, user_id INTEGER NOT NULL
    );
    CREATE TABLE board_authorsubscription (
      id INTEGER PRIMARY KEY, created_date DATETIME NOT NULL, author_id INTEGER NOT NULL, subscriber_id INTEGER NOT NULL
    );
    CREATE TABLE board_telegramsync (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, tid TEXT NOT NULL DEFAULT '');
    CREATE TABLE board_integrationsetting (
      id INTEGER PRIMARY KEY, telegram_enabled BOOLEAN NOT NULL DEFAULT 0,
      telegram_bot_username TEXT NOT NULL DEFAULT '', telegram_bot_token TEXT NOT NULL DEFAULT ''
    );
  `);
  fixture.close();
}

function seed() {
  const fixture = new DatabaseSync(databasePath);
  fixture.exec(`
    DELETE FROM board_userconfigmeta;
    DELETE FROM board_notify;
    DELETE FROM board_authorsubscription;
    DELETE FROM board_telegramsync;
    DELETE FROM board_integrationsetting;
    DELETE FROM board_config;
    DELETE FROM board_profile;
    DELETE FROM auth_user;
    INSERT INTO auth_user VALUES (1, 'reader', 'Reader', 1), (2, 'author', 'Author Name', 1);
    INSERT INTO board_profile VALUES (1, 1, 'Reader bio', '', 'READER'), (2, 2, '<unsafe bio>', 'author.png', 'EDITOR');
    INSERT INTO board_config VALUES (1, 1, 'en');
    INSERT INTO board_notify VALUES
      (1, 1, '/@author/post-one', 'Author posted a new article.', 'UNKNOWN', '{}', 0, datetime('now')),
      (2, 1, 'javascript:alert(1)', 'A mention without a safe link.', 'UNKNOWN', '{}', 1, datetime('now'));
    INSERT INTO board_authorsubscription VALUES (1, '2026-11-20 10:00:00', 2, 1);
    INSERT INTO board_integrationsetting VALUES (1, 1, 'synthetic_bot', 'synthetic-token');
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
  const [row] = await db.$queryRaw<Array<{ hasRead: number }>>`SELECT has_read AS hasRead FROM board_notify WHERE id = 1`;
  assert.equal(Number(row?.hasRead), 1);

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
  fixture.exec("INSERT INTO board_telegramsync VALUES (1, 1, '123456')");
  fixture.close();
  assert.equal((await mySubscriptions(db, 1)).isTelegramConnected, true);
});
