export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_COOKIE_KEY = 'blex_theme';

export function writeThemePreferenceCookie(preference: ThemePreference): void {
    const value = preference === 'system' ? '' : preference;
    const maxAge = preference === 'system' ? 0 : 60 * 60 * 24 * 365;
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${THEME_COOKIE_KEY}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}
