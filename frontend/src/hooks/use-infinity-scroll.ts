import { useEffect, useMemo, useState } from 'react';

import { optimizeEvent } from '~/modules/optimize/event';

export const useInfinityScroll = (callback: () => Promise<void>, options?: {
    enabled?: boolean;
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);

    const handleScroll = useMemo(() => optimizeEvent(() => {
        if (options && !options?.enabled) return;

        const {
            scrollTop,
            scrollHeight,
            clientHeight
        } = document.documentElement;

        if (scrollTop + clientHeight < scrollHeight - 100 || isLoading) return;

        setIsLoading(true);
    }), [isLoading, options?.enabled]);

    useEffect(() => {
        handleScroll();
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    useEffect(() => {
        if (!isLoading) return;

        callback()
            .then(() => setIsError(false))
            .catch(() => setIsError(true))
            .finally(() => setIsLoading(false));
    }, [isLoading]);

    return {
        isError,
        isLoading
    };
};
