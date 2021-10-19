export function optimizedEvent(func: () => void) {
    let ticking = false;

    return () => {
        if (ticking) return;
        
        window.requestAnimationFrame(() => {
            func();
            ticking = false;
        });
        ticking = true;
    }
}