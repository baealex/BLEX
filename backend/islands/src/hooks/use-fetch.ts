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

    const refetch = useCallback(() => {
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
    }, [key, enable]);

    useEffect(() => { refetch(); }, [refetch]);

    return {
        data,
        refetch,
        isError,
        isLoading
    };
}
