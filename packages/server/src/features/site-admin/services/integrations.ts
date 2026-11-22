import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createHmac } from 'node:crypto';
import { encryptDjangoSecret, decryptDjangoSecret } from '../../auth/django-secret.js';
import { adminSettingsCapabilities, type UserAccess } from '../access.js';
import { renderAdminIntegrationSettings, type AdminIntegrationSettings, type AdminSettingsUser } from '../pages.js';
import { failure } from '../../../platform/response.js';
import { AdminSettingsOptions, ApiResult, Body, booleanValue, csrfToken, djangoTimestamp, formBoolean, isRecord, isoDate, pageNumber, recordAudit, stringValue } from '../shared.js';

interface IntegrationRow {
  telegramEnabled: number | bigint | boolean;
  telegramBotUsername: string | null;
  telegramBotToken: string | null;
  updatedDate: string | null;
}

async function ensureIntegrationSetting(db: Prisma.TransactionClient): Promise<void> {
  await db.$executeRaw`
    INSERT OR IGNORE INTO board_integrationsetting (id, telegram_enabled, telegram_bot_username, telegram_bot_token, updated_date)
    VALUES (1, 0, '', '', ${djangoTimestamp()})
  `;
}

async function readIntegrationRow(db: PrismaClient): Promise<IntegrationRow | null> {
  const [row] = await db.$queryRaw<IntegrationRow[]>`
    SELECT telegram_enabled AS telegramEnabled, telegram_bot_username AS telegramBotUsername,
      telegram_bot_token AS telegramBotToken, CAST(updated_date AS TEXT) AS updatedDate
    FROM board_integrationsetting WHERE id = 1 LIMIT 1
  `;
  return row ?? null;
}

function connection(state: string, detail = ''): AdminIntegrationSettings['telegramConnection'] {
  return { state, detail };
}

function telegramWebhookSecret(botToken: string, secretKey: string): string {
  return createHmac('sha256', secretKey).update(`telegram-webhook:${botToken}`).digest('hex');
}

async function callTelegramApi(
  options: AdminSettingsOptions,
  botToken: string,
  method: string,
  payload?: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const fetcher = options.fetchProvider ?? fetch;
  try {
    const response = await fetcher(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: payload ? 'POST' : 'GET',
      ...(payload ? {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      } : {}),
      signal: AbortSignal.timeout(5000),
    });
    const data: unknown = await response.json();
    return isRecord(data) ? data : null;
  } catch {
    return null;
  }
}

function telegramFailure(data: Record<string, unknown> | null): AdminIntegrationSettings['telegramConnection'] | null {
  if (!data) return connection('unreachable');
  if (data.ok === true) return null;
  const code = Number(data.error_code);
  if (code === 401 || code === 404) return connection('invalid_token');
  return connection('rejected', typeof data.description === 'string' ? data.description : '');
}

async function confirmTelegramBot(
  options: AdminSettingsOptions,
  botToken: string,
): Promise<{ failure: AdminIntegrationSettings['telegramConnection'] | null; username?: string }> {
  const result = await callTelegramApi(options, botToken, 'getMe');
  const failure = telegramFailure(result);
  if (failure) return { failure };
  const profile = isRecord(result?.result) ? result.result : {};
  const username = typeof profile.username === 'string' ? profile.username.trim().replace(/^@+/, '') : '';
  return { failure: null, ...(username ? { username } : {}) };
}

async function inspectTelegramConnection(
  options: AdminSettingsOptions,
  setting: IntegrationRow,
  webhookUrl: string,
): Promise<AdminIntegrationSettings['telegramConnection']> {
  const token = booleanValue(setting.telegramEnabled)
    ? decryptDjangoSecret(setting.telegramBotToken ?? '', options.cipherKey) ?? ''
    : '';
  if (!token) return connection('disabled');
  if (!(setting.telegramBotUsername ?? '').trim()) return connection('not_connected');
  const result = await callTelegramApi(options, token, 'getWebhookInfo');
  const failure = telegramFailure(result);
  if (failure) return failure;
  const webhook = isRecord(result?.result) ? result.result : {};
  if (webhook.url !== webhookUrl) return connection('not_connected');
  if (webhook.pending_update_count && webhook.last_error_message) {
    return connection('delivery_failed', String(webhook.last_error_message));
  }
  return connection('connected');
}

export async function serializeIntegrationSettings(
  db: PrismaClient,
  options: AdminSettingsOptions,
): Promise<AdminIntegrationSettings> {
  await db.$transaction((transaction) => ensureIntegrationSetting(transaction));
  const row = await readIntegrationRow(db);
  const setting: IntegrationRow = row ?? {
    telegramEnabled: false,
    telegramBotUsername: '',
    telegramBotToken: '',
    updatedDate: '',
  };
  const webhookUrl = new URL('/v1/telegram/webHook', options.siteUrl).href;
  return {
    telegramEnabled: booleanValue(setting.telegramEnabled),
    telegramBotUsername: (setting.telegramBotUsername ?? '').trim(),
    telegramHasBotToken: Boolean(decryptDjangoSecret(setting.telegramBotToken ?? '', options.cipherKey)),
    updatedDate: isoDate(setting.updatedDate),
    telegramConnection: await inspectTelegramConnection(options, setting, webhookUrl),
  };
}

export function integrationSettingsApi(settings: AdminIntegrationSettings): Record<string, unknown> {
  return {
    telegram_enabled: settings.telegramEnabled,
    telegram_bot_username: settings.telegramBotUsername,
    telegram_has_bot_token: settings.telegramHasBotToken,
    updated_date: settings.updatedDate,
    telegram_connection: settings.telegramConnection,
  };
}

export function pageIntegrationPayload(body: Body): Body {
  return {
    telegram_enabled: formBoolean(body.telegram_enabled),
    telegram_bot_username: stringValue(body.telegram_bot_username),
    telegram_bot_token: stringValue(body.telegram_bot_token),
    clear_telegram_bot_token: formBoolean(body.clear_telegram_bot_token),
  };
}

export async function updateIntegrationSettings(
  db: PrismaClient,
  userId: number,
  input: Body,
  options: AdminSettingsOptions,
): Promise<ApiResult<AdminIntegrationSettings>> {
  await db.$transaction((transaction) => ensureIntegrationSetting(transaction));
  const current = await readIntegrationRow(db);
  let enabled = current ? booleanValue(current.telegramEnabled) : false;
  let username = current?.telegramBotUsername ?? '';
  let tokenCiphertext = current?.telegramBotToken ?? '';
  if ('telegram_enabled' in input) enabled = input.telegram_enabled === true;
  if ('telegram_bot_username' in input) {
    username = typeof input.telegram_bot_username === 'string'
      ? input.telegram_bot_username.trim().replace(/^@+/, '')
      : '';
  }
  if (input.clear_telegram_bot_token === true) tokenCiphertext = '';
  if (typeof input.telegram_bot_token === 'string' && input.telegram_bot_token.trim()) {
    const botToken = input.telegram_bot_token.trim();
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
      return { ok: false, code: 'VA', message: 'Enter a valid Telegram bot token.' };
    }
    const existingToken = decryptDjangoSecret(current?.telegramBotToken ?? '', options.cipherKey) ?? '';
    const isNewToken = botToken !== existingToken;
    tokenCiphertext = encryptDjangoSecret(botToken, options.cipherKey);
    if (isNewToken && !('telegram_bot_username' in input)) username = '';
  }
  const botToken = decryptDjangoSecret(tokenCiphertext, options.cipherKey) ?? '';
  if (enabled && !botToken) return { ok: false, code: 'VA', message: 'Enter a Telegram bot token.' };

  let botFailure: AdminIntegrationSettings['telegramConnection'] | null = null;
  if (enabled) {
    const confirmed = await confirmTelegramBot(options, botToken);
    botFailure = confirmed.failure;
    if (botFailure?.state === 'invalid_token') {
      return { ok: false, code: 'VA', message: 'Telegram rejected this bot token. Check the token and try again.' };
    }
    if (!botFailure && confirmed.username) username = confirmed.username;
  }

  const timestamp = djangoTimestamp();
  await db.$transaction(async (transaction) => {
    await ensureIntegrationSetting(transaction);
    await transaction.$executeRaw`
      UPDATE board_integrationsetting SET telegram_enabled = ${enabled ? 1 : 0},
        telegram_bot_username = ${username}, telegram_bot_token = ${tokenCiphertext}, updated_date = ${timestamp}
      WHERE id = 1
    `;
    await recordAudit(transaction, userId, 'integrationsetting', 'Integration settings', 'Updated notification integration settings');
  });

  let connectionResult: AdminIntegrationSettings['telegramConnection'];
  if (!enabled) connectionResult = connection('disabled');
  else if (botFailure) connectionResult = botFailure;
  else {
    const webhookUrl = new URL('/v1/telegram/webHook', options.siteUrl).href;
    const registered = await callTelegramApi(options, botToken, 'setWebhook', {
      url: webhookUrl,
      secret_token: telegramWebhookSecret(botToken, options.secretKey),
      allowed_updates: ['message'],
    });
    connectionResult = telegramFailure(registered) ?? connection('connected');
  }
  return {
    ok: true,
    body: {
      telegramEnabled: enabled,
      telegramBotUsername: username.trim(),
      telegramHasBotToken: Boolean(botToken),
      updatedDate: isoDate(timestamp),
      telegramConnection: connectionResult,
    },
  };
}

export async function pageIntegrationSettings(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: AdminSettingsOptions,
  user: AdminSettingsUser,
  access: UserAccess,
  error?: string,
) {
  const settings = await serializeIntegrationSettings(db, options);
  return reply.type('text/html; charset=utf-8').send(renderAdminIntegrationSettings({
    user,
    capabilities: adminSettingsCapabilities(access),
    settings,
    csrfToken: csrfToken(request),
    saved: !error && pageNumber(request).get('saved') === '1',
    error,
  }));
}
