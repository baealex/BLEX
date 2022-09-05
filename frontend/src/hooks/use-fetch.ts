import { useCallback, useEffect, useState } from 'react';

import {
    lazyIntersection,
    lazyLoadResource
} from '~/modules/optimize/lazy';

const cache = new Map();

interface UseFetchOptions {
    observeElement?: HTMLElement | null;
}

export function useFetch<T>(key: string | unknown[], fetch: () => Promise<T>, options: UseFetchOptions = {}) {
    if (typeof key !== 'string') key = key.join('/');

    const [ data, setData ] = useState<T>();
    const [ isError, setIsError ] = useState(false);
    const [ isLoading, setIsLoading ] = useState(false);

    const mutate = useCallback((data: T) => {
        cache.set(key, data);
        setData(data);
    }, []);

    useEffect(() => {
        const run = () => {
            if (!cache.has(key)) {
                setIsLoading(true);
            }
            cache.has(key) && setData(cache.get(key));

            return fetch().then(data => {
                cache.set(key, data);
                setData(data);
            }).catch(() => {
                setIsError(true);
            }).finally(() => {
                setIsLoading(false);
            });
        };

        if (options.observeElement !== undefined) {
            const observer = lazyIntersection(options.observeElement, async () => {
                await run();
                lazyLoadResource();
            });
            return () => observer?.disconnect();
        }

        run();
    }, [key, options.observeElement]);

    return {
        data,
        mutate,
        isError,
        isLoading
    };
}
