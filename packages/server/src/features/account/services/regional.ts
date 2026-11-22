import type { PrismaClient } from '@prisma/client';
import { type RegionalPreferences } from '../types.js';
import { Body, UpdateResult } from '../shared.js';

type RegionalConfig = { language: string | null; timeZone: string };

const DEFAULT_LANGUAGE = 'ko';

const DEFAULT_LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: '영어' },
];

const DEFAULT_TIME_ZONE = process.env.TZ || 'Asia/Seoul';

function languageChoices(): Array<{ code: string; label: string }> {
  const englishEnabled = process.env.DEBUG === 'TRUE' || process.env.ENABLE_ENGLISH_UI === 'TRUE';
  return englishEnabled ? DEFAULT_LANGUAGES : DEFAULT_LANGUAGES.slice(0, 1);
}

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

function normalizedLanguage(value: string | null, languages: Array<{ code: string }>): string {
  return value && languages.some(({ code }) => code === value) ? value : '';
}

function normalizedTimeZone(value: string | null): string {
  return value && isSupportedTimeZone(value) ? value : '';
}

export function accountDate(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: isSupportedTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const fields = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
    return `${fields.year}-${fields.month}-${fields.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function regionalPreferences(config: RegionalConfig | null): RegionalPreferences {
  const languages = languageChoices();
  const timeZones = [...availableTimeZones];
  if (config?.timeZone && isSupportedTimeZone(config.timeZone) && !timeZones.includes(config.timeZone)) {
    timeZones.push(config.timeZone);
    timeZones.sort();
  }
  return {
    language: config === null || config.language === null ? null : normalizedLanguage(config.language, languages),
    timeZone: normalizedTimeZone(config?.timeZone ?? null),
    defaultLanguage: DEFAULT_LANGUAGE,
    defaultTimeZone: DEFAULT_TIME_ZONE,
    languages,
    timeZones,
  };
}

function regionalError(field: 'language' | 'timeZone'): UpdateResult {
  return field === 'language'
    ? { ok: false, message: '지원하는 언어를 선택하세요.', messageKey: 'settings.regional_preferences.invalid_language' }
    : { ok: false, message: '유효한 시간대를 선택하세요.', messageKey: 'settings.regional_preferences.invalid_time_zone' };
}

export async function updateRegionalPreferences(db: PrismaClient, userId: number, body: Body): Promise<UpdateResult> {
  const language = body.language;
  const timeZone = body.timeZone;
  const languages = languageChoices();
  if (language !== null && language !== '' && (typeof language !== 'string' || !languages.some(({ code }) => code === language))) {
    return regionalError('language');
  }
  if (typeof timeZone !== 'string' || (timeZone !== '' && !isSupportedTimeZone(timeZone))) {
    return regionalError('timeZone');
  }
  const preference = { language: language as string | null, timeZone };
  await db.userPreference.upsert({ where: { userId }, create: { userId, ...preference }, update: preference, select: { userId: true } });
  return { ok: true };
}
