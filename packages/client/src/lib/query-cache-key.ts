import type { AppLocale } from '../i18n/locale';

const cachePrefix = 'rq-cache-';
// The version changes with the key's format, so a cache written in an older format is never restored.
const versionPrefix = `${cachePrefix}v4-`;
// A signed-in identity starts with @, which the signed-out one cannot, so no username can name the visitor's cache.
const signedOutPrefix = `${versionPrefix}anonymous-`;

export const buildQueryCacheKey = (
    username: string | null | undefined,
    locale: AppLocale,
    timeZone: string | undefined
): string => {
    const viewer = username?.trim();
    const viewerPrefix = viewer ? `${versionPrefix}@${encodeURIComponent(viewer)}-` : signedOutPrefix;
    return `${viewerPrefix}${locale}-${encodeURIComponent(timeZone || '')}`;
};

/** Removes the session query caches of signed-in viewers and older formats, keeping those of signed-out visitors. */
export function removeSignedInCaches(): void {
    try {
        for (const key of Object.keys(sessionStorage)) {
            if (key.startsWith(cachePrefix) && !key.startsWith(signedOutPrefix)) sessionStorage.removeItem(key);
        }
    } catch {
        /* Without session storage there is no cache to remove. */
    }
}
