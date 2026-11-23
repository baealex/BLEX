import { systemMessage } from '../../../platform/messages.js';
import type { PrismaClient } from '@prisma/client';
import type { RegionalPreferences } from '../types.js';
import type { Body, UpdateResult } from '../shared.js';
import { defaultUiLocale, supportedUiLocale, uiLanguageChoices } from '../../../platform/locale.js';

type RegionalConfig = { language: string | null; timeZone: string };

const DEFAULT_TIME_ZONE = process.env.TZ || 'Asia/Seoul';

function timeZoneChoices(): string[] {
  let zones: string[] = [];
  try {
    if (typeof Intl.supportedValuesOf === 'function') zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = [];
  }
  return [...new Set([...zones, 'UTC'])].filter((zone) => zone !== 'Factory' && zone !== 'localtime').sort();
}

const availableTimeZones = timeZoneChoices();

const supportedZones = new Set(availableTimeZones);

function isSupportedTimeZone(value: string): boolean {
  if (!value || value.length > 64) return false;
  if (supportedZones.has(value)) return true;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function normalizedTimeZone(value: string | null): string {
  return value && isSupportedTimeZone(value) ? value : '';
}

export function accountDate(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: isSupportedTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const fields = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
    return `${fields.year}-${fields.month}-${fields.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function regionalPreferences(config: RegionalConfig | null): RegionalPreferences {
  const languages = uiLanguageChoices();
  const timeZones = [...availableTimeZones];
  if (config?.timeZone && isSupportedTimeZone(config.timeZone) && !timeZones.includes(config.timeZone)) {
    timeZones.push(config.timeZone);
    timeZones.sort();
  }
  return {
    language: config === null || config.language === null ? null : (supportedUiLocale(config.language) ?? ''),
    timeZone: normalizedTimeZone(config?.timeZone ?? null),
    defaultLanguage: defaultUiLocale(),
    defaultTimeZone: DEFAULT_TIME_ZONE,
    languages,
    timeZones,
  };
}

function regionalError(field: 'language' | 'timeZone'): UpdateResult {
  return field === 'language'
    ? {
        ok: false,
        message: systemMessage('Select a supported language.'),
        messageKey: 'settings.regional_preferences.invalid_language',
      }
    : {
        ok: false,
        message: systemMessage('Select a valid time zone.'),
        messageKey: 'settings.regional_preferences.invalid_time_zone',
      };
}

export async function updateRegionalPreferences(db: PrismaClient, userId: number, body: Body): Promise<UpdateResult> {
  const language = body.language;
  const timeZone = body.timeZone;
  const languages = uiLanguageChoices();
  if (
    language !== null &&
    language !== '' &&
    (typeof language !== 'string' || !languages.some(({ code }) => code === language))
  ) {
    return regionalError('language');
  }
  if (typeof timeZone !== 'string' || (timeZone !== '' && !isSupportedTimeZone(timeZone))) {
    return regionalError('timeZone');
  }
  const preference = { language: language as string | null, timeZone };
  await db.userPreference.upsert({
    where: { userId },
    create: { userId, ...preference },
    update: preference,
    select: { userId: true },
  });
  return { ok: true };
}
