export const SUPPORTED_LOCALES = ['ko', 'en'] as const;

export type AppLocale = typeof SUPPORTED_LOCALES[number];

export const DEFAULT_LOCALE: AppLocale = 'ko';

export const normalizeLocale = (locale: string | null | undefined): AppLocale => {
    const language = locale
        ?.trim()
        .toLowerCase()
        .replace('_', '-')
        .split('-')[0];

    return SUPPORTED_LOCALES.includes(language as AppLocale)
        ? language as AppLocale
        : DEFAULT_LOCALE;
};

export const getDocumentLocale = (): AppLocale => {
    if (typeof window === 'undefined') {
        return DEFAULT_LOCALE;
    }

    return normalizeLocale(
        window.configuration?.locale || document.documentElement.lang
    );
};
