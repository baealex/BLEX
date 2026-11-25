import type { ReactNode } from 'react';
import { FLOATING_BAR_SURFACE, INTERACTION_DURATION } from '../lib/designTokens';

interface FloatingBottomBarProps {
    children: ReactNode;
}

/** The bar every editor keeps at the bottom of the window; the post page's dock wears the same surface. */
const FloatingBottomBar = ({ children }: FloatingBottomBarProps) => (
    <div
        className="fixed left-0 right-0 z-30 flex justify-center pointer-events-none"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
    >
        <div
            className={`pointer-events-auto ${FLOATING_BAR_SURFACE} rounded-full px-2 py-1.5 flex items-center gap-1 transform transition-all ${INTERACTION_DURATION}`}
        >
            {children}
        </div>
    </div>
);

/** Separates groups of actions inside the bar. */
const FloatingBarDivider = () => <div aria-hidden="true" className="mx-1.5 h-5 w-px shrink-0 bg-line" />;

export { FloatingBarDivider, FloatingBottomBar };
