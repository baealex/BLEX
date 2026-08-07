import type { AppLocale } from '../i18n/locale';

export const buildQueryCacheKey = (
    username: string | null | undefined,
    locale: AppLocale
): string => {
    const identity = username?.trim() || 'anonymous';
    return `rq-cache-v2-${encodeURIComponent(identity)}-${locale}`;
};
