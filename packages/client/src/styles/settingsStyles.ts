/** Role-specific styles used by settings lists and dropdown triggers. */

const SETTINGS_ICON_BASE = 'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0';

const SETTINGS_ICON_VARIANTS = {
    default: 'bg-surface-subtle text-content-secondary',
    light: 'bg-surface-subtle text-content-secondary border border-line'
} as const;

export const SETTINGS_LIST_TITLE = 'text-base font-semibold text-content';
export const SETTINGS_LIST_META = 'text-xs text-content-secondary';

export const getSettingsIconClass = (
    variant: keyof typeof SETTINGS_ICON_VARIANTS = 'default'
) => `${SETTINGS_ICON_BASE} ${SETTINGS_ICON_VARIANTS[variant]}`;

// These are button-based select triggers, not text inputs.
const SETTINGS_SELECT_TRIGGER_BASE = 'block w-full rounded-lg border border-line focus:border-line-strong/30 focus:ring-2 focus:ring-line/5 text-sm px-3 transition-all motion-interaction bg-surface placeholder-content-hint text-content';

export const settingsSelectTriggerStyles = `${SETTINGS_SELECT_TRIGGER_BASE} min-h-11 py-2.5`;
export const settingsCompactSelectTriggerStyles = `${SETTINGS_SELECT_TRIGGER_BASE} min-h-11 py-2 [@media(pointer:fine)]:min-h-10`;
