import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';

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
    className?: string;
}

const Select = ({
    value,
    onValueChange,
    items,
    placeholder = '선택하세요',
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

    return (
        <RadixSelect.Root value={internalValue} onValueChange={handleValueChange}>
            <RadixSelect.Trigger
                className={`
                    w-full flex items-center justify-between px-4 py-3
                    bg-white border border-gray-200 rounded-xl
                    text-sm text-gray-900
                    hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-400
                    transition-colors cursor-pointer
                    data-[placeholder]:text-gray-400
                    ${className}
                `}>
                <RadixSelect.Value placeholder={placeholder} />
                <RadixSelect.Icon>
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                </RadixSelect.Icon>
            </RadixSelect.Trigger>

            <RadixSelect.Portal>
                <RadixSelect.Content
                    className="z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95"
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
                                    text-gray-700
                                    data-[highlighted]:bg-gray-50 data-[highlighted]:text-gray-900
                                    data-[state=checked]:bg-gray-100 data-[state=checked]:text-gray-900 data-[state=checked]:font-medium
                                    transition-colors
                                `}>
                                <RadixSelect.ItemText>{item.label}</RadixSelect.ItemText>
                                <RadixSelect.ItemIndicator className="absolute right-3">
                                    <Check className="w-4 h-4 text-gray-600" />
                                </RadixSelect.ItemIndicator>
                            </RadixSelect.Item>
                        ))}
                    </RadixSelect.Viewport>
                </RadixSelect.Content>
            </RadixSelect.Portal>
        </RadixSelect.Root>
    );
};

export default Select;
