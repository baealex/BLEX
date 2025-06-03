import { useEffect, useMemo, useRef, useState } from 'react';
import { optimizeEvent } from '~/modules/optimize/event';

interface Options {
    enabled?: boolean;
}

export const useDetectBottomApproach = (options: Options) => {
    const [isBottomApproach, setIsBottomApproach] = useState(false);
    const mountedRef = useRef(true);
    const enabled = options?.enabled ?? true;

    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

    const handleDetectBottomApproach = useMemo(() => {
        return optimizeEvent(() => {
            if (!enabled) return;
            if (!isBrowser) return;

            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            if (scrollTop + clientHeight < scrollHeight - 100) return;
            if (mountedRef.current) setIsBottomApproach(true);
        });
    }, [enabled, isBrowser]);

    useEffect(() => {
        mountedRef.current = true;
        if (!isBrowser) return;

        handleDetectBottomApproach();
        window.addEventListener('scroll', handleDetectBottomApproach, { passive: true });
        return () => {
            mountedRef.current = false;
            window.removeEventListener('scroll', handleDetectBottomApproach);
        };
    }, [handleDetectBottomApproach, isBrowser]);

    useEffect(() => {
        if (isBottomApproach && mountedRef.current) {
            setIsBottomApproach(false);
        }
    }, [isBottomApproach]);

    return isBottomApproach;
};
