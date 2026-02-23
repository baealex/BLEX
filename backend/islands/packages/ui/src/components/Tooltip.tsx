import type { ReactNode } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';

interface TooltipProps {
    children: ReactNode;
    content: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    delayDuration?: number;
}

const Tooltip = ({
    children,
    content,
    side = 'top',
    delayDuration = 300
}: TooltipProps) => {
    return (
        <RadixTooltip.Provider delayDuration={delayDuration}>
            <RadixTooltip.Root>
                <RadixTooltip.Trigger asChild>
                    {children}
                </RadixTooltip.Trigger>
                <RadixTooltip.Portal>
                    <RadixTooltip.Content
                        side={side}
                        sideOffset={6}
                        className="z-50 rounded-lg bg-action px-3 py-1.5 text-xs text-content-inverted shadow-lg animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
                        {content}
                        <RadixTooltip.Arrow className="fill-action" />
                    </RadixTooltip.Content>
                </RadixTooltip.Portal>
            </RadixTooltip.Root>
        </RadixTooltip.Provider>
    );
};

export default Tooltip;
