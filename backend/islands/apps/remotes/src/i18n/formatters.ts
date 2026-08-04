import type { AppLocale } from './locale';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const formatDateOnly = (
    value: string | undefined,
    locale: AppLocale,
    fallback = ''
): string => {
    const match = value?.match(DATE_ONLY_PATTERN);
    if (!match) {
        return fallback;
    }

    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

    if (
        date.getUTCFullYear() !== Number(year)
        || date.getUTCMonth() !== Number(month) - 1
        || date.getUTCDate() !== Number(day)
    ) {
        return fallback;
    }

    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
    }).format(date);
};

export const formatPublishedDate = (
    publishedDate: string | undefined,
    legacyDate: string,
    locale: AppLocale
): string => formatDateOnly(publishedDate, locale, legacyDate);
