import type { AppLocale } from '../i18n/locale';

export const buildQueryCacheKey = (
    username: string | null | undefined,
    locale: AppLocale,
    timeZone: string | undefined
): string => {
    const identity = username?.trim() || 'anonymous';
    return `rq-cache-v3-${encodeURIComponent(identity)}-${locale}-${encodeURIComponent(timeZone || '')}`;
};
