import { getDocumentLocale, getDocumentTimeZone } from '../i18n/locale.js';
type StoredDate = string | Date | null | undefined;

const displayTimeZone = () =>
    getDocumentTimeZone() || (typeof process !== 'undefined' ? process.env.TZ : undefined) || 'Asia/Seoul';

function parseInstant(value: StoredDate): { date: Date; microseconds: string } | null {
    if (!value) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.valueOf())
            ? null
            : {
                  date: value,
                  microseconds: `${String(value.getUTCMilliseconds()).padStart(3, '0')}000`
              };
    }
    const normalized = value.trim().replace(' ', 'T');
    const fraction = /\.(\d+)/.exec(normalized)?.[1] ?? '';
    const zoned = /(?:Z|[+-]\d\d:?\d\d)$/i.test(normalized) ? normalized : `${normalized}Z`;
    const date = new Date(zoned.replace(/\.\d+/, (digits) => digits.slice(0, 4)));
    return Number.isNaN(date.valueOf())
        ? null
        : {
              date,
              microseconds: fraction.padEnd(6, '0').slice(0, 6)
          };
}

function localParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: displayTimeZone(),
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).formatToParts(date);
    const field = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return {
        year: field('year'),
        month: field('month'),
        day: field('day'),
        hour: field('hour'),
        minute: field('minute'),
        second: field('second')
    };
}

/** Formats a Prisma timestamp as timezone-free UTC text with optional six-digit fractions. */
export function storedDateText(value: Date | number | bigint): string {
    const date = value instanceof Date ? value : new Date(Number(value));
    const milliseconds = date.getUTCMilliseconds();
    const seconds = date.toISOString().slice(0, 19).replace('T', ' ');
    return milliseconds === 0 ? seconds : `${seconds}.${String(milliseconds).padStart(3, '0')}000`;
}

/** ISO 8601 in UTC with a `+00:00` offset, keeping microseconds when present. */
export function isoWithOffset(value: StoredDate): string | null {
    const instant = parseInstant(value);
    if (!instant) return null;
    const fraction = instant.microseconds === '000000' ? '' : `.${instant.microseconds}`;
    return `${instant.date.toISOString().slice(0, 19)}${fraction}+00:00`;
}

/** ISO 8601 in UTC with millisecond precision and a `Z` suffix. */
export function isoUtcMillis(value: StoredDate): string | null {
    const instant = parseInstant(value);
    if (!instant) return null;
    const fraction = instant.microseconds === '000000' ? '' : `.${instant.microseconds.slice(0, 3)}`;
    return `${instant.date.toISOString().slice(0, 19)}${fraction}Z`;
}

/** ISO 8601 in the display time zone with millisecond precision. */
export function isoLocalMillis(value: StoredDate): string | null {
    const instant = parseInstant(value);
    if (!instant) return null;
    const local = localParts(instant.date);
    const asUtc = Date.UTC(
        Number(local.year),
        Number(local.month) - 1,
        Number(local.day),
        Number(local.hour),
        Number(local.minute),
        Number(local.second)
    );
    const offset = Math.round((asUtc - Math.floor(instant.date.valueOf() / 1000) * 1000) / 60_000);
    const sign = offset < 0 ? '-' : '+';
    const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
    const fraction = instant.microseconds === '000000' ? '' : `.${instant.microseconds.slice(0, 3)}`;
    const zone = offset === 0 ? 'Z' : `${sign}${hours}:${minutes}`;
    return `${local.year}-${local.month}-${local.day}T${local.hour}:${local.minute}:${local.second}${fraction}${zone}`;
}

export function localDate(value: StoredDate): string {
    const instant = parseInstant(value);
    if (!instant) return '';
    const { year, month, day } = localParts(instant.date);
    return `${year}-${month}-${day}`;
}

export function localDateTimeText(value: StoredDate): string {
    const instant = parseInstant(value);
    if (!instant) return '';
    const { year, month, day, hour, minute } = localParts(instant.date);
    return `${year}-${month}-${day} ${hour}:${minute}`;
}

/** Localized calendar date; retains the legacy Korean function name. */
export function koreanDate(value: StoredDate): string {
    const instant = parseInstant(value);
    if (!instant) return '';
    if (getDocumentLocale() === 'en')
        return new Intl.DateTimeFormat('en', {
            timeZone: displayTimeZone(),
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(instant.date);
    const { year, month, day } = localParts(instant.date);
    return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

/** Localized calendar date and time. */
export function koreanDateTime(value: StoredDate): string {
    const instant = parseInstant(value);
    if (!instant) return '';
    if (getDocumentLocale() === 'en')
        return new Intl.DateTimeFormat('en', {
            timeZone: displayTimeZone(),
            dateStyle: 'long',
            timeStyle: 'short'
        }).format(instant.date);
    const { hour, minute } = localParts(instant.date);
    const hours = Number(hour);
    return `${koreanDate(value)} ${hours % 12 || 12}:${minute} ${hours < 12 ? '오전' : '오후'}`;
}

/** Uses a calendar date after a year; otherwise shows the largest elapsed unit. */
export function timeSince(value: StoredDate, now = new Date()): string {
    const date = parseInstant(value)?.date;
    if (!date) return '';
    if (getDocumentLocale() === 'en') {
        const minutes = Math.max(0, Math.floor((now.valueOf() - date.valueOf()) / 60_000));
        if (minutes > 365 * 24 * 60) return koreanDate(value);
        const format = new Intl.RelativeTimeFormat('en', { numeric: 'always' });
        const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
            [43_200, 'month'],
            [10_080, 'week'],
            [1_440, 'day'],
            [60, 'hour'],
            [1, 'minute']
        ];
        for (const [size, unit] of units) if (minutes >= size) return format.format(-Math.floor(minutes / size), unit);
        return format.format(0, 'minute');
    }
    if (now.valueOf() - date.valueOf() > 365 * 24 * 60 * 60 * 1000) {
        const { year, month, day } = localParts(date);
        return `${year}년 ${Number(month)}월 ${Number(day)}일`;
    }
    const withinMonth = (moment: Date) => moment.valueOf() - Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), 1);
    const months =
        (now.getUTCFullYear() - date.getUTCFullYear()) * 12 +
        now.getUTCMonth() -
        date.getUTCMonth() -
        (withinMonth(date) > withinMonth(now) ? 1 : 0);
    if (months >= 12) return `${Math.floor(months / 12)}년 전`;
    if (months > 0) return `${months}개월 전`;
    const minutes = Math.max(0, Math.floor((now.valueOf() - date.valueOf()) / 60_000));
    const units: Array<[number, string]> = [
        [7 * 24 * 60, '주'],
        [24 * 60, '일'],
        [60, '시간']
    ];
    for (const [size, label] of units) {
        if (minutes >= size) return `${Math.floor(minutes / size)}${label} 전`;
    }
    return `${minutes}분 전`;
}
