import type { PrismaClient } from '@prisma/client';
import { decryptDjangoSecret } from '../auth/django-secret.js';
import { deliverPostWebhook } from '../integrations/webhooks/delivery.js';
import { notificationParams, notificationText, processScheduledPublications } from './model.js';

const maxAttempts = 8;

export async function deliverTelegramNotification(db: PrismaClient, siteUrl: URL, cipherKey: string, send: typeof fetch, signal: AbortSignal) {
  const timestamp = BigInt(Date.now());
  const [job] = await db.$queryRaw<Array<{ notificationId: number; attempts: number }>>`
    UPDATE blex_notification_delivery SET attempts = attempts + 1, available_at = ${timestamp + 120_000n}
     WHERE notification_id = (SELECT notification_id FROM blex_notification_delivery WHERE available_at <= ${timestamp}
       ORDER BY available_at, notification_id LIMIT 1)
    RETURNING notification_id AS notificationId, attempts
  `;
  if (!job) return false;

  const [message] = await db.$queryRaw<Array<{
    chat: string; token: string; content: string; url: string; key: string; params: string; language: string | null;
  }>>`
    SELECT link.tid AS chat, settings.telegram_bot_token AS token, notify.content, notify.url,
           notify.message_key AS key, notify.message_params AS params, prefs.language
      FROM board_notify AS notify JOIN board_telegramsync AS link ON link.user_id = notify.user_id
      JOIN auth_user AS account ON account.id = notify.user_id AND account.is_active = 1
      LEFT JOIN board_config AS prefs ON prefs.user_id = notify.user_id
      JOIN board_integrationsetting AS settings ON settings.id = 1 AND settings.telegram_enabled = 1
     WHERE notify.id = ${job.notificationId}
  `;
  const token = message && decryptDjangoSecret(message.token, cipherKey);
  const chat = message && decryptDjangoSecret(message.chat, cipherKey);
  let retry = false;
  let wait = Math.min(3_600_000, 15_000 * 2 ** (job.attempts - 1));
  if (message && token && /^\d+:[A-Za-z0-9_-]+$/.test(token) && chat && /^-?\d+$/.test(chat)) {
    const url = URL.parse(message.url, siteUrl);
    const safeUrl = url && ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    const language = message.language === 'en' && process.env.ENABLE_ENGLISH_UI === 'TRUE' ? 'en' : 'ko';
    const text = notificationText(message.key, notificationParams(message.params), message.content, language);
    try {
      const response = await send(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        body: JSON.stringify({ chat_id: chat, text: `${safeUrl ? `${safeUrl}\n` : ''}${text}`.slice(0, 4_096) }),
        headers: { 'Content-Type': 'application/json' },
        redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
      });
      retry = response.status === 429 || response.status >= 500;
      if (response.status === 429) {
        const seconds = Number(response.headers.get('Retry-After'));
        if (Number.isFinite(seconds) && seconds > 0) wait = Math.max(wait, Math.min(seconds * 1_000, 3_600_000));
      }
      await response.body?.cancel();
    } catch {
      retry = true;
    }
  }
  if (retry && job.attempts < maxAttempts) {
    await db.$executeRaw`
      UPDATE blex_notification_delivery SET available_at = ${BigInt(Date.now() + wait)}
       WHERE notification_id = ${job.notificationId} AND attempts = ${job.attempts}
    `;
  } else {
    await db.$executeRaw`DELETE FROM blex_notification_delivery WHERE notification_id = ${job.notificationId} AND attempts = ${job.attempts}`;
  }
  return true;
}

export function startNotificationWorker(db: PrismaClient, siteUrl: URL, cipherKey: string, send = fetch) {
  const controller = new AbortController();
  let running: Promise<void> | undefined;
  const tick = async () => {
    try {
      await processScheduledPublications(db);
      for (let count = 0; count < 4 && !controller.signal.aborted; count += 1) {
        if (!await deliverTelegramNotification(db, siteUrl, cipherKey, send, controller.signal)) break;
      }
      for (let count = 0; count < 4 && !controller.signal.aborted; count += 1) {
        if (!await deliverPostWebhook(db, siteUrl, controller.signal)) break;
      }
    } catch {
      console.error('BLEX notification delivery polling failed.');
    }
  };
  const timer = setInterval(() => {
    if (!running) running = tick().finally(() => { running = undefined; });
  }, 5_000);
  timer.unref();
  return async () => {
    clearInterval(timer);
    controller.abort();
    await running;
  };
}
