const cache = new Map();

export function useMemoryStore<T extends object>(key: string | unknown[], item: T) {
    if (typeof key !== 'string') key = key.join('/');

    if (cache.has(key)) {
        item = cache.get(key);
    }

    const itemProxy = new Proxy(item, {
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
