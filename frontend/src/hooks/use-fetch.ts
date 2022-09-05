import { useCallback, useEffect, useState } from 'react';

const cache = new Map();

export function useFetch<T>(key: string, fetch: () => Promise<T>) {
    const [ data, setData] = useState<T | null>(null);
    const [ isError, setIsError ] = useState(false);
    const [ isLoading, setIsLoading ] = useState(false);

    const mutate = useCallback((data: T) => {
        cache.set(key, data);
        setData(data);
    }, []);

    useEffect(() => {
        if (!cache.has(key)) {
            setIsLoading(true);
        }
        cache.has(key) && setData(cache.get(key));

        fetch().then(data => {
            cache.set(key, data);
            setData(data);
        }).catch(() => {
            setIsError(true);
        }).finally(() => {
            setIsLoading(false);
        });
    }, [key]);

    return {
        data,
        mutate,
        isError,
        isLoading
    };
}
