import type { AppLocale } from './locale';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

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

export const formatLocalDateTime = (
    value: string | undefined,
    locale: AppLocale,
    fallback = ''
): string => {
    const match = value?.match(LOCAL_DATE_TIME_PATTERN);
    if (!match) {
        return fallback;
    }

    const [, year, month, day, hour, minute] = match;
    const date = new Date(Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute)
    ));

    if (
        date.getUTCFullYear() !== Number(year)
        || date.getUTCMonth() !== Number(month) - 1
        || date.getUTCDate() !== Number(day)
        || date.getUTCHours() !== Number(hour)
        || date.getUTCMinutes() !== Number(minute)
    ) {
        return fallback;
    }

    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC'
    }).format(date);
};

export const formatDateTime = (
    value: string | undefined,
    locale: AppLocale,
    fallback = ''
): string => {
    if (!value) {
        return fallback;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return fallback;
    }

    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
};
