import { useRouterState } from '@tanstack/react-router';

export type SettingsMode = 'user' | 'admin';

export const settingsBasePaths: Record<SettingsMode, string> = {
    user: '/settings',
    admin: '/admin-settings'
};

export const settingsModeFromPath = (path: string): SettingsMode => (
    /^\/admin-settings(?:[/?#]|$)/.test(path) ? 'admin' : 'user'
);

export const hasSettingsBasePath = (path: string) => /^\/(?:settings|admin-settings)(?:[/?#]|$)/.test(path);

let activeSettingsMode: SettingsMode = 'user';

/** Keeps the last settings area while the address bar already shows a page that is still loading. */
export const currentSettingsMode = (path: string) => {
    if (hasSettingsBasePath(path)) activeSettingsMode = settingsModeFromPath(path);
    return activeSettingsMode;
};

export const useSettingsMode = () => useRouterState({ select: state => currentSettingsMode(state.location.publicHref) });
