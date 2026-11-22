export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_COOKIE_KEY = 'blex_theme';
export const THEME_CHANGE_EVENT = 'blex:theme-change';

const SYSTEM_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';
const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const VALID_PREFERENCES: ThemePreference[] = ['light', 'dark', 'system'];

interface ThemeChangeDetail {
    theme: ResolvedTheme;
    preference: ThemePreference;
}

const isThemePreference = (value: unknown): value is ThemePreference => {
    return typeof value === 'string' && VALID_PREFERENCES.includes(value as ThemePreference);
};

const parseCookies = (): Record<string, string> => {
    if (!document.cookie) {
        return {};
    }

    return document.cookie
        .split(';')
        .map(cookie => cookie.trim())
        .filter(Boolean)
        .reduce<Record<string, string>>((accumulator, cookiePair) => {
            const separatorIndex = cookiePair.indexOf('=');
            if (separatorIndex < 0) {
                return accumulator;
            }

            const rawKey = cookiePair.slice(0, separatorIndex);
            const rawValue = cookiePair.slice(separatorIndex + 1);

            accumulator[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
            return accumulator;
        }, {});
};

const getThemePreferenceFromCookie = (): ThemePreference | null => {
    const cookieValue = parseCookies()[THEME_COOKIE_KEY];

    if (isThemePreference(cookieValue)) {
        return cookieValue;
    }

    return null;
};

const writeThemePreferenceCookie = (preference: ThemePreference) => {
    const secureAttribute = window.location.protocol === 'https:' ? '; Secure' : '';

    if (preference === 'system') {
        document.cookie = `${THEME_COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax${secureAttribute}`;
        return;
    }

    document.cookie = `${THEME_COOKIE_KEY}=${encodeURIComponent(preference)}; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secureAttribute}`;
};

const getSystemTheme = (): ResolvedTheme => {
    return window.matchMedia(SYSTEM_DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
};

const updateThemeColorMeta = (theme: ResolvedTheme) => {
    const metaThemeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!metaThemeColor) {
        return;
    }

    metaThemeColor.setAttribute('content', theme === 'dark' ? '#171717' : '#ffffff');
};

const emitThemeChange = (detail: ThemeChangeDetail) => {
    window.dispatchEvent(new CustomEvent<ThemeChangeDetail>(THEME_CHANGE_EVENT, { detail }));
};

const applyResolvedTheme = (theme: ResolvedTheme, preference: ThemePreference) => {
    const root = document.documentElement;

    root.dataset.theme = theme;
    root.dataset.themePreference = preference;
    root.style.colorScheme = theme;

    updateThemeColorMeta(theme);
    emitThemeChange({
        theme,
        preference
    });
};

export const getStoredThemePreference = (): ThemePreference => {
    const cookiePreference = getThemePreferenceFromCookie();
    if (cookiePreference) {
        return cookiePreference;
    }

    return 'system';
};

export const resolveTheme = (preference: ThemePreference): ResolvedTheme => {
    if (preference === 'system') {
        return getSystemTheme();
    }

    return preference;
};

export const applyThemePreference = (preference: ThemePreference): ResolvedTheme => {
    const resolvedTheme = resolveTheme(preference);
    applyResolvedTheme(resolvedTheme, preference);

    return resolvedTheme;
};

export const initializeTheme = (): ThemeChangeDetail => {
    const preference = getStoredThemePreference();
    const theme = applyThemePreference(preference);

    return {
        theme,
        preference
    };
};

export const setThemePreference = (preference: ThemePreference): ResolvedTheme => {
    writeThemePreferenceCookie(preference);

    return applyThemePreference(preference);
};

export const toggleThemePreference = (): ThemeChangeDetail => {
    const currentPreference = getStoredThemePreference();
    const currentResolved = resolveTheme(currentPreference);
    const nextPreference: ThemePreference = currentResolved === 'dark' ? 'light' : 'dark';
    const theme = setThemePreference(nextPreference);

    return {
        theme,
        preference: nextPreference
    };
};

export const subscribeSystemThemeChange = (callback: (theme: ResolvedTheme) => void): (() => void) => {
    const mediaQuery = window.matchMedia(SYSTEM_DARK_MEDIA_QUERY);

    const listener = () => {
        if (getStoredThemePreference() !== 'system') {
            return;
        }

        const theme = applyThemePreference('system');
        callback(theme);
    };

    mediaQuery.addEventListener('change', listener);

    return () => {
        mediaQuery.removeEventListener('change', listener);
    };
};
