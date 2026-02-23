/**
 * Settings UI Style Constants
 *
 * 일관된 설정 페이지 UI를 위한 공통 스타일 상수
 * Modern minimal design principles
 */

// Card styles - Clean, modern design with subtle shadows
export const CARD_BASE = 'bg-surface ring-1 ring-line/60 rounded-2xl hover:ring-line transition-all motion-interaction';
export const CARD_PADDING = 'p-5';

// Icon container styles - Minimal grayscale design
export const ICON_BASE = 'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0';
export const ICON_SIZE = 'text-sm';

// Icon styles - Clean grayscale variants
export const ICON_VARIANTS = {
    default: 'bg-surface-subtle text-content-secondary',
    dark: 'bg-action-hover text-content-inverted',
    light: 'bg-surface-subtle text-content-secondary border border-line'
} as const;

// Typography
export const TITLE = 'text-base font-semibold text-content';
export const SUBTITLE = 'text-xs text-content-secondary';

// Layout
export const FLEX_ROW = 'flex items-center gap-3';
export const ACTIONS_CONTAINER = 'flex gap-2 flex-shrink-0';

// Drag handle
export const DRAG_HANDLE = 'cursor-grab active:cursor-grabbing text-content-hint hover:text-content-secondary p-2 hover:bg-surface-subtle rounded-lg transition-colors -ml-2';

// Helper function to create icon class
export const getIconClass = (variant: keyof typeof ICON_VARIANTS = 'default') =>
    `${ICON_BASE} ${ICON_VARIANTS[variant]}`;

// Helper function to create card class
export const getCardClass = (extraClasses = '') =>
    `${CARD_BASE} ${extraClasses}`;

// Shared Input Styles
export const baseInputStyles = 'block w-full rounded-lg border border-line focus:border-line-strong/30 focus:ring-2 focus:ring-line/5 text-sm py-3 px-3 min-h-12 transition-all motion-interaction bg-surface placeholder-content-hint text-content';
