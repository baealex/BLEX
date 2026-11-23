import type { PrismaClient } from '@prisma/client';
import { decryptSecret } from '../auth/encrypted-secret.js';
import { deliverPostWebhook } from '../integrations/webhooks/delivery.js';
import { notificationParams, notificationText, processScheduledPublications } from './model.js';

const maxAttempts = 8;
const claimLeaseMs = 120_000;

/** Takes the oldest due job. The guarded update lets only one worker win, and a loser moves on to the next job. */
async function claimDelivery(db: PrismaClient) {
  const now = new Date();
  for (;;) {
    const next = await db.notificationDelivery.findFirst({
      where: { availableAt: { lte: now } },
      orderBy: [{ availableAt: 'asc' }, { notificationId: 'asc' }],
      select: { notificationId: true, attempts: true },
    });
    if (!next) return null;
    const { count } = await db.notificationDelivery.updateMany({
      where: { notificationId: next.notificationId, attempts: next.attempts, availableAt: { lte: now } },
      data: { attempts: { increment: 1 }, availableAt: new Date(now.getTime() + claimLeaseMs) },
    });
    if (count) return { notificationId: next.notificationId, attempts: next.attempts + 1 };
  }
}

export async function deliverTelegramNotification(
  db: PrismaClient,
  siteUrl: URL,
  cipherKey: string,
  send: typeof fetch,
  signal: AbortSignal,
) {
  const job = await claimDelivery(db);
  if (!job) return false;

  const settings = await db.integrationSetting.findUnique({
    where: { id: 1 },
    select: { telegramEnabled: true, telegramBotToken: true },
  });
  const notification = await db.notification.findFirst({
    where: { id: job.notificationId, user: { isActive: true, telegram: { isNot: null } } },
    select: {
      userId: true,
      content: true,
      url: true,
      messageKey: true,
      messageParams: true,
      user: { select: { telegram: { select: { telegramId: true } } } },
    },
  });
  const message = settings?.telegramEnabled ? notification : null;
  const token = message && settings && decryptSecret(settings.telegramBotToken, cipherKey);
  const chat = message?.user.telegram && decryptSecret(message.user.telegram.telegramId, cipherKey);
  let retry = false;
  let wait = Math.min(3_600_000, 15_000 * 2 ** (job.attempts - 1));
  if (message && token && /^\d+:[A-Za-z0-9_-]+$/.test(token) && chat && /^-?\d+$/.test(chat)) {
    const url = URL.parse(message.url, siteUrl);
    const safeUrl = url && ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    const preferences = await db.userPreference.findUnique({
      where: { userId: message.userId },
      select: { language: true },
    });
    const language = preferences?.language === 'en' && process.env.ENABLE_ENGLISH_UI === 'TRUE' ? 'en' : 'ko';
    const text = notificationText(
      message.messageKey,
      notificationParams(message.messageParams),
      message.content,
      language,
    );
    try {
      const response = await send(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        body: JSON.stringify({ chat_id: chat, text: `${safeUrl ? `${safeUrl}\n` : ''}${text}`.slice(0, 4_096) }),
        headers: { 'Content-Type': 'application/json' },
        redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
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
    await db.notificationDelivery.updateMany({
      where: { notificationId: job.notificationId, attempts: job.attempts },
      data: { availableAt: new Date(Date.now() + wait) },
    });
  } else {
    await db.notificationDelivery.deleteMany({ where: { notificationId: job.notificationId, attempts: job.attempts } });
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
        if (!(await deliverTelegramNotification(db, siteUrl, cipherKey, send, controller.signal))) break;
      }
      for (let count = 0; count < 4 && !controller.signal.aborted; count += 1) {
        if (!(await deliverPostWebhook(db, siteUrl, controller.signal))) break;
      }
    } catch {
      console.error('BLEX notification delivery polling failed.');
    }
  };
  const timer = setInterval(() => {
    if (!running)
      running = tick().finally(() => {
        running = undefined;
      });
  }, 5_000);
  timer.unref();
  return async () => {
    clearInterval(timer);
    controller.abort();
    await running;
  };
}
