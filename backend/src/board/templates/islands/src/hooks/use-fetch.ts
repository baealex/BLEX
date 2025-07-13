import { useCallback, useEffect, useState } from 'react';

const cache = new Map();

interface UseFetchOptions<T> {
    queryKey: string[];
    queryFn: () => Promise<T>;
    disableRefetch?: boolean;
    enable?: boolean;
}

export function useFetch<T>(options: UseFetchOptions<T>) {
    const { queryKey, queryFn, disableRefetch, enable } = options || {};

    const [data, setData] = useState<T>();
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const key = queryKey.join('/');

    const mutate = useCallback((next: T | ((prev: T) => T)) => {
        setData(prev => next instanceof Function ? next(prev as T) : next);
    }, []);

    useEffect(() => {
        const run = () => {
            if (enable === false) {
                return;
            }

            if (!cache.has(key)) {
                setIsLoading(true);
            } else {
                setData(cache.get(key));
                if (disableRefetch) {
                    return;
                }
            }

            return queryFn().then(data => {
                cache.set(key, data);
                setData(data);
            }).catch(() => {
                setIsError(true);
            }).finally(() => {
                setIsLoading(false);
            });
        };

        run();
    }, [key, enable]);

    return {
        data,
        mutate,
        isError,
        isLoading
    };
}
