import type { KeyboardEvent, ReactNode } from 'react';
import { useLingui } from '@lingui/react/macro';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { GripVertical } from '@blex/ui/icons';

const LIST_ITEM_SHELL = 'bg-surface ring-1 ring-line/60 rounded-2xl transition-all motion-interaction';
const LIST_ITEM_CONTENT = 'p-5';
const LIST_ITEM_ROW = 'flex items-center gap-3';
const LIST_ITEM_ACTIONS = 'flex gap-2 flex-shrink-0';
const LIST_ITEM_DRAG_HANDLE = 'inline-flex min-h-11 min-w-11 cursor-grab items-center justify-center active:cursor-grabbing text-content-hint hover:text-content-secondary hover:bg-surface-subtle rounded-lg transition-colors -ml-2 [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9';

interface DragHandleProps {
    attributes: DraggableAttributes;
    listeners: SyntheticListenerMap | undefined;
    ariaLabel?: string;
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
    const { t } = useLingui();

    const handleContentKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!onClick) return;

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
        }
    };

    return (
        <div
            className={`${LIST_ITEM_SHELL}${onClick
                ? ' hover:ring-line'
                : ''}`}>
            <div className={LIST_ITEM_CONTENT}>
                <div className={`${LIST_ITEM_ROW}${className ? ` ${className}` : ''}`}>
                    {dragHandleProps && (
                        <div
                            className={LIST_ITEM_DRAG_HANDLE}
                            style={{ touchAction: 'none' }}
                            onClick={(e) => e.stopPropagation()}
                            {...dragHandleProps.attributes}
                            {...dragHandleProps.listeners}
                            aria-label={dragHandleProps.ariaLabel || t({
                                id: 'common.change_order',
                                message: 'Change order'
                            })}>
                            <GripVertical aria-hidden="true" className="h-4 w-4" />
                        </div>
                    )}

                    {onClick ? (
                        <div
                            role="button"
                            tabIndex={0}
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
                            onClick={onClick}
                            onKeyDown={handleContentKeyDown}>
                            {left}
                            <div className="min-w-0 flex-1">
                                {children}
                            </div>
                        </div>
                    ) : (
                        <>
                            {left}
                            <div className="flex-1 min-w-0">
                                {children}
                            </div>
                        </>
                    )}

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
