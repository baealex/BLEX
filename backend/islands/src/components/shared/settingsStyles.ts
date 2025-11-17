/**
 * Settings UI Style Constants
 *
 * 일관된 설정 페이지 UI를 위한 공통 스타일 상수
 * Shopify/Apple 디자인 원칙을 따름
 */

// Card styles - Clean grayscale with subtle differentiation
export const CARD_BASE = 'bg-gray-50 border border-gray-200 rounded-xl hover:bg-white hover:border-gray-300 transition-all duration-200';
export const CARD_PADDING = 'p-4';

// Icon container styles - Minimal grayscale design
export const ICON_BASE = 'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0';
export const ICON_SIZE = 'text-sm';

// Icon styles - Clean grayscale variants
export const ICON_VARIANTS = {
    default: 'bg-gray-100 text-gray-600',
    dark: 'bg-gray-800 text-white',
    light: 'bg-gray-50 text-gray-500 border border-gray-200',
} as const;

// Typography
export const TITLE = 'text-base font-semibold text-gray-900 truncate';
export const SUBTITLE = 'text-xs text-gray-500';

// Layout
export const FLEX_ROW = 'flex items-center gap-3';
export const ACTIONS_CONTAINER = 'flex gap-2 flex-shrink-0';

// Drag handle
export const DRAG_HANDLE = 'cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-50 rounded-lg transition-colors -ml-2';

// Helper function to create icon class
export const getIconClass = (variant: keyof typeof ICON_VARIANTS = 'default') =>
    `${ICON_BASE} ${ICON_VARIANTS[variant]}`;

// Helper function to create card class
export const getCardClass = (extraClasses = '') =>
    `${CARD_BASE} ${extraClasses}`;
