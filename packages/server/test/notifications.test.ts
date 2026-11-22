import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { encryptDjangoSecret } from '../src/features/auth/django-secret.js';
import { deliverTelegramNotification } from '../src/features/notifications/delivery.js';
import { registerNotifications } from '../src/features/notifications/index.js';
import { processScheduledPublications, syncPostPublication } from '../src/features/notifications/model.js';
import { registerSubscriptionPage } from '../src/features/engagement/ui/subscriptions.js';

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
  raw.prepare(`INSERT INTO board_integrationsetting (id, telegram_enabled, telegram_bot_username, telegram_bot_token, updated_date)
    VALUES (1, 1, 'synthetic-only', ?, '2000-01-01')`).run(encryptDjangoSecret('123:dummy-private-listener', cipher));
  raw.prepare(`INSERT INTO board_telegramsync (tid, auth_token, auth_token_exp, created_date, user_id)
    VALUES (?, '', '2000-01-01', '2000-01-01', 2)`).run(encryptDjangoSecret('456', cipher));
  raw.close();
  const db = new PrismaClient({ datasourceUrl: `file:${dbPath}` });
  try {
    await db.$transaction((tx) => syncPostPublication(tx, 1));
    await processScheduledPublications(db);
    assert.equal(await db.board_notify.count(), 0);
    await db.$executeRaw`DELETE FROM board_authorsubscription WHERE subscriber_id = 3`;
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE board_post SET published_date = '2000-01-02 00:00:00' WHERE id = 1`;
      await tx.$executeRaw`UPDATE blex_scheduled_publication SET publish_at = '2000-01-02 00:00:00' WHERE post_id = 1`;
    });
    await processScheduledPublications(db);
    await db.$executeRaw`UPDATE board_post SET title = 'Title change' WHERE id = 1`;
    await db.$transaction((tx) => syncPostPublication(tx, 1));
    const notices = await db.$queryRaw<Array<{ url: string; recipient: number; key: string }>>`
      SELECT url, user_id AS recipient, message_key AS key FROM board_notify
    `;
    assert.deepEqual(notices, [{ url: '/@editor/scheduled', recipient: 2, key: 'post.published' }]);
    const fakeSignal = new AbortController().signal;
    const site = new URL('https://site.example');
    const busy: typeof fetch = async () => new Response(null, { status: 429, headers: { 'Retry-After': '1' } });
    assert.equal(await deliverTelegramNotification(db, site, cipher, busy, fakeSignal), true);
    assert.equal(await deliverTelegramNotification(db, site, cipher, busy, fakeSignal), false);
    await db.$executeRaw`UPDATE blex_notification_delivery SET available_at = 0`;
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
    registerSubscriptionPage(pages, db, {
      currentUser: async () => reader,
      siteUrl: site,
    });
    await pages.ready();
    try {
      const notificationPage = await pages.inject('/settings/notify');
      assert.equal(notificationPage.statusCode, 200, notificationPage.body);
      assert.equal(notificationPage.headers['cache-control'], 'private, no-store');
      assert.match(notificationPage.body, /알림 설정/);
      assert.match(notificationPage.body, /텔레그램 알림 관리/);
      assert.doesNotMatch(notificationPage.body, /Telegram/);
      assert.match(notificationPage.body, /@editor님이 새 글을 발행했습니다/);
      assert.match(notificationPage.body, /Scheduled post/);

      const subscriptionsPage = await pages.inject('/settings/subscriptions');
      assert.equal(subscriptionsPage.statusCode, 200);
      assert.match(subscriptionsPage.body, /구독한 작가가 새 글을 발행하면 알림을 보내드립니다/);
      assert.match(subscriptionsPage.body, /구독한 작가/);
      assert.match(subscriptionsPage.body, /2000-01-01부터 구독/);
      assert.doesNotMatch(subscriptionsPage.body, /Telegram/);
    } finally {
      await pages.close();
    }
  } finally {
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
