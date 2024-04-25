import { useEffect, useState } from 'react';

import { useDetectBottomApproach } from './use-detect-bottom-approach';
import { useMemoryStore } from './use-memory-store';

interface Options<T> {
    key: string | string[];
    lastPage: number;
    initialValue: T[];
    callback: (nextPage: number) => Promise<T[]>;
}

export const useInfinityScroll = <T>({
    key,
    lastPage,
    initialValue,
    callback
}: Options<T>) => {
    if (typeof key !== 'string') key = key.join('/');

    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);

    const memoryStore = useMemoryStore(key, {
        page: 1,
        data: initialValue
    });

    const [page, setPage] = useState(memoryStore.page);
    const [data, setData] = useState<T[]>(memoryStore.data);

    const isBottomApproach = useDetectBottomApproach({
        enabled: memoryStore.page < lastPage && !isLoading
    });

    useEffect(() => {
        if (!isBottomApproach || isLoading) return;

        setIsLoading(true);
        callback(page + 1)
            .then((data) => {
                memoryStore.page += 1;
                memoryStore.data = data;
                setPage(prevPage => {
                    memoryStore.page = prevPage + 1;
                    return memoryStore.page;
                });
                setData(prevData => {
                    memoryStore.data = [...prevData, ...data];
                    return memoryStore.data;
                });
                setIsError(false);
            })
            .catch(() => setIsError(true))
            .finally(() => setIsLoading(false));
    }, [isBottomApproach, isLoading]);

    useEffect(() => {
        setPage(memoryStore.page);
        setData(memoryStore.data);
    }, [memoryStore]);

    return {
        data,
        mutate: (callback: (data: T[]) => T[]) => {
            const newData = callback(data);
            setData(() => {
                memoryStore.data = newData;
                return memoryStore.data;
            });
        },
        isError,
        isLoading,
        isLastPage: page === lastPage
    };
};
