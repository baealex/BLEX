export function optimizeEvent(func: (e?: Event) => void) {
    let ticking = false;

    return (e?: Event) => {
        if (ticking) return;

        window.requestAnimationFrame(() => {
            func(e);
            ticking = false;
        });
        ticking = true;
    };
}

export interface DebounceEventRunner<T> {
    (e?: T): void;
    clear(): void;
}

export function debounceEvent<T>(callback: (value?: T) => void, ms: number) {
    let timer: NodeJS.Timeout;

    const runner: DebounceEventRunner<T> = (value) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => callback(value), ms);
    };

    runner.clear = () => {
        if (timer) clearTimeout(timer);
    };

    return runner;
}

export function throttleEvent<T>(callback: (value?: T) => void, timing: number) {
    let isReady = true;

    return (value?: T) => {
        if (isReady) {
            isReady = false;
            callback(value);
            setTimeout(() => isReady = true, timing);
        }
    };
}
