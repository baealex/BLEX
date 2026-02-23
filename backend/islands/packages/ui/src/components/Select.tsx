import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check, AlertCircle } from 'lucide-react';

const EMPTY_VALUE = '__select_none__';

interface SelectItem {
    value: string;
    label: string;
}

interface SelectProps {
    value: string;
    onValueChange: (value: string) => void;
    items: SelectItem[];
    placeholder?: string;
    error?: string;
    className?: string;
}

const Select = ({
    value,
    onValueChange,
    items,
    placeholder = '선택하세요',
    error,
    className = ''
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
            <RadixSelect.Root value={internalValue} onValueChange={handleValueChange}>
                <RadixSelect.Trigger
                    aria-invalid={!!error}
                    className={`
                        w-full flex items-center justify-between px-4 py-3
                        bg-surface-elevated border border-line rounded-xl
                        text-sm text-content
                        hover:border-line-strong focus:outline-none focus:ring-2 focus:ring-line/70 focus:border-line-strong
                        transition-colors cursor-pointer
                        data-[placeholder]:text-content-hint
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
                        className="z-50 bg-surface-elevated border border-line rounded-xl shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95"
                        position="popper"
                        sideOffset={5}
                        style={{ width: 'var(--radix-select-trigger-width)' }}>
                        <RadixSelect.Viewport className="p-1 max-h-60">
                            {internalItems.map((item) => (
                                <RadixSelect.Item
                                    key={item.value}
                                    value={item.value}
                                    className={`
                                        relative flex items-center px-4 py-2.5 text-sm rounded-lg
                                        cursor-pointer select-none outline-none
                                        text-content-secondary
                                        data-[highlighted]:bg-surface-subtle data-[highlighted]:text-content
                                        data-[state=checked]:bg-line-light data-[state=checked]:text-content data-[state=checked]:font-medium
                                        transition-colors
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
