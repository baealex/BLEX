import { useEffect, useState } from 'react';

import { optimizeEvent } from '~/modules/optimize/event';

export const useInfinityScroll = (callback: () => Promise<void>) => {
    const [isFetching, setIsFetching] = useState(false);

    const handleScroll = optimizeEvent (() => {
        const { innerHeight } = window;
        const { scrollTop, offsetHeight } = document.documentElement;

        if (innerHeight + scrollTop !== offsetHeight || isFetching) {
            return;
        }
        setIsFetching(true);
    });

    useEffect(() => {
        handleScroll();
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (!isFetching) return;
        callback().then(() => setIsFetching(false));
    }, [isFetching]);

    return [isFetching, setIsFetching] as const;
};
