import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { decryptDjangoSecret, encryptDjangoSecret } from '../src/features/auth/django-secret.js';
import { deleteAccountRows } from '../src/features/auth/services/deletions.js';
import { registerTelegram, telegramWebhookSecret } from '../src/features/integrations/telegram.js';
import { deliverPostWebhook, queuePostWebhooks } from '../src/features/integrations/webhooks/delivery.js';
import { registerWebhooks } from '../src/features/integrations/webhooks/index.js';
import { deliverTelegramNotification } from '../src/features/notifications/delivery.js';
import { registerNotifications } from '../src/features/notifications/index.js';
import { createNotification, processScheduledPublications, syncPostPublication } from '../src/features/notifications/model.js';
import { mySubscriptions } from '../src/features/engagement/services/subscriptions.js';
import { createMigratedDatabase, insertRow, seedPost } from './fixtures/migrated-database.js';

test('delivers scheduled publication once, retains queued retries, and respects a removed subscription', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blex-notifications-'));
  const dbPath = join(directory, 'test.sqlite3');
  const cipher = '0123456789abcdef0123456789abcdef';
  const raw = new DatabaseSync(dbPath);
  for (const migration of ['0001_init']) {
    raw.exec(await readFile(new URL(`../../prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8'));
  }
  raw.exec(`
    INSERT INTO auth_user (id, username, password, email, first_name, last_name, date_joined, is_active, is_staff, is_superuser)
    VALUES (1, 'editor', '!synthetic', '', 'Editor', '', '2000-01-01', 1, 0, 0),
           (2, 'reader', '!synthetic', '', 'Reader', '', '2000-01-01', 1, 0, 0),
           (3, 'oldreader', '!synthetic', '', 'Old reader', '', '2000-01-01', 1, 0, 0);
    INSERT INTO board_profile (user_id, bio, cover, avatar, homepage, about_md, about_html, analytics_share_url, role)
    VALUES (1, '', '', '', '', '', '', '', 'EDITOR');
    INSERT INTO board_post (id, title, url, image, read_time, created_date, updated_date, author_id, meta_description, subtitle, published_date, image_hash)
    VALUES (1, 'Scheduled post', 'scheduled', '', 1, '2000-01-01', '2000-01-01', 1, '', '', '2099-01-01 00:00:00', '');
    INSERT INTO board_postconfig (post_id, hide, advertise, block_comment, cover_image_position, cover_image_ratio, cover_layout)
    VALUES (1, 0, 0, 0, 'right', 'auto', 'default');
    INSERT INTO board_authorsubscription (created_date, author_id, subscriber_id)
    VALUES ('2000-01-01', 1, 2), ('2000-01-01', 1, 3);
  `);
  raw.prepare(`INSERT INTO IntegrationSetting (id, telegramEnabled, telegramBotUsername, telegramBotToken, updatedAt)
    VALUES (1, 1, 'synthetic-only', ?, 946684800000)`).run(encryptDjangoSecret('123:dummy-private-listener', cipher));
  raw.prepare(`INSERT INTO TelegramConnection (telegramId, createdAt, userId)
    VALUES (?, 946684800000, 2)`).run(encryptDjangoSecret('456', cipher));
  raw.close();
  const db = new PrismaClient({ datasourceUrl: `file:${dbPath}` });
  try {
    await db.$transaction((tx) => syncPostPublication(tx, 1));
    await processScheduledPublications(db);
    assert.equal(await db.notification.count(), 0);
    await db.$executeRaw`DELETE FROM board_authorsubscription WHERE subscriber_id = 3`;
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE board_post SET published_date = '2000-01-02 00:00:00' WHERE id = 1`;
      await tx.$executeRaw`UPDATE blex_scheduled_publication SET publish_at = '2000-01-02 00:00:00' WHERE post_id = 1`;
    });
    await processScheduledPublications(db);
    await db.$executeRaw`UPDATE board_post SET title = 'Title change' WHERE id = 1`;
    await db.$transaction((tx) => syncPostPublication(tx, 1));
    const notices = await db.notification.findMany({ select: { url: true, userId: true, messageKey: true } });
    assert.deepEqual(notices, [{ url: '/@editor/scheduled', userId: 2, messageKey: 'post.published' }]);
    const fakeSignal = new AbortController().signal;
    const site = new URL('https://site.example');
    const busy: typeof fetch = async () => new Response(null, { status: 429, headers: { 'Retry-After': '1' } });
    assert.equal(await deliverTelegramNotification(db, site, cipher, busy, fakeSignal), true);
    assert.equal(await deliverTelegramNotification(db, site, cipher, busy, fakeSignal), false);
    await db.notificationDelivery.updateMany({ data: { availableAt: new Date(0) } });
    const sent: typeof fetch = async (url, init) => {
      assert.equal(url, 'https://api.telegram.org/bot123:dummy-private-listener/sendMessage');
      const message = JSON.parse(String(init?.body));
      assert.equal(message.chat_id, '456');
      assert.match(message.text, /site\.example\/@editor\/scheduled/);
      assert.match(message.text, /Scheduled post/);
      return Response.json({ ok: true });
    };
    assert.equal(await deliverTelegramNotification(db, site, cipher, sent, fakeSignal), true);
    assert.equal(await deliverTelegramNotification(db, site, cipher, sent, fakeSignal), false);

    const pages = Fastify();
    await pages.register(cookie);
    const reader = { id: 2, username: 'reader', hasEditorRole: false, isStaff: false, hasConnectedTelegram: true, notifyCount: 1 };
    registerNotifications(pages, db, {
      currentUser: async () => reader,
      validateCsrf: () => true,
      siteUrl: site,
    });
    await pages.ready();
    try {
      const inbox = await pages.inject('/v1/setting/notify');
      assert.equal(inbox.statusCode, 200, inbox.body);
      assert.equal(inbox.headers['cache-control'], 'private, no-store');
      assert.equal(inbox.json().body.isTelegramSync, true);
      assert.match(inbox.body, /@editor님이 새 글을 발행했습니다/);
      assert.match(inbox.body, /Scheduled post/);

      const { subscriptions } = await mySubscriptions(db, reader.id);
      assert.equal(subscriptions[0]?.username, 'editor');
      assert.equal(subscriptions[0]?.subscribedDate, '2000-01-01');
    } finally {
      await pages.close();
    }
  } finally {
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});

const cipherKey = '0123456789abcdef0123456789abcdef';
const botToken = '123:dummy-private-listener';
const neverAborted = new AbortController().signal;

/** Profile ids deliberately collide with other accounts' user ids, so an owner mix-up cannot pass. */
async function deliveryFixture() {
  const fixture = await createMigratedDatabase();
  insertRow(fixture.db, 'auth_user', { id: 7, username: 'writer', first_name: 'Writer', password: 'x', is_active: 1 });
  insertRow(fixture.db, 'auth_user', { id: 70, username: 'other', first_name: 'Other', password: 'x', is_active: 1 });
  insertRow(fixture.db, 'board_profile', { id: 70, user_id: 7, role: 'EDITOR' });
  insertRow(fixture.db, 'board_profile', { id: 7, user_id: 70, role: 'EDITOR' });
  fixture.db.prepare(`INSERT INTO IntegrationSetting (id, telegramEnabled, telegramBotUsername, telegramBotToken, updatedAt)
    VALUES (1, 1, 'synthetic_bot', ?, 946684800000)`).run(encryptDjangoSecret(botToken, cipherKey));
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}?connection_limit=1` });
  return { fixture, db, async close() { await db.$disconnect(); await fixture.cleanup(); } };
}

test('claims a Telegram job once, backs off, and stops at the attempt limit', async () => {
  const { fixture, db, close } = await deliveryFixture();
  try {
    insertRow(fixture.db, 'TelegramConnection', { userId: 7, telegramId: encryptDjangoSecret('456', cipherKey) });
    insertRow(fixture.db, 'Notification', { id: 1, userId: 7, key: 'job', url: '/x', content: 'Hello', messageParams: '{}' });
    insertRow(fixture.db, 'NotificationDelivery', { notificationId: 1, availableAt: 0 });
    let calls = 0;
    const failing: typeof fetch = async () => { calls += 1; return new Response(null, { status: 500 }); };
    const site = new URL('https://site.example');

    const before = Date.now();
    const raced = await Promise.all(Array.from({ length: 6 }, () => deliverTelegramNotification(db, site, cipherKey, failing, neverAborted)));
    assert.equal(calls, 1);
    assert.equal(raced.filter(Boolean).length, 1);
    const queued = await db.notificationDelivery.findUniqueOrThrow({ where: { notificationId: 1 } });
    assert.equal(queued.attempts, 1);
    assert.ok(queued.availableAt.getTime() >= before + 15_000 && queued.availableAt.getTime() <= Date.now() + 15_000);

    for (let attempt = 2; attempt <= 8; attempt += 1) {
      await db.notificationDelivery.updateMany({ data: { availableAt: new Date(0) } });
      assert.equal(await deliverTelegramNotification(db, site, cipherKey, failing, neverAborted), true);
    }
    assert.equal(calls, 8);
    assert.equal(await db.notificationDelivery.count(), 0);
  } finally {
    await close();
  }
});

test('deduplicates notifications by key and leaves updatedAt alone when read', async () => {
  const { fixture, db, close } = await deliveryFixture();
  try {
    insertRow(fixture.db, 'TelegramConnection', { userId: 7, telegramId: 'cipher' });
    const input = { recipientId: 7, actor: 'other', url: '/@writer/post', title: 'Post', key: 'post.liked' as const };
    const results = await db.$transaction(async (tx) => [await createNotification(tx, input), await createNotification(tx, input)]);
    assert.deepEqual(results, [true, false]);
    assert.equal(await db.notification.count(), 1);
    assert.equal(await db.notificationDelivery.count(), 1);
    const created = await db.notification.findFirstOrThrow();
    assert.deepEqual(created.messageParams, { actor: 'other', post_title: 'Post' });

    const pages = Fastify();
    await pages.register(cookie);
    registerNotifications(pages, db, {
      currentUser: async () => ({ id: 7, username: 'writer', hasEditorRole: true, hasConnectedTelegram: true }),
      validateCsrf: () => true,
      siteUrl: new URL('https://site.example'),
    });
    await pages.ready();
    try {
      const marked = await pages.inject({ method: 'PUT', url: '/v1/setting/notify', payload: { id: created.id } });
      assert.equal(marked.json().status, 'DONE');
    } finally {
      await pages.close();
    }
    const read = await db.notification.findFirstOrThrow();
    assert.equal(read.isRead, true);
    assert.equal(read.updatedAt.getTime(), created.updatedAt.getTime());
  } finally {
    await close();
  }
});

test('sends each webhook once to the right owner and stops for a removed or failing channel', async () => {
  const { fixture, db, close } = await deliveryFixture();
  try {
    for (const [id, slug] of [[1, 'first'], [2, 'second'], [3, 'third'], [4, 'fourth'], [5, 'fifth']] as const) seedPost(fixture.db, id, 7, slug);
    insertRow(fixture.db, 'WebhookChannel', { id: 1, ownerId: 7, scope: 'user', url: 'https://hooks.example.com/owner', isActive: 1 });
    insertRow(fixture.db, 'WebhookChannel', { id: 2, ownerId: 70, scope: 'user', url: 'https://hooks.example.com/other', isActive: 1 });
    insertRow(fixture.db, 'WebhookChannel', { id: 3, ownerId: null, scope: 'global', url: 'https://hooks.example.com/all', isActive: 1 });
    const site = new URL('https://site.example');
    const due = () => db.webhookDelivery.updateMany({ where: { isDone: false }, data: { availableAt: new Date(0) } });

    await db.$transaction((tx) => queuePostWebhooks(tx, 1));
    await db.$transaction((tx) => queuePostWebhooks(tx, 1));
    assert.deepEqual((await db.webhookDelivery.findMany({ orderBy: { channelId: 'asc' } })).map((row) => row.channelId), [1, 3]);
    await due();
    const sent: string[] = [];
    const accept = async (url: URL) => { sent.push(url.pathname); return true; };
    await Promise.all(Array.from({ length: 6 }, () => deliverPostWebhook(db, site, neverAborted, accept)));
    assert.deepEqual(sent.sort(), ['/all', '/owner']);
    assert.ok((await db.webhookChannel.findUniqueOrThrow({ where: { id: 1 } })).lastSuccessAt);

    await db.$transaction((tx) => queuePostWebhooks(tx, 1));
    await due();
    assert.equal(await deliverPostWebhook(db, site, neverAborted, accept), false);
    assert.equal(sent.length, 2);

    await db.$transaction((tx) => queuePostWebhooks(tx, 2));
    await db.webhookChannel.delete({ where: { id: 3 } });
    assert.deepEqual((await db.webhookDelivery.findMany({ where: { postId: 2 } })).map((row) => row.channelId), [1]);

    const reject = async () => false;
    await due();
    assert.equal(await deliverPostWebhook(db, site, neverAborted, reject), true);
    for (const postId of [3, 4]) {
      await db.$transaction((tx) => queuePostWebhooks(tx, postId));
      await due();
      assert.equal(await deliverPostWebhook(db, site, neverAborted, reject), true);
    }
    const failed = await db.webhookChannel.findUniqueOrThrow({ where: { id: 1 } });
    assert.deepEqual([failed.failureCount, failed.isActive], [3, false]);
    await db.$transaction((tx) => queuePostWebhooks(tx, 5));
    assert.equal(await db.webhookDelivery.count({ where: { postId: 5 } }), 0);
  } finally {
    await close();
  }
});

test('stores webhook channels under the account and returns their URL only to the owner', async () => {
  const { db, close } = await deliveryFixture();
  const app = Fastify();
  await app.register(cookie);
  registerWebhooks(app, db, {
    currentUser: async (request) => {
      const id = Number(request.headers['x-user']);
      return { id, username: `user-${id}`, hasEditorRole: true, isStaff: false };
    },
    validateCsrf: () => true,
    siteUrl: new URL('https://site.example'),
    send: async () => true,
  });
  await app.ready();
  try {
    const url = 'https://hooks.example.com/services/bearer-secret';
    const headers = { 'x-user': '7' };
    const created = await app.inject({ method: 'POST', url: '/v1/webhook/channels', headers, payload: { webhookUrl: url, name: 'Alerts' } });
    const { channelId } = created.json().body;
    assert.deepEqual(await db.webhookChannel.findUniqueOrThrow({ where: { id: channelId }, select: { ownerId: true, url: true } }), { ownerId: 7, url });

    await db.webhookChannel.update({ where: { id: channelId }, data: { isActive: false, failureCount: 3 } });
    const saved = await app.inject({ method: 'POST', url: '/v1/webhook/channels', headers, payload: { webhookUrl: url } });
    assert.equal(saved.json().body.channelId, channelId);

    const listed = await app.inject({ url: '/v1/webhook/channels', headers });
    const [channel] = listed.json().body.channels;
    assert.deepEqual({ name: channel.name, webhookUrl: channel.webhookUrl, isActive: channel.isActive, failureCount: channel.failureCount },
      { name: 'Alerts', webhookUrl: url, isActive: true, failureCount: 0 });
    assert.match(channel.createdDate, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/);

    const otherAccount = await app.inject({ url: '/v1/webhook/channels', headers: { 'x-user': '70' } });
    assert.doesNotMatch(otherAccount.body, /bearer-secret/);

    const foreign = await app.inject({ method: 'DELETE', url: `/v1/webhook/channels/${channelId}`, headers: { 'x-user': '70' } });
    assert.equal(foreign.json().errorCode, 'error:NF');
    assert.equal((await app.inject({ method: 'DELETE', url: `/v1/webhook/channels/${channelId}`, headers })).json().body.success, true);
  } finally {
    await app.close();
    await close();
  }
});

test('keeps pending, connected, and expired Telegram codes distinct', async () => {
  const { db, close } = await deliveryFixture();
  const replies: string[] = [];
  const secretKey = 'synthetic-secret';
  const app = Fastify();
  await app.register(cookie);
  registerTelegram(app, db, {
    currentUser: async () => ({ id: 7, username: 'writer', hasConnectedTelegram: false }),
    validateCsrf: () => true,
    siteUrl: new URL('https://site.example'),
    cipherKey,
    secretKey,
    fetchProvider: async (_url, init) => { replies.push(JSON.parse(String(init?.body)).text); return Response.json({ ok: true }); },
  });
  await app.ready();
  const fromBot = (id: number, text: string) => app.inject({
    method: 'POST', url: '/v1/telegram/webHook',
    headers: { 'x-telegram-bot-api-secret-token': telegramWebhookSecret(secretKey, botToken) },
    payload: { message: { from: { id }, text } },
  });
  const connection = () => db.telegramConnection.findUniqueOrThrow({ where: { userId: 7 } });
  try {
    const rejected = await app.inject({ method: 'POST', url: '/v1/telegram/webHook', headers: { 'x-telegram-bot-api-secret-token': 'f'.repeat(64) }, payload: {} });
    assert.equal(rejected.statusCode, 403);

    const issued = await app.inject({ method: 'POST', url: '/v1/telegram/makeToken' });
    assert.doesNotMatch(issued.body, /dummy-private-listener/);
    const { token } = issued.json().body;
    const pending = await connection();
    assert.deepEqual([pending.telegramId, pending.authToken], ['', token]);
    assert.ok(pending.authTokenExpiresAt && pending.authTokenExpiresAt > new Date());
    assert.equal((await app.inject({ method: 'POST', url: '/v1/telegram/unsync' })).json().errorCode, 'error:AU');
    assert.equal(await db.telegramConnection.count(), 1);

    await fromBot(555, `/start ${token}`);
    const linked = await connection();
    assert.equal(decryptDjangoSecret(linked.telegramId, cipherKey), '555');
    assert.deepEqual([linked.authToken, linked.authTokenExpiresAt], ['', null]);
    assert.equal(replies.at(-1), '텔레그램을 연결했습니다.');

    await fromBot(777, `/start ${token}`);
    assert.equal(decryptDjangoSecret((await connection()).telegramId, cipherKey), '555');
    assert.match(replies.at(-1) ?? '', /둘러보세요/);

    const reissued = (await app.inject({ method: 'POST', url: '/v1/telegram/makeToken' })).json().body.token;
    assert.equal(decryptDjangoSecret((await connection()).telegramId, cipherKey), '555');
    await db.telegramConnection.update({ where: { userId: 7 }, data: { authTokenExpiresAt: new Date(Date.now() - 1_000) } });
    await fromBot(999, reissued);
    const expired = await connection();
    assert.equal(decryptDjangoSecret(expired.telegramId, cipherKey), '555');
    assert.deepEqual([expired.authToken, expired.authTokenExpiresAt], ['', null]);
    assert.match(replies.at(-1) ?? '', /만료/);

    assert.equal((await app.inject({ method: 'POST', url: '/v1/telegram/unsync' })).json().status, 'DONE');
    assert.equal(await db.telegramConnection.count(), 0);
  } finally {
    await app.close();
    await close();
  }
});

test('removes only the deleted account notifications, channels, and Telegram connection', async () => {
  const { fixture, db, close } = await deliveryFixture();
  try {
    seedPost(fixture.db, 1, 70, 'kept');
    for (const [id, userId] of [[1, 7], [2, 70]] as const) {
      insertRow(fixture.db, 'Notification', { id, userId, key: `key-${id}`, messageParams: '{}' });
      insertRow(fixture.db, 'NotificationDelivery', { notificationId: id, availableAt: 0 });
      insertRow(fixture.db, 'TelegramConnection', { userId, telegramId: 'cipher' });
      insertRow(fixture.db, 'WebhookChannel', { id, ownerId: userId, scope: 'user', url: `https://hooks.example.com/${id}` });
      insertRow(fixture.db, 'WebhookDelivery', { postId: 1, channelId: id, availableAt: 0 });
    }

    await db.$transaction((tx) => deleteAccountRows(tx, 7));

    assert.deepEqual((await db.notification.findMany()).map((row) => row.userId), [70]);
    assert.deepEqual((await db.notificationDelivery.findMany()).map((row) => row.notificationId), [2]);
    assert.deepEqual((await db.telegramConnection.findMany()).map((row) => row.userId), [70]);
    assert.deepEqual((await db.webhookChannel.findMany()).map((row) => row.ownerId), [70]);
    assert.deepEqual((await db.webhookDelivery.findMany()).map((row) => row.channelId), [2]);
  } finally {
    await close();
  }
});
