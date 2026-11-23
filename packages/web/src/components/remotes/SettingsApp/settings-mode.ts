import { useRouterState } from '@tanstack/react-router';

export type SettingsMode = 'user' | 'admin';

export const settingsBasePaths: Record<SettingsMode, string> = {
    user: '/settings',
    admin: '/admin-settings'
};

export const settingsModeFromPath = (path: string): SettingsMode => (
    /^\/admin-settings(?:[/?#]|$)/.test(path) ? 'admin' : 'user'
);

export const hasSettingsBasePath = (path: string) => /^\/(?:settings|admin-settings)(?:\/|$)/.test(path);

export const useSettingsMode = () => useRouterState({ select: state => settingsModeFromPath(state.location.publicHref) });
