import React, { useCallback, useEffect, useState } from 'react';

import {
    lazyIntersection
} from '~/modules/optimize/lazy';

const cache = new Map();

interface UseFetchOptions {
    observeRef?: React.RefObject<HTMLElement>;
    disableRefetch?: boolean;
}

export function useFetch<T>(key: string | unknown[], fetch: () => Promise<T>, options: UseFetchOptions = {}) {
    if (typeof key !== 'string') key = key.join('/');

    const [data, setData] = useState<T>();
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const mutate = useCallback((next: T | ((prev: T) => T)) => {
        setData(prev => next instanceof Function ? next(prev as T) : next);
    }, []);

    useEffect(() => {
        const run = () => {
            if (!cache.has(key)) {
                setIsLoading(true);
            } else {
                setData(cache.get(key));
                if (options.disableRefetch) {
                    return;
                }
            }

            return fetch().then(data => {
                cache.set(key, data);
                setData(data);
            }).catch(() => {
                setIsError(true);
            }).finally(() => {
                setIsLoading(false);
            });
        };

        if (options.observeRef) {
            const observer = lazyIntersection(options.observeRef.current, async () => {
                await run();
            });
            return () => observer?.disconnect();
        }

        run();
    }, [key, options.observeRef]);

    return {
        data,
        mutate,
        isError,
        isLoading
    };
}
