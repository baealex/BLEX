import formBody from '@fastify/formbody';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { formInput } from '../../platform/csrf.js';
import { decryptSecret, encryptSecret } from '../auth/encrypted-secret.js';
import { done, failure } from '../../platform/response.js';

interface TelegramOptions {
  currentUser: (request: FastifyRequest) => Promise<{
    id: number;
    username: string;
    hasEditorRole?: boolean;
    isStaff?: boolean;
    hasConnectedTelegram: boolean;
    notifyCount?: number;
  } | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
  cipherKey: string;
  secretKey: string;
  fetchProvider?: typeof fetch;
}

const tokenChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function telegramWebhookSecret(secretKey: string, botToken: string) {
  return createHmac('sha256', secretKey).update(`telegram-webhook:${botToken}`).digest('hex');
}

async function telegramConfig(db: PrismaClient, cipherKey: string) {
  const row = await db.integrationSetting.findUnique({
    where: { id: 1 },
    select: { telegramBotUsername: true, telegramBotToken: true, telegramEnabled: true },
  });
  const decrypted = row?.telegramEnabled ? decryptSecret(row.telegramBotToken, cipherKey) : null;
  const token = decrypted && /^\d+:[a-zA-Z0-9_-]+$/.test(decrypted) ? decrypted : '';
  const username = row?.telegramBotUsername.trim() ?? '';
  return { username, token, configured: Boolean(token && /^[a-zA-Z0-9_]{1,64}$/.test(username)) };
}

async function issueConnection(db: PrismaClient, userId: number, username: string) {
  const code = await db.$transaction(async (tx) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = Array.from({ length: 6 }, () => tokenChars[randomInt(tokenChars.length)]).join('');
      if (await tx.telegramConnection.findFirst({ where: { authToken: code }, select: { userId: true } })) continue;
      const now = Date.now();
      const authTokenExpiresAt = new Date(now + 86_400_000);
      // Reissuing a code leaves telegramId alone, so a connected account stays connected until the new code is used.
      await tx.telegramConnection.upsert({
        where: { userId },
        create: { userId, authToken: code, authTokenExpiresAt, createdAt: new Date(now) },
        update: { authToken: code, authTokenExpiresAt },
      });
      return code;
    }
    throw new Error('Could not allocate a Telegram connection token');
  });
  const link = `https://t.me/${username}?start=${code}`;
  return { token: code, link, qrCode: await QRCode.toDataURL(link, { margin: 2 }) };
}

function extractMessage(input: Record<string, unknown>) {
  const message = input.message;
  if (!message || typeof message !== 'object' || !('from' in message) || !('text' in message)) return null;
  const from = message.from;
  if (!from || typeof from !== 'object' || !('id' in from)) return null;
  const sender = from.id;
  const chatId = typeof sender === 'number' && Number.isSafeInteger(sender) ? String(sender) : sender;
  if (typeof chatId !== 'string' || !/^\d{1,16}$/.test(chatId)) return null;
  const parts = typeof message.text === 'string' ? message.text.trim().split(/\s+/) : [];
  const source =
    parts[0]?.split('@')[0] === '/start' && parts.length === 2 ? parts[1] : parts.length === 1 ? parts[0] : '';
  return { chatId, code: /^[a-zA-Z0-9]{6}$/.test(source) ? source : '' };
}

async function handleBotLink(
  db: PrismaClient,
  options: TelegramOptions,
  botToken: string,
  message: NonNullable<ReturnType<typeof extractMessage>>,
) {
  let text = `BLEX를 둘러보세요.\n\n${options.siteUrl.origin}`;
  if (message.code) {
    const pending = await db.telegramConnection.findFirst({
      where: { authToken: message.code, user: { isActive: true } },
      orderBy: { userId: 'asc' },
      select: { userId: true, authTokenExpiresAt: true },
    });
    if (pending) {
      const isValid = Boolean(pending.authTokenExpiresAt && pending.authTokenExpiresAt > new Date());
      // Matching the code again makes it single-use when the same code arrives twice.
      const { count } = await db.telegramConnection.updateMany({
        where: { userId: pending.userId, authToken: message.code },
        data: {
          authToken: '',
          authTokenExpiresAt: null,
          ...(isValid ? { telegramId: encryptSecret(message.chatId, options.cipherKey) } : {}),
        },
      });
      if (count)
        text = isValid ? '텔레그램을 연결했습니다.' : '연결 코드가 만료되었습니다. 사이트에서 다시 발급해 주세요.';
    }
  }
  try {
    const response = await (options.fetchProvider ?? fetch)(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      body: JSON.stringify({ chat_id: message.chatId, text }),
      headers: { 'Content-Type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
    });
    await response.body?.cancel();
  } catch {
    // The account link persists even when Telegram cannot deliver the confirmation.
  }
}

export function registerTelegram(app: FastifyInstance, db: PrismaClient, options: TelegramOptions) {
  app.register(async (routes) => {
    await routes.register(formBody);
    routes.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
    });
    routes.post(
      '/v1/telegram/webHook',
      { bodyLimit: 64 * 1024, config: { bodyAccess: 'public' } },
      async (request, reply) => {
        const config = await telegramConfig(db, options.cipherKey);
        if (!config.token) return done();
        const supplied = request.headers['x-telegram-bot-api-secret-token'];
        const expected = telegramWebhookSecret(options.secretKey, config.token);
        if (
          typeof supplied !== 'string' ||
          !/^[a-f0-9]{64}$/.test(supplied) ||
          !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
        ) {
          return reply.code(403).send('Forbidden');
        }
        const message = extractMessage(formInput(request));
        if (message) await handleBotLink(db, options, config.token, message);
        return done();
      },
    );

    routes.get('/v1/setting/integration-telegram', async (request) => {
      const user = await options.currentUser(request);
      if (!user) return failure('NL');
      const config = await telegramConfig(db, options.cipherKey);
      return done({
        isConnected: user.hasConnectedTelegram,
        isConfigured: config.configured,
        botUsername: config.configured ? config.username : '',
      });
    });

    for (const action of ['makeToken', 'unsync'] as const) {
      routes.post(`/v1/telegram/${action}`, async (request, reply) => {
        const user = await options.currentUser(request);
        if (!user) return failure('NL');
        if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
        if (action === 'unsync') {
          const { count } = await db.telegramConnection.deleteMany({
            where: { userId: user.id, telegramId: { not: '' } },
          });
          return count ? done() : failure('AU', '이미 연동이 해제되었습니다.');
        }
        const config = await telegramConfig(db, options.cipherKey);
        return config.configured
          ? done(await issueConnection(db, user.id, config.username))
          : failure('NT', '텔레그램 봇이 설정되지 않았습니다.');
      });
    }
  });
}
