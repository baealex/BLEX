import { useEffect, useState } from 'react';
import {
    THEME_CHANGE_EVENT,
    getStoredThemePreference,
    resolveTheme,
    type ResolvedTheme,
    type ThemePreference
} from '~/scripts/theme';

interface ThemeChangeDetail {
    theme: ResolvedTheme;
    preference: ThemePreference;
}

const readResolvedTheme = (): ResolvedTheme => {
    if (typeof window === 'undefined') {
        return 'light';
    }

    return resolveTheme(getStoredThemePreference());
};

export const useResolvedTheme = (): ResolvedTheme => {
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(readResolvedTheme);

    useEffect(() => {
        setResolvedTheme(readResolvedTheme());

        const handleThemeChange = (event: Event) => {
            const customEvent = event as CustomEvent<ThemeChangeDetail>;
            setResolvedTheme(customEvent.detail.theme);
        };

        window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);

        return () => {
            window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
        };
    }, []);

    return resolvedTheme;
};
