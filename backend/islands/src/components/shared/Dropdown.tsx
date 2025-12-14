import type { ReactNode } from 'react';
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
    const alignProp: 'start' | 'end' | 'center' =
        align === 'right' ? 'end' :
        align === 'left' ? 'start' :
        align;

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                {trigger ? (
                    trigger
                ) : (
                    <button
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors outline-none"
                        aria-label="메뉴 열기">
                        <i className="fas fa-ellipsis-v" />
                    </button>
                )}
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    className="z-50 min-w-[12rem] w-[var(--radix-dropdown-menu-trigger-width)] bg-white border border-gray-200 rounded-xl shadow-lg py-1 animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 max-h-60 overflow-y-auto"
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
                                    ? 'text-red-600 focus:bg-red-50 hover:bg-red-50'
                                    : 'text-gray-700 focus:bg-gray-50 hover:bg-gray-50'
                                }
                                ${item.checked ? 'bg-gray-50 text-gray-900 font-medium' : ''}
                                ${item.className || ''}
                            `}>
                            {item.icon && <i className={`${item.icon} w-4 text-center`} />}
                            <span className="flex-1">{item.label}</span>
                            {item.checked && (
                                <i className="fas fa-check text-gray-600 text-xs ml-2" />
                            )}
                        </DropdownMenu.Item>
                    ))}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
};

export default Dropdown;
