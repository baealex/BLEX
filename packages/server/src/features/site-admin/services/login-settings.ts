import type { Prisma, PrismaClient } from '@prisma/client';
import { domainToASCII } from 'node:url';
import { encryptSecret, decryptSecret } from '../../auth/encrypted-secret.js';
import { type AdminLoginSettings } from '../types.js';
import { ApiResult, Body, isRecord, isoDate, recordAudit, stringValue } from '../shared.js';

const SOCIAL_PROVIDERS = [
  { key: 'google', name: 'Google' },
  { key: 'github', name: 'GitHub' },
] as const;

function readLoginRow(db: PrismaClient) {
  return db.loginSetting.findUnique({
    where: { id: 1 },
    select: {
      welcomeNotificationMessage: true,
      welcomeNotificationUrl: true,
      accountDeletionRedirectUrl: true,
      hcaptchaEnabled: true,
      hcaptchaSiteKey: true,
      hcaptchaSecretKey: true,
      updatedAt: true,
    },
  });
}

function readProviders(db: PrismaClient) {
  return db.socialProvider.findMany({
    where: { key: { in: SOCIAL_PROVIDERS.map(({ key }) => key) } },
    select: { key: true, clientId: true, clientSecret: true, isEnabled: true },
  });
}

export async function serializeLoginSettings(db: PrismaClient, cipherKey: string): Promise<AdminLoginSettings> {
  const [row, providerRows] = await Promise.all([readLoginRow(db), readProviders(db)]);
  const providers = new Map(providerRows.map((provider) => [provider.key, provider]));
  const encryptedCaptchaSecret = row?.hcaptchaSecretKey ?? '';
  return {
    welcomeNotificationMessage: row?.welcomeNotificationMessage ?? '',
    welcomeNotificationUrl: row?.welcomeNotificationUrl || '/',
    accountDeletionRedirectUrl: row?.accountDeletionRedirectUrl ?? '',
    hcaptchaEnabled: row?.hcaptchaEnabled ?? false,
    hcaptchaSiteKey: row?.hcaptchaSiteKey.trim() ?? '',
    hcaptchaHasSecretKey: Boolean(encryptedCaptchaSecret && decryptSecret(encryptedCaptchaSecret, cipherKey)),
    updatedDate: isoDate(row?.updatedAt ?? null),
    socialAuthProviders: SOCIAL_PROVIDERS.map(({ key, name }) => {
      const provider = providers.get(key);
      return {
        key,
        name,
        isEnabled: provider?.isEnabled ?? false,
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
  if (normalized.includes('\\'))
    return { ok: false, code: 'VA', message: 'Notification URLs cannot contain backslashes.' };
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
    if (
      !ascii ||
      !/^[A-Za-z0-9._-]+$/.test(ascii) ||
      (ascii.replaceAll('.', '').length > 0 && /^\d+$/.test(ascii.replaceAll('.', '')))
    ) {
      throw new Error('invalid hostname');
    }
    return { ok: true, body: normalized };
  } catch {
    return { ok: false, code: 'VA', message: 'Enter a valid notification URL.' };
  }
}

function encryptUnlessEncrypted(value: string, cipherKey: string): string {
  if (!value) return '';
  return decryptSecret(value, cipherKey) !== null ? value : encryptSecret(value, cipherKey);
}

export async function updateLoginSettings(
  db: PrismaClient,
  userId: number,
  cipherKey: string,
  input: Body,
): Promise<ApiResult<AdminLoginSettings>> {
  const current = await readLoginRow(db);
  const welcomeUrl =
    'welcomeNotificationUrl' in input
      ? validateNotificationUrl(input.welcomeNotificationUrl)
      : { ok: true as const, body: current?.welcomeNotificationUrl || '/' };
  if (!welcomeUrl.ok) return welcomeUrl;

  let hcaptchaEnabled = current?.hcaptchaEnabled ?? false;
  let hcaptchaSiteKey = current?.hcaptchaSiteKey ?? '';
  let hcaptchaSecretKey = current?.hcaptchaSecretKey ?? '';
  if ('hcaptchaEnabled' in input) hcaptchaEnabled = input.hcaptchaEnabled === true;
  if (typeof input.hcaptchaSiteKey === 'string') hcaptchaSiteKey = input.hcaptchaSiteKey.trim();
  if (input.clearHcaptchaSecretKey === true) hcaptchaSecretKey = '';
  if (typeof input.hcaptchaSecretKey === 'string' && input.hcaptchaSecretKey.trim()) {
    hcaptchaSecretKey = encryptUnlessEncrypted(input.hcaptchaSecretKey.trim(), cipherKey);
  }
  if (hcaptchaEnabled && !hcaptchaSiteKey.trim()) {
    return { ok: false, code: 'VA', message: 'Enter an hCaptcha Site Key.' };
  }
  if (hcaptchaEnabled && !decryptSecret(hcaptchaSecretKey, cipherKey)) {
    return { ok: false, code: 'VA', message: 'Enter an hCaptcha Secret Key.' };
  }

  const changes: Prisma.LoginSettingCreateInput = {
    hcaptchaEnabled,
    hcaptchaSiteKey,
    hcaptchaSecretKey,
    updatedAt: new Date(),
  };
  if (typeof input.welcomeNotificationMessage === 'string')
    changes.welcomeNotificationMessage = input.welcomeNotificationMessage;
  if ('welcomeNotificationUrl' in input) changes.welcomeNotificationUrl = welcomeUrl.body;
  if (typeof input.accountDeletionRedirectUrl === 'string')
    changes.accountDeletionRedirectUrl = input.accountDeletionRedirectUrl;

  const supportedPayload = Array.isArray(input.socialAuthProviders) ? input.socialAuthProviders.filter(isRecord) : null;
  await db.$transaction(async (transaction) => {
    await transaction.loginSetting.upsert({
      where: { id: 1 },
      create: { id: 1, ...changes },
      update: changes,
      select: { id: true },
    });

    if (supportedPayload !== null) {
      for (const provider of SOCIAL_PROVIDERS) {
        await transaction.socialProvider.upsert({
          where: { key: provider.key },
          create: { key: provider.key },
          update: {},
          select: { id: true },
        });
      }
      for (const item of supportedPayload) {
        const key = stringValue(item.key);
        if (!SOCIAL_PROVIDERS.some((provider) => provider.key === key)) continue;
        const existing = await transaction.socialProvider.findUnique({
          where: { key },
          select: { clientId: true, clientSecret: true, isEnabled: true },
        });
        if (!existing) continue;
        let { clientId, clientSecret, isEnabled } = existing;
        if ('isEnabled' in item) isEnabled = item.isEnabled === true;
        if (typeof item.clientId === 'string') clientId = item.clientId.trim();
        if (typeof item.clientSecret === 'string' && item.clientSecret) {
          const trimmed = item.clientSecret.trim();
          clientSecret = trimmed ? encryptUnlessEncrypted(trimmed, cipherKey) : '';
        }
        if (item.clearClientSecret === true) clientSecret = '';
        await transaction.socialProvider.update({
          where: { key },
          data: { isEnabled, clientId, clientSecret },
          select: { id: true },
        });
      }
    }
    await recordAudit(transaction, userId, 'loginsetting', 'Login settings', 'Updated login and security settings');
  });
  return { ok: true, body: await serializeLoginSettings(db, cipherKey) };
}
