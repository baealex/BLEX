import type { ReactNode } from 'react';
import { FLOATING_GLASS_SURFACE, INTERACTION_DURATION } from '../lib/designTokens';

interface FloatingBottomBarProps {
    children: ReactNode;
}

const FloatingBottomBar = ({ children }: FloatingBottomBarProps) => (
    <div
        className="fixed left-0 right-0 z-30 flex justify-center pointer-events-none"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
        <div className={`pointer-events-auto ${FLOATING_GLASS_SURFACE} rounded-full px-2 py-2 sm:px-3 sm:py-3 flex items-center gap-1 sm:gap-2 transform transition-all ${INTERACTION_DURATION}`}>
            {children}
        </div>
    </div>
);

export { FloatingBottomBar };
