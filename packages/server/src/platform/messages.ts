import { readFileSync } from 'node:fs';
import { requestLocale } from './request-locale.js';
import type { UiLocale } from './locale.js';

const koreanMessages = JSON.parse(
  readFileSync(new URL('../../../data/ui-messages.ko.json', import.meta.url), 'utf8'),
) as Record<string, string>;

/** Format product messages; interpolation values are kept exactly as supplied. */
export function systemMessage(
  message: string,
  values: Record<string, unknown> = {},
  id = `server.${message}`,
  locale: UiLocale = requestLocale(),
): string {
  const translated = locale === 'ko' ? (koreanMessages[id] ?? message) : message;
  return translated.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? String(values[key] ?? '') : placeholder,
  );
}
