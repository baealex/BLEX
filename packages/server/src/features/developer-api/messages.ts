import type { UiLocale } from '../../platform/locale.js';
import { hasTranslation, translateMessage } from '../../platform/messages.js';

export type DeveloperLocale = UiLocale;

/**
 * Developer API reference and error text, in the token owner's language. Its Korean translations live in the
 * server catalog under `developer.` IDs, apart from site messages that share an English source.
 */
export function developerText(
  locale: DeveloperLocale,
  source: string,
  values: Record<string, string | number> = {},
): string {
  return translateMessage(`developer.${source}`, source, values, locale);
}

export function hasDeveloperText(source: string): boolean {
  return hasTranslation(`developer.${source}`);
}
