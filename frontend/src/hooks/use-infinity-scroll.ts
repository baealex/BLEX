import { useEffect, useState } from 'react';

import { optimizeEvent } from '~/modules/optimize/event';

export const useInfinityScroll = (callback: () => Promise<void>) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);

    const handleScroll = optimizeEvent(() => {
        const { innerHeight } = window;
        const {
            scrollTop,
            offsetHeight
        } = document.documentElement;

        if (innerHeight + scrollTop !== offsetHeight || isLoading) {
            return;
        }

        setIsLoading(true);
    });

    useEffect(() => {
        handleScroll();
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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
