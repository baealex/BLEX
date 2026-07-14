import type { KeyboardEvent, ReactNode } from 'react';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import {
    getCardClass,
    CARD_PADDING,
    FLEX_ROW,
    ACTIONS_CONTAINER,
    DRAG_HANDLE
} from '~/components/shared';

interface DragHandleProps {
    attributes: DraggableAttributes;
    listeners: SyntheticListenerMap | undefined;
}

interface SettingsListItemProps {
    onClick?: () => void;
    className?: string;
    dragHandleProps?: DragHandleProps;
    left?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
}

const SettingsListItem = ({
    onClick,
    className,
    dragHandleProps,
    left,
    actions,
    children
}: SettingsListItemProps) => {
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!onClick || event.target !== event.currentTarget) return;

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
        }
    };

    return (
        <div
            className={getCardClass(onClick
                ? 'cursor-pointer hover:ring-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong'
                : '')}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}>
            <div className={CARD_PADDING}>
                <div className={`${FLEX_ROW}${className ? ` ${className}` : ''}`}>
                    {dragHandleProps && (
                        <div
                            className={DRAG_HANDLE}
                            style={{ touchAction: 'none' }}
                            onClick={(e) => e.stopPropagation()}
                            {...dragHandleProps.attributes}
                            {...dragHandleProps.listeners}>
                            <i className="fas fa-grip-vertical" />
                        </div>
                    )}

                    {left}

                    <div className="flex-1 min-w-0">
                        {children}
                    </div>

                    {actions && (
                        <div className={ACTIONS_CONTAINER} onClick={(e) => e.stopPropagation()}>
                            {actions}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsListItem;
