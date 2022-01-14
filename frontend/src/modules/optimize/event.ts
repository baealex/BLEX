export function optimizedEvent(func: (e?: Event) => void) {
    let ticking = false;

    return (e?: Event) => {
        if (ticking) return;
        
        window.requestAnimationFrame(() => {
            func(e);
            ticking = false;
        });
        ticking = true;
    }
}

export interface DebounceEventRunner {
    (e?: Event): boolean;
    clear(): void;
}

export function debounceEvent(func: (e?: Event) => void, timing: number): DebounceEventRunner {
    let timer: NodeJS.Timeout;

    const runner = function(e?: Event) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => func(e), timing);
        return true;
    }

    runner.clear = function() {
        if (timer) clearTimeout(timer);
    }

    return runner;
}

export function throttleEvent(func: (e?: Event) => void, timing: number) {
    let isReady = true;

    return (e?: Event) => {
        if (isReady) {
            isReady = false;
            func(e);
            setTimeout(() => {
                isReady = true;
            }, timing);
        }
    }
}