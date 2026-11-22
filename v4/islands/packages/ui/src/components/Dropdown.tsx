import type { ReactNode } from 'react';
import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, EllipsisVertical } from 'lucide-react';

interface DropdownItem {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    variant?: 'default' | 'danger';
    checked?: boolean; // Added for selection support
    className?: string; // Added for custom styling
}

interface DropdownProps {
    items: DropdownItem[];
    trigger?: ReactNode;
    triggerAriaLabel?: string;
    triggerClassName?: string;
    align?: 'start' | 'end' | 'center' | 'left' | 'right';
    density?: 'default' | 'compact';
}

const dropdownItemDensityStyles = {
    default: 'px-4 py-2.5',
    compact: 'min-h-11 px-4 py-2 [@media(pointer:fine)]:min-h-10'
} as const;

const Dropdown = ({
    items,
    trigger,
    triggerAriaLabel = 'Open menu',
    triggerClassName = '',
    align = 'end',
    density = 'default'
}: DropdownProps) => {
    const [open, setOpen] = useState(false);

    const alignProp: 'start' | 'end' | 'center' =
        align === 'right' ? 'end' :
        align === 'left' ? 'start' :
        align;
    const hasSelectionItems = items.some(item => item.checked !== undefined);
    const selectedItemValue = String(items.findIndex(item => item.checked));

    const getItemClassName = (item: DropdownItem) => `
        relative flex items-center text-sm gap-3 cursor-pointer select-none outline-none
        transition-colors
        ${dropdownItemDensityStyles[density]}
        ${item.variant === 'danger'
            ? 'text-danger focus:bg-danger-surface hover:bg-danger-surface'
            : 'text-content-secondary focus:bg-surface-subtle hover:bg-surface-subtle'
        }
        ${item.checked ? 'bg-surface-subtle text-content font-medium' : ''}
        ${item.className || ''}
    `;

    const renderItemContent = (item: DropdownItem) => (
        <>
            {typeof item.icon === 'string' ? (
                <i aria-hidden="true" className={`${item.icon} w-4 text-center`} />
            ) : item.icon ? (
                <span
                    aria-hidden="true"
                    className="inline-flex w-4 shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
                    {item.icon}
                </span>
            ) : null}
            <span className="flex-1">{item.label}</span>
            {item.checked && (
                <Check aria-hidden="true" className="ml-2 h-3.5 w-3.5 text-content-secondary" />
            )}
        </>
    );

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
                        type="button"
                        className={`inline-flex items-center justify-center rounded-lg p-2 text-content-secondary outline-none transition-colors hover:bg-surface-subtle hover:text-content focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-2 ${triggerClassName}`}
                        aria-label={triggerAriaLabel}>
                        <EllipsisVertical aria-hidden="true" className="h-4 w-4" />
                    </button>
                )}
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    className="z-50 min-w-[12rem] w-[var(--radix-dropdown-menu-trigger-width)] bg-surface-elevated border border-line rounded-xl shadow-lg py-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 max-h-60 overflow-y-auto"
                    align={alignProp}
                    sideOffset={5}
                    onClick={(e) => e.stopPropagation()}>
                    {hasSelectionItems ? (
                        <DropdownMenu.RadioGroup value={selectedItemValue}>
                            {items.map((item, index) => (
                                <DropdownMenu.RadioItem
                                    key={index}
                                    value={String(index)}
                                    onSelect={item.onClick}
                                    className={getItemClassName(item)}>
                                    {renderItemContent(item)}
                                </DropdownMenu.RadioItem>
                            ))}
                        </DropdownMenu.RadioGroup>
                    ) : items.map((item, index) => (
                        <DropdownMenu.Item
                            key={index}
                            onSelect={item.onClick}
                            className={getItemClassName(item)}>
                            {renderItemContent(item)}
                        </DropdownMenu.Item>
                    ))}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
};

export { Dropdown };
