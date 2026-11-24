import { defaultShouldDehydrateQuery, QueryClient, type Query } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { getDocumentLocale, getDocumentTimeZone } from '../i18n/locale';
import { buildQueryCacheKey } from './query-cache-key';

/** Queries can opt out with `meta: { persist: false }` when their payload is too large for sessionStorage. */
export const shouldPersistQuery = (query: Query) => defaultShouldDehydrateQuery(query) && query.meta?.persist !== false;

let cleanedCaches = false;

/** Removes the caches of other viewers, languages, and time zones once per page load, when the first screen restores. */
function removeOtherCaches(currentCacheKey: string): void {
    if (cleanedCaches) return;
    cleanedCaches = true;
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith('rq-cache-') && key !== currentCacheKey) keysToRemove.push(key);
    }
    for (const key of keysToRemove) sessionStorage.removeItem(key);
}

/**
 * Keeps a screen's queries in sessionStorage for its viewer, given by the screen's own data. The key is read when
 * the cache is used, after the page's language is active. A screen loads before the page it belongs to shows,
 * so nothing here may depend on the previous page.
 */
export function createSessionStoragePersister(username: string | undefined): Persister {
    const cacheKey = () => buildQueryCacheKey(username, getDocumentLocale(), getDocumentTimeZone());
    return {
        persistClient: async (client: PersistedClient) => {
            try {
                sessionStorage.setItem(cacheKey(), JSON.stringify(client));
            } catch (error) {
                console.error('Failed to persist client:', error);
            }
        },
        restoreClient: async () => {
            try {
                const key = cacheKey();
                removeOtherCaches(key);
                const cached = sessionStorage.getItem(key);
                return cached ? JSON.parse(cached) : undefined;
            } catch (error) {
                console.error('Failed to restore client:', error);
                return undefined;
            }
        },
        removeClient: async () => {
            try {
                sessionStorage.removeItem(cacheKey());
            } catch (error) {
                console.error('Failed to remove client:', error);
            }
        }
    };
}

export function createQueryClient() {
    return new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });
}
