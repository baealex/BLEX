/* eslint-disable no-console */

import { QueryClient } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { getDocumentLocale } from '../i18n/locale';
import { buildQueryCacheKey } from './query-cache-key';

const getCurrentUsername = () => {
    return window.configuration?.user?.username || 'anonymous';
};

const getCurrentCacheKey = () => {
    return buildQueryCacheKey(getCurrentUsername(), getDocumentLocale());
};

export const sessionStoragePersister: Persister = {
    persistClient: async (client: PersistedClient) => {
        if (typeof window === 'undefined') return;

        try {
            const key = getCurrentCacheKey();
            sessionStorage.setItem(key, JSON.stringify(client));
        } catch (error) {
            console.error('Failed to persist client:', error);
        }
    },
    restoreClient: async () => {
        if (typeof window === 'undefined') return undefined;

        try {
            const key = getCurrentCacheKey();
            const cached = sessionStorage.getItem(key);
            return cached ? JSON.parse(cached) : undefined;
        } catch (error) {
            console.error('Failed to restore client:', error);
            return undefined;
        }
    },
    removeClient: async () => {
        if (typeof window === 'undefined') return;

        try {
            const key = getCurrentCacheKey();
            sessionStorage.removeItem(key);
        } catch (error) {
            console.error('Failed to remove client:', error);
        }
    }
};

export function cleanupOldCaches(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
        return;
    }

    const currentCacheKey = getCurrentCacheKey();
    const keysToRemove: string[] = [];

    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('rq-cache-') && key !== currentCacheKey) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach((key) => {
        sessionStorage.removeItem(key);
    });
}

export function createQueryClient() {
    return new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });
}

if (typeof window !== 'undefined') {
    cleanupOldCaches();
}
