import type { KeyboardEvent, ReactNode } from 'react';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

const LIST_ITEM_SHELL = 'bg-surface ring-1 ring-line/60 rounded-2xl transition-all motion-interaction';
const LIST_ITEM_CONTENT = 'p-5';
const LIST_ITEM_ROW = 'flex items-center gap-3';
const LIST_ITEM_ACTIONS = 'flex gap-2 flex-shrink-0';
const LIST_ITEM_DRAG_HANDLE = 'cursor-grab active:cursor-grabbing text-content-hint hover:text-content-secondary p-2 hover:bg-surface-subtle rounded-lg transition-colors -ml-2';

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
            className={`${LIST_ITEM_SHELL}${onClick
                ? ' cursor-pointer hover:ring-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong'
                : ''}`}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}>
            <div className={LIST_ITEM_CONTENT}>
                <div className={`${LIST_ITEM_ROW}${className ? ` ${className}` : ''}`}>
                    {dragHandleProps && (
                        <div
                            className={LIST_ITEM_DRAG_HANDLE}
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
                        <div className={LIST_ITEM_ACTIONS} onClick={(e) => e.stopPropagation()}>
                            {actions}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsListItem;
