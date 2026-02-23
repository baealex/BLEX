import type { ReactNode } from 'react';
import { FLOATING_GLASS_SURFACE, INTERACTION_DURATION } from '../lib/designTokens';

interface FloatingBottomBarProps {
    children: ReactNode;
}

const FloatingBottomBar = ({ children }: FloatingBottomBarProps) => (
    <div className="fixed sm:sticky bottom-6 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className={`pointer-events-auto ${FLOATING_GLASS_SURFACE} rounded-full px-3 py-3 flex items-center gap-2 transform transition-all ${INTERACTION_DURATION}`}>
            {children}
        </div>
    </div>
);

export { FloatingBottomBar };
