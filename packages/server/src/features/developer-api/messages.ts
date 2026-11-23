import { developerKorean } from './locales/ko.js';

export type DeveloperLocale = 'ko' | 'en';
export type DeveloperMessage = keyof typeof developerKorean;

export function developerText(
  locale: DeveloperLocale,
  source: DeveloperMessage,
  values: Record<string, string | number> = {},
): string {
  return translateDeveloperText(locale, source, values);
}

export function translateDeveloperText(
  locale: DeveloperLocale,
  source: string,
  values: Record<string, string | number> = {},
): string {
  const message =
    locale === 'ko' && Object.hasOwn(developerKorean, source) ? developerKorean[source as DeveloperMessage] : source;
  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : placeholder,
  );
}
