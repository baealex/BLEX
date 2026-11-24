import type { AppLocale } from '../i18n/locale';

const cachePrefix = 'rq-cache-';
const signedOutIdentity = 'anonymous';

export const buildQueryCacheKey = (
    username: string | null | undefined,
    locale: AppLocale,
    timeZone: string | undefined
): string => {
    const identity = username?.trim() || signedOutIdentity;
    return `${cachePrefix}v3-${encodeURIComponent(identity)}-${locale}-${encodeURIComponent(timeZone || '')}`;
};

/** Removes the session query caches of signed-in viewers, keeping those of signed-out visitors. */
export function removeSignedInCaches(): void {
    try {
        for (const key of Object.keys(sessionStorage)) {
            if (key.startsWith(cachePrefix) && !key.startsWith(`${cachePrefix}v3-${signedOutIdentity}-`))
                sessionStorage.removeItem(key);
        }
    } catch {
        /* Without session storage there is no cache to remove. */
    }
}
