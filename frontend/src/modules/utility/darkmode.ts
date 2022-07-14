export function systemTheme() {
    if (typeof window !== 'undefined') {
        if (window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: dark)');
        }
    }
    return null;
}

export const syncTheme = (() => {
    let handleChange: (value: boolean) => void;
    const system = systemTheme();

    system?.addEventListener('change', e => {
        if (handleChange) {
            if (e.matches) {
                handleChange(true);
            } else {
                handleChange(false);
            }
        }
    });

    return (onChange: (isDark: boolean) => void, init: boolean) => {
        if (init && system?.matches) {
            onChange(true);
        }

        handleChange = onChange;
    };
})();