import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { after, beforeEach, test } from 'node:test';
import { registerNotifications } from '../src/notifications/index.js';
import { registerSubscriptionPage } from '../src/reader-ui/subscriptions.js';

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
registerSubscriptionPage(app, db, {
  siteUrl,
  currentUser: async (request) => {
    const value = request.headers['x-test-user'];
    const id = typeof value === 'string' ? Number(value) : NaN;
    return id === 1 ? { id, username: 'reader', hasEditorRole: false, isStaff: false } : null;
  },
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

test('renders the notification inbox in the shared settings shell and keeps its progressive actions', async () => {
  const anonymous = await app.inject('/settings/notify');
  assert.equal(anonymous.statusCode, 302);
  assert.match(anonymous.headers.location ?? '', /next=%2Fsettings%2Fnotify/);

  const response = await app.inject({ url: '/settings/notify', headers: signedInHeaders });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['cache-control'], 'private, no-store');
  assert.match(response.body, /data-site-header="true"/);
  assert.match(response.body, /aria-label="설정 메뉴"/);
  assert.match(response.body, /class="notification-config"/);
  assert.match(response.body, /href="\/settings\/integration"/);
  assert.match(response.body, /href="https:\/\/blog\.example\/@author\/post-one"/);
  assert.match(response.body, /새 알림/);
  assert.doesNotMatch(response.body, /href="javascript:alert\(1\)"/);
  assert.match(response.body, /name="NOTIFY_COMMENT_LIKE"/);
  assert.match(response.body, /name="NOTIFY_MENTION"/);
  assert.doesNotMatch(response.body, /name="NOTIFY_POSTS_LIKE"/);

  const marked = await app.inject({
    method: 'POST', url: '/settings/notify', headers: { ...signedInHeaders, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams([['csrfmiddlewaretoken', csrfToken], ['id', '1']]).toString(),
  });
  assert.equal(marked.statusCode, 303);
  const [row] = await db.$queryRaw<Array<{ hasRead: number }>>`SELECT has_read AS hasRead FROM board_notify WHERE id = 1`;
  assert.equal(Number(row?.hasRead), 1);

  const saved = await app.inject({
    method: 'POST', url: '/settings/notify', headers: { ...signedInHeaders, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams([
      ['csrfmiddlewaretoken', csrfToken], ['intent', 'preferences'], ['NOTIFY_MENTION', 'true'],
    ]).toString(),
  });
  assert.equal(saved.statusCode, 303);
  const prefs = await db.$queryRaw<Array<{ name: string; value: string }>>`
    SELECT name, value FROM board_userconfigmeta WHERE user_id = 1 ORDER BY name
  `;
  assert.deepEqual(prefs, [
    { name: 'NOTIFY_COMMENT_LIKE', value: 'false' },
    { name: 'NOTIFY_MENTION', value: 'true' },
  ]);
});

test('renders subscriptions with shared navigation, publication state, Telegram prompt, and unsubscribe form', async () => {
  const anonymous = await app.inject('/settings/subscriptions');
  assert.equal(anonymous.statusCode, 302);
  assert.match(anonymous.headers.location ?? '', /next=%2Fsettings%2Fsubscriptions/);

  const response = await app.inject({ url: '/settings/subscriptions', headers: signedInHeaders });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['cache-control'], 'private, no-store');
  assert.match(response.body, /data-site-header="true"/);
  assert.match(response.body, /aria-current="page"/);
  assert.match(response.body, /텔레그램으로 새 글 받기/);
  assert.match(response.body, /href="\/@author"/);
  assert.match(response.body, /Author Name/);
  assert.match(response.body, /&lt;unsafe bio&gt;/);
  assert.match(response.body, /action="\/v1\/users\/@author\/subscription"/);
  assert.match(response.body, /name="action" value="unsubscribe"/);
  assert.match(response.body, /name="return_to" value="\/settings\/subscriptions"/);

  const fixture = new DatabaseSync(databasePath);
  fixture.exec("INSERT INTO board_telegramsync VALUES (1, 1, '123456')");
  fixture.close();
  const connected = await app.inject({ url: '/settings/subscriptions', headers: signedInHeaders });
  assert.doesNotMatch(connected.body, /텔레그램으로 새 글 받기/);
});
