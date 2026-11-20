import { getDocumentTimeZone, type AppLocale } from '../../../../i18n/locale.ts';

export const parseScheduleDate = (value: string) => {
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const toReservedDateValue = (value?: string | null) => {
    const date = parseScheduleDate(value || '');
    return date ? date.toISOString() : value || '';
};

export const formatScheduleDateTime = (value: string, locale: AppLocale, timeZone = getDocumentTimeZone()) => {
    const date = parseScheduleDate(value);
    if (!date) return value;

    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone
    }).format(date);
};

export const isFutureScheduleDate = (value?: string) => {
    const date = parseScheduleDate(value || '');
    return Boolean(date && date.getTime() > Date.now());
};
