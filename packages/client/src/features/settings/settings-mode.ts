import { useRouterState } from '@tanstack/react-router';

export type SettingsMode = 'user' | 'admin';

export const isSettingsPath = (path: string) => /^\/(?:settings|admin-settings)(?:[/?#]|$)/.test(path);

const settingsModeFromPath = (path: string): SettingsMode => (
    /^\/admin-settings(?:[/?#]|$)/.test(path) ? 'admin' : 'user'
);

export const useSettingsMode = () => useRouterState({ select: state => settingsModeFromPath(state.location.pathname) });
