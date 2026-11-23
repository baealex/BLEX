import type { PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { encryptSecret, decryptSecret } from '../../auth/encrypted-secret.js';
import { type AdminIntegrationSettings } from '../types.js';
import { AdminSettingsOptions, ApiResult, Body, isRecord, isoDate, recordAudit } from '../shared.js';

function readIntegrationRow(db: PrismaClient) {
  return db.integrationSetting.findUnique({
    where: { id: 1 },
    select: { telegramEnabled: true, telegramBotUsername: true, telegramBotToken: true, updatedAt: true },
  });
}

type IntegrationRow = NonNullable<Awaited<ReturnType<typeof readIntegrationRow>>>;

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
      ...(payload
        ? {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          }
        : {}),
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
  setting: Omit<IntegrationRow, 'updatedAt'>,
  webhookUrl: string,
): Promise<AdminIntegrationSettings['telegramConnection']> {
  const token = setting.telegramEnabled ? (decryptSecret(setting.telegramBotToken, options.cipherKey) ?? '') : '';
  if (!token) return connection('disabled');
  if (!setting.telegramBotUsername.trim()) return connection('not_connected');
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
  const row = await readIntegrationRow(db);
  const setting = row ?? { telegramEnabled: false, telegramBotUsername: '', telegramBotToken: '', updatedAt: null };
  const webhookUrl = new URL('/v1/telegram/webHook', options.siteUrl).href;
  return {
    telegramEnabled: setting.telegramEnabled,
    telegramBotUsername: setting.telegramBotUsername.trim(),
    telegramHasBotToken: Boolean(decryptSecret(setting.telegramBotToken, options.cipherKey)),
    updatedDate: isoDate(setting.updatedAt),
    telegramConnection: await inspectTelegramConnection(options, setting, webhookUrl),
  };
}

export async function updateIntegrationSettings(
  db: PrismaClient,
  userId: number,
  input: Body,
  options: AdminSettingsOptions,
): Promise<ApiResult<AdminIntegrationSettings>> {
  const current = await readIntegrationRow(db);
  let enabled = current?.telegramEnabled ?? false;
  let username = current?.telegramBotUsername ?? '';
  let tokenCiphertext = current?.telegramBotToken ?? '';
  if ('telegramEnabled' in input) enabled = input.telegramEnabled === true;
  if ('telegramBotUsername' in input) {
    username = typeof input.telegramBotUsername === 'string' ? input.telegramBotUsername.trim().replace(/^@+/, '') : '';
  }
  if (input.clearTelegramBotToken === true) tokenCiphertext = '';
  if (typeof input.telegramBotToken === 'string' && input.telegramBotToken.trim()) {
    const submittedToken = input.telegramBotToken.trim();
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(submittedToken)) {
      return { ok: false, code: 'VA', message: 'Enter a valid Telegram bot token.' };
    }
    const existingToken = decryptSecret(current?.telegramBotToken ?? '', options.cipherKey) ?? '';
    const isNewToken = submittedToken !== existingToken;
    tokenCiphertext = encryptSecret(submittedToken, options.cipherKey);
    if (isNewToken && !('telegramBotUsername' in input)) username = '';
  }
  const botToken = decryptSecret(tokenCiphertext, options.cipherKey) ?? '';
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

  const saved = await db.$transaction(async (transaction) => {
    const changes = {
      telegramEnabled: enabled,
      telegramBotUsername: username,
      telegramBotToken: tokenCiphertext,
      updatedAt: new Date(),
    };
    const row = await transaction.integrationSetting.upsert({
      where: { id: 1 },
      create: { id: 1, ...changes },
      update: changes,
      select: { updatedAt: true },
    });
    await recordAudit(
      transaction,
      userId,
      'integrationsetting',
      'Integration settings',
      'Updated notification integration settings',
    );
    return row;
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
      updatedDate: isoDate(saved.updatedAt),
      telegramConnection: connectionResult,
    },
  };
}
