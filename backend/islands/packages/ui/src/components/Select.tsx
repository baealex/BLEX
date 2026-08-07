import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check, AlertCircle } from 'lucide-react';

const EMPTY_VALUE = '__select_none__';

interface SelectItem {
    value: string;
    label: string;
}

const selectDensityStyles = {
    default: {
        trigger: 'px-4 py-3 rounded-xl',
        item: 'px-4 py-2.5'
    },
    compact: {
        trigger: 'min-h-11 px-3 py-2.5 rounded-lg [@media(pointer:fine)]:min-h-10 [@media(pointer:fine)]:py-2',
        item: 'min-h-11 px-3 py-2 [@media(pointer:fine)]:min-h-10'
    }
} as const;

interface SelectProps {
    value: string;
    onValueChange: (value: string) => void;
    items: SelectItem[];
    ariaLabel?: string;
    placeholder?: string;
    error?: string;
    className?: string;
    disabled?: boolean;
    density?: keyof typeof selectDensityStyles;
}

const Select = ({
    value,
    onValueChange,
    items,
    ariaLabel,
    placeholder = 'Select an option',
    error,
    className = '',
    disabled = false,
    density = 'default'
}: SelectProps) => {
    // Convert empty string to internal placeholder value
    const internalValue = value === '' ? EMPTY_VALUE : value;

    const handleValueChange = (newValue: string) => {
        // Convert internal placeholder value back to empty string
        onValueChange(newValue === EMPTY_VALUE ? '' : newValue);
    };

    // Convert items with empty value to internal placeholder value
    const internalItems = items.map(item => ({
        ...item,
        value: item.value === '' ? EMPTY_VALUE : item.value
    }));

    const errorStyles = error
        ? 'border-danger-line focus:border-danger focus:ring-danger/20 bg-danger-surface/70'
        : '';

    return (
        <div>
            <RadixSelect.Root value={internalValue} onValueChange={handleValueChange} disabled={disabled}>
                <RadixSelect.Trigger
                    aria-label={ariaLabel}
                    aria-invalid={!!error}
                    className={`
                        flex w-full items-center justify-between
                        bg-surface-elevated border border-line
                        text-sm text-content
                        hover:border-line-strong focus:outline-none focus:ring-2 focus:ring-line/70 focus:border-line-strong
                        transition-colors cursor-pointer
                        disabled:cursor-not-allowed disabled:opacity-50
                        data-[placeholder]:text-content-hint
                        ${selectDensityStyles[density].trigger}
                        ${errorStyles}
                        ${className}
                    `}>
                    <RadixSelect.Value placeholder={placeholder} />
                    <RadixSelect.Icon>
                        <ChevronDown className="w-4 h-4 text-content-hint shrink-0" />
                    </RadixSelect.Icon>
                </RadixSelect.Trigger>

                <RadixSelect.Portal>
                    <RadixSelect.Content
                        className="z-50 bg-surface-elevated border border-line rounded-xl shadow-lg overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                        position="popper"
                        sideOffset={5}
                        style={{ width: 'var(--radix-select-trigger-width)' }}>
                        <RadixSelect.Viewport className="p-1 max-h-60">
                            {internalItems.map((item) => (
                                <RadixSelect.Item
                                    key={item.value}
                                    value={item.value}
                                    className={`
                                        relative flex items-center text-sm rounded-lg
                                        cursor-pointer select-none outline-none
                                        text-content-secondary
                                        data-[highlighted]:bg-surface-subtle data-[highlighted]:text-content
                                        data-[state=checked]:bg-line-light data-[state=checked]:text-content data-[state=checked]:font-medium
                                        transition-colors
                                        ${selectDensityStyles[density].item}
                                    `}>
                                    <RadixSelect.ItemText>{item.label}</RadixSelect.ItemText>
                                    <RadixSelect.ItemIndicator className="absolute right-3">
                                        <Check className="w-4 h-4 text-content-secondary" />
                                    </RadixSelect.ItemIndicator>
                                </RadixSelect.Item>
                            ))}
                        </RadixSelect.Viewport>
                    </RadixSelect.Content>
                </RadixSelect.Portal>
            </RadixSelect.Root>
            {error && (
                <p role="alert" className="mt-1.5 text-sm text-danger ml-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {error}
                </p>
            )}
        </div>
    );
};

export { Select };
