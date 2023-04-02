import { useEffect, useMemo } from 'react';

const cache = new Map();

function createMemoryStore<T extends object>(key: string, initialValue: T) {
    if (cache.has(key)) {
        initialValue = cache.get(key);
    }

    const itemProxy = new Proxy(initialValue, {
        get(target: T, prop) {
            return target[prop as keyof T];
        },
        set(target: T, prop, value) {
            target[prop as keyof T] = value;
            cache.set(key, target);
            return true;
        }
    });

    return itemProxy;
}

export function clearMemoryStore(key?: string | unknown[]) {
    if (key) {
        if (typeof key !== 'string') key = key.join('/');
        cache.delete(key);
    } else {
        cache.clear();
    }
}

export function useMemoryStore<T extends object>(key: string | unknown[], initialValue: T) {
    if (typeof key !== 'string') key = key.join('/');

    const store = useMemo(() => createMemoryStore(key as string, initialValue), [key]);

    return store;
}
