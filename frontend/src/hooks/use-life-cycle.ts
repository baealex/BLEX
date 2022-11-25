import { useEffect } from 'react';

export function useDidMount(fn: () => void) {
    useEffect(() => {
        fn();
    }, []);
}

export function useDidUnmount(fn: () => void) {
    useEffect(() => {
        return () => {
            fn();
        };
    }, []);
}

export function useDidUpdate(fn: () => void, deps: unknown[]) {
    useEffect(() => {
        fn();
    }, [...deps]);
}
