export const SUPPORTED_LOCALES = ['ko', 'en'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'ko';

let renderingLocale: AppLocale | undefined;

/** SSR renders synchronously; restore the previous locale before another request can render. */
export function withDocumentLocale<T>(locale: AppLocale, render: () => T): T {
    const previous = renderingLocale;
    renderingLocale = locale;
    try {
        return render();
    } finally {
        renderingLocale = previous;
    }
}

export const normalizeLocale = (locale: string | null | undefined): AppLocale => {
    const language = locale?.trim().toLowerCase().replace('_', '-').split('-')[0];

    return SUPPORTED_LOCALES.includes(language as AppLocale) ? (language as AppLocale) : DEFAULT_LOCALE;
};

export const getDocumentLocale = (): AppLocale => {
    if (typeof window === 'undefined') {
        return renderingLocale ?? DEFAULT_LOCALE;
    }

    return normalizeLocale(document.documentElement.lang || window.configuration?.locale);
};

export const getBrowserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

let documentTimeZone: string | undefined;

export const getDocumentTimeZone = () => {
    if (documentTimeZone || typeof window === 'undefined') return documentTimeZone;
    const timeZone = window.configuration?.timeZone;
    if (!timeZone) return undefined;
    try {
        new Intl.DateTimeFormat('en', { timeZone });
        documentTimeZone = timeZone;
    } catch {
        documentTimeZone = 'UTC';
    }
    return documentTimeZone;
};
