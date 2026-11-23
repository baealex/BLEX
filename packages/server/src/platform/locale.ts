export type UiLocale = 'ko' | 'en';

const languages = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
] satisfies Array<{ code: UiLocale; label: string }>;

export function uiLanguageChoices(): Array<{ code: UiLocale; label: string }> {
  return process.env.ENABLE_ENGLISH_UI === 'TRUE' || process.env.DEBUG === 'TRUE' ? languages : languages.slice(0, 1);
}

export function supportedUiLocale(value: string | null | undefined): UiLocale | undefined {
  const language = value?.trim().toLowerCase().split(/[-_]/)[0];
  return uiLanguageChoices().find(({ code }) => code === language)?.code;
}

export function defaultUiLocale(): UiLocale {
  return supportedUiLocale(process.env.BLEX_DEFAULT_LANGUAGE) ?? 'ko';
}

export function resolveUiLocale(userLanguage: string | null | undefined): UiLocale {
  return supportedUiLocale(userLanguage) ?? defaultUiLocale();
}
