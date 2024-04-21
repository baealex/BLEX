import { useEffect, useMemo, useState } from 'react';

import { optimizeEvent } from '~/modules/optimize/event';

interface Options {
    enabled?: boolean;
}

export const useDetectBottomApproach = (options: Options) => {
    const [isBottomApproach, setIsBottomApproach] = useState(false);

    const handleDetectBottomApproach = useMemo(() => optimizeEvent(() => {
        if (options && !options?.enabled) return;

        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;

        if (scrollTop + clientHeight < scrollHeight - 100) return;

        setIsBottomApproach(true);
    }), [options?.enabled]);

    useEffect(() => {
        handleDetectBottomApproach();
        window.addEventListener('scroll', handleDetectBottomApproach);
        return () => window.removeEventListener('scroll', handleDetectBottomApproach);
    }, [handleDetectBottomApproach]);

    useEffect(() => {
        if (isBottomApproach) {
            setIsBottomApproach(false);
        }
    }, [isBottomApproach]);

    return isBottomApproach;
};
