import { Prisma, type PrismaClient } from '@prisma/client';
import { domainToASCII } from 'node:url';
import { encryptDjangoSecret, decryptDjangoSecret } from '../../auth/django-secret.js';
import { type AdminLoginSettings } from '../types.js';
import { ApiResult, Body, booleanValue, djangoTimestamp, isRecord, isoDate, recordAudit, stringValue } from '../shared.js';

const SOCIAL_PROVIDERS = [
  { key: 'google', name: 'Google' },
  { key: 'github', name: 'GitHub' },
] as const;

interface LoginRow {
  welcomeMessage: string | null;
  welcomeUrl: string | null;
  deletionRedirectUrl: string | null;
  hcaptchaEnabled: number | bigint | boolean;
  hcaptchaSiteKey: string | null;
  hcaptchaSecretKey: string | null;
  updatedDate: string | null;
}

interface ProviderRow {
  key: string;
  clientId: string | null;
  clientSecret: string | null;
  isEnabled: number | bigint | boolean;
}

async function readLoginRow(db: PrismaClient): Promise<LoginRow | null> {
  const [row] = await db.$queryRaw<LoginRow[]>`
    SELECT welcome_notification_message AS welcomeMessage,
           welcome_notification_url AS welcomeUrl,
           account_deletion_redirect_url AS deletionRedirectUrl,
           hcaptcha_enabled AS hcaptchaEnabled, hcaptcha_site_key AS hcaptchaSiteKey,
           hcaptcha_secret_key AS hcaptchaSecretKey, CAST(updated_date AS TEXT) AS updatedDate
      FROM board_loginsetting WHERE id = 1 LIMIT 1
  `;
  return row ?? null;
}

async function readProviders(db: PrismaClient): Promise<ProviderRow[]> {
  return db.$queryRaw<ProviderRow[]>`
    SELECT key, client_id AS clientId, client_secret AS clientSecret, is_enabled AS isEnabled
      FROM board_socialauthprovider WHERE key IN ('google', 'github')
  `;
}

export async function serializeLoginSettings(db: PrismaClient, cipherKey: string): Promise<AdminLoginSettings> {
  const [row, providerRows] = await Promise.all([readLoginRow(db), readProviders(db)]);
  const providers = new Map(providerRows.map((provider) => [provider.key, provider]));
  const encryptedCaptchaSecret = row?.hcaptchaSecretKey ?? '';
  return {
    welcomeNotificationMessage: row?.welcomeMessage ?? '',
    welcomeNotificationUrl: row?.welcomeUrl || '/',
    accountDeletionRedirectUrl: row?.deletionRedirectUrl ?? '',
    hcaptchaEnabled: row ? booleanValue(row.hcaptchaEnabled) : false,
    hcaptchaSiteKey: row?.hcaptchaSiteKey?.trim() ?? '',
    hcaptchaHasSecretKey: Boolean(encryptedCaptchaSecret && decryptDjangoSecret(encryptedCaptchaSecret, cipherKey)),
    updatedDate: isoDate(row?.updatedDate ?? null),
    socialAuthProviders: SOCIAL_PROVIDERS.map(({ key, name }) => {
      const provider = providers.get(key);
      return {
        key,
        name,
        isEnabled: provider ? booleanValue(provider.isEnabled) : false,
        clientId: provider?.clientId ?? '',
        hasClientSecret: Boolean(provider?.clientSecret),
      };
    }),
  };
}

function validateNotificationUrl(value: unknown): ApiResult<string> {
  if (typeof value !== 'string') return { ok: false, code: 'VA', message: 'Enter a valid notification URL.' };
  const normalized = value.trim();
  if ([...normalized].some((character) => character.charCodeAt(0) < 32)) {
    return { ok: false, code: 'VA', message: 'Notification URLs cannot contain control characters.' };
  }
  if (normalized.includes('\\')) return { ok: false, code: 'VA', message: 'Notification URLs cannot contain backslashes.' };
  const scheme = normalized.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)?.[1]?.toLowerCase() ?? '';
  if (scheme && scheme !== 'http' && scheme !== 'https') {
    return { ok: false, code: 'VA', message: 'Notification URLs must be a relative path or an HTTP(S) URL.' };
  }
  const absolute = scheme ? normalized : normalized.startsWith('//') ? `https:${normalized}` : '';
  if (!absolute) return { ok: true, body: normalized };
  try {
    const parsed = new URL(absolute);
    if (!parsed.hostname) throw new Error('missing hostname');
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    if (hostname.includes(':')) return { ok: true, body: normalized };
    const ascii = domainToASCII(hostname);
    if (!ascii || !/^[A-Za-z0-9._-]+$/.test(ascii) || ascii.replaceAll('.', '').length > 0 && /^\d+$/.test(ascii.replaceAll('.', ''))) {
      throw new Error('invalid hostname');
    }
    return { ok: true, body: normalized };
  } catch {
    return { ok: false, code: 'VA', message: 'Enter a valid notification URL.' };
  }
}

function encryptSecret(value: string, cipherKey: string): string {
  if (!value) return '';
  return decryptDjangoSecret(value, cipherKey) !== null ? value : encryptDjangoSecret(value, cipherKey);
}

async function ensureLoginSetting(db: Prisma.TransactionClient): Promise<void> {
  await db.$executeRaw`
    INSERT OR IGNORE INTO board_loginsetting (
      id, welcome_notification_message, welcome_notification_url, account_deletion_redirect_url,
      hcaptcha_enabled, hcaptcha_site_key, hcaptcha_secret_key, updated_date
    ) VALUES (1, '', '/', '', 0, '', '', ${djangoTimestamp()})
  `;
}

export async function updateLoginSettings(
  db: PrismaClient,
  userId: number,
  cipherKey: string,
  input: Body,
): Promise<ApiResult<AdminLoginSettings>> {
  const current = await readLoginRow(db);
  const welcomeUrl = 'welcome_notification_url' in input
    ? validateNotificationUrl(input.welcome_notification_url)
    : { ok: true as const, body: current?.welcomeUrl || '/' };
  if (!welcomeUrl.ok) return welcomeUrl;

  let hcaptchaEnabled = current ? booleanValue(current.hcaptchaEnabled) : false;
  let hcaptchaSiteKey = current?.hcaptchaSiteKey ?? '';
  let hcaptchaSecretKey = current?.hcaptchaSecretKey ?? '';
  if ('hcaptcha_enabled' in input) hcaptchaEnabled = input.hcaptcha_enabled === true;
  if (typeof input.hcaptcha_site_key === 'string') hcaptchaSiteKey = input.hcaptcha_site_key.trim();
  if (input.clear_hcaptcha_secret_key === true) hcaptchaSecretKey = '';
  if (typeof input.hcaptcha_secret_key === 'string' && input.hcaptcha_secret_key.trim()) {
    hcaptchaSecretKey = encryptSecret(input.hcaptcha_secret_key.trim(), cipherKey);
  }
  if (hcaptchaEnabled && !hcaptchaSiteKey.trim()) {
    return { ok: false, code: 'VA', message: 'Enter an hCaptcha Site Key.' };
  }
  if (hcaptchaEnabled && !decryptDjangoSecret(hcaptchaSecretKey, cipherKey)) {
    return { ok: false, code: 'VA', message: 'Enter an hCaptcha Secret Key.' };
  }

  const supportedPayload = Array.isArray(input.social_auth_providers) ? input.social_auth_providers.filter(isRecord) : null;
  try {
    await db.$transaction(async (transaction) => {
      await ensureLoginSetting(transaction);
      const updates: Prisma.Sql[] = [
        Prisma.sql`updated_date = ${djangoTimestamp()}`,
        Prisma.sql`hcaptcha_enabled = ${hcaptchaEnabled ? 1 : 0}`,
        Prisma.sql`hcaptcha_site_key = ${hcaptchaSiteKey}`,
        Prisma.sql`hcaptcha_secret_key = ${hcaptchaSecretKey}`,
      ];
      if (typeof input.welcome_notification_message === 'string') updates.push(Prisma.sql`welcome_notification_message = ${input.welcome_notification_message}`);
      if ('welcome_notification_url' in input) updates.push(Prisma.sql`welcome_notification_url = ${welcomeUrl.body}`);
      if (typeof input.account_deletion_redirect_url === 'string') updates.push(Prisma.sql`account_deletion_redirect_url = ${input.account_deletion_redirect_url}`);
      await transaction.$executeRaw(Prisma.sql`UPDATE board_loginsetting SET ${Prisma.join(updates, ', ')} WHERE id = 1`);

      if (supportedPayload !== null) {
        for (const provider of SOCIAL_PROVIDERS) {
          await transaction.$executeRaw`
            INSERT OR IGNORE INTO board_socialauthprovider (key, client_id, client_secret, is_enabled)
            VALUES (${provider.key}, '', '', 0)
          `;
        }
        for (const item of supportedPayload) {
          const key = stringValue(item.key);
          if (!SOCIAL_PROVIDERS.some((provider) => provider.key === key)) continue;
          const [existing] = await transaction.$queryRaw<ProviderRow[]>`
            SELECT key, client_id AS clientId, client_secret AS clientSecret, is_enabled AS isEnabled
              FROM board_socialauthprovider WHERE key = ${key} LIMIT 1
          `;
          if (!existing) continue;
          let clientId = existing.clientId ?? '';
          let clientSecret = existing.clientSecret ?? '';
          let isEnabled = booleanValue(existing.isEnabled);
          if ('is_enabled' in item) isEnabled = item.is_enabled === true;
          if (typeof item.client_id === 'string') clientId = item.client_id.trim();
          if (typeof item.client_secret === 'string' && item.client_secret) {
            const trimmed = item.client_secret.trim();
            clientSecret = trimmed ? encryptSecret(trimmed, cipherKey) : '';
          }
          if (item.clear_client_secret === true) clientSecret = '';
          await transaction.$executeRaw`
            UPDATE board_socialauthprovider SET is_enabled = ${isEnabled ? 1 : 0}, client_id = ${clientId}, client_secret = ${clientSecret}
             WHERE key = ${key}
          `;
        }
      }
      await recordAudit(transaction, userId, 'loginsetting', 'Login settings', 'Updated login and security settings');
    });
  } catch (error) {
    throw error;
  }
  return { ok: true, body: await serializeLoginSettings(db, cipherKey) };
}

