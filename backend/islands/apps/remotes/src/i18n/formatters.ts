import type { AppLocale } from './locale';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const formatPublishedDate = (
    publishedDate: string | undefined,
    legacyDate: string,
    locale: AppLocale
): string => {
    const match = publishedDate?.match(DATE_ONLY_PATTERN);
    if (!match) {
        return legacyDate;
    }

    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

    if (
        date.getUTCFullYear() !== Number(year)
        || date.getUTCMonth() !== Number(month) - 1
        || date.getUTCDate() !== Number(day)
    ) {
        return legacyDate;
    }

    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
    }).format(date);
};
