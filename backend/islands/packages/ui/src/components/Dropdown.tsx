import type { ReactNode } from 'react';
import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface DropdownItem {
    label: string;
    icon?: string;
    onClick: () => void;
    variant?: 'default' | 'danger';
    checked?: boolean; // Added for selection support
    className?: string; // Added for custom styling
}

interface DropdownProps {
    items: DropdownItem[];
    trigger?: ReactNode;
    align?: 'start' | 'end' | 'center' | 'left' | 'right';
}

const Dropdown = ({ items, trigger, align = 'end' }: DropdownProps) => {
    const [open, setOpen] = useState(false);

    const alignProp: 'start' | 'end' | 'center' =
        align === 'right' ? 'end' :
        align === 'left' ? 'start' :
        align;

    return (
        <DropdownMenu.Root open={open} modal={false} onOpenChange={setOpen}>
            <DropdownMenu.Trigger
                asChild
                onClick={() => setOpen(!open)}
                onPointerDown={(e) => e.preventDefault()}>
                {trigger ? (
                    trigger
                ) : (
                    <button
                        className="p-2 text-content-secondary hover:text-content hover:bg-surface-subtle rounded-lg transition-colors outline-none"
                        aria-label="메뉴 열기">
                        <i className="fas fa-ellipsis-v" />
                    </button>
                )}
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    className="z-50 min-w-[12rem] w-[var(--radix-dropdown-menu-trigger-width)] bg-surface-elevated border border-line rounded-xl shadow-lg py-1 animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 max-h-60 overflow-y-auto"
                    align={alignProp}
                    sideOffset={5}
                    onClick={(e) => e.stopPropagation()}>
                    {items.map((item, index) => (
                        <DropdownMenu.Item
                            key={index}
                            onClick={item.onClick}
                            className={`
                                relative flex items-center px-4 py-2.5 text-sm gap-3 cursor-pointer select-none outline-none
                                transition-colors
                                ${item.variant === 'danger'
                                    ? 'text-danger focus:bg-danger-surface hover:bg-danger-surface'
                                    : 'text-content-secondary focus:bg-surface-subtle hover:bg-surface-subtle'
                                }
                                ${item.checked ? 'bg-surface-subtle text-content font-medium' : ''}
                                ${item.className || ''}
                            `}>
                            {item.icon && <i className={`${item.icon} w-4 text-center`} />}
                            <span className="flex-1">{item.label}</span>
                            {item.checked && (
                                <i className="fas fa-check text-content-secondary text-xs ml-2" />
                            )}
                        </DropdownMenu.Item>
                    ))}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
};

export { Dropdown };
