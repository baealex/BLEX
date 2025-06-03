import { useEffect, useState, useRef, useCallback } from 'react';

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
    lastPage = Infinity,
    initialValue = [] as T[],
    callback
}: Options<T>) => {
    const safeKey = typeof key === 'string' ? key : Array.isArray(key) ? key.join('/') : '';

    const currentRequestRef = useRef<number | null>(null);
    const isMountedRef = useRef(true);

    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const memoryStore = useMemoryStore(safeKey, {
        page: 1,
        data: initialValue || []
    });

    const [page, setPage] = useState(memoryStore.page);
    const [data, setData] = useState<T[]>(memoryStore.data);

    const isBottomApproach = useDetectBottomApproach({ enabled: memoryStore.page < lastPage && !isLoading });

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const fetchNextPage = useCallback(async () => {
        if (isLoading || page >= lastPage) return;

        const nextPage = page + 1;
        currentRequestRef.current = nextPage;

        setIsLoading(true);

        try {
            const newData = await callback(nextPage);

            if (!isMountedRef.current || currentRequestRef.current !== nextPage) return;

            if (!Array.isArray(newData)) {
                throw new Error('Expected array response from callback');
            }

            setPage(prevPage => {
                const updatedPage = prevPage + 1;
                memoryStore.page = updatedPage;
                return updatedPage;
            });

            setData(prevData => {
                const updatedData = [...prevData, ...newData];
                memoryStore.data = updatedData;
                return updatedData;
            });

            setIsError(false);
            setErrorMessage(null);
        } catch (error) {
            if (!isMountedRef.current || currentRequestRef.current !== nextPage) return;

            setIsError(true);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch data');
        } finally {
            if (isMountedRef.current && currentRequestRef.current === nextPage) {
                setIsLoading(false);
                currentRequestRef.current = null;
            }
        }
    }, [callback, isLoading, lastPage, page, memoryStore]);

    useEffect(() => {
        if (isBottomApproach && !isLoading && page < lastPage) {
            fetchNextPage();
        }
    }, [isBottomApproach, fetchNextPage, isLoading, page, lastPage]);

    useEffect(() => {
        if (memoryStore.page !== page) {
            setPage(memoryStore.page);
        }

        if (memoryStore.data !== data) {
            setData(memoryStore.data);
        }
    }, [memoryStore, page, data]);

    return {
        data,
        mutate: useCallback((mutateCallback: (data: T[]) => T[]) => {
            try {
                if (typeof mutateCallback !== 'function') {
                    throw new Error('Mutate callback must be a function');
                }

                const newData = mutateCallback(data);

                if (!Array.isArray(newData)) {
                    throw new Error('Mutate callback must return an array');
                }

                setData(() => {
                    memoryStore.data = newData;
                    return newData;
                });

                return true;
            } catch (error) {
                return false;
            }
        }, [data, memoryStore]),
        isError,
        errorMessage,
        isLoading,
        isLastPage: page >= lastPage,
        refresh: useCallback(() => {
            if (isLoading) return false;

            setPage(1);
            setData(initialValue || []);
            memoryStore.page = 1;
            memoryStore.data = initialValue || [];

            currentRequestRef.current = null;
            setIsLoading(false);

            return true;
        }, [initialValue, isLoading, memoryStore])
    };
};
