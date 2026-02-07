import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cx } from '../lib/classnames';

interface CheckboxProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    label?: string;
    description?: string;
    disabled?: boolean;
    className?: string;
}

const Checkbox = ({
    checked,
    onCheckedChange,
    label,
    description,
    disabled = false,
    className
}: CheckboxProps) => {
    return (
        <label className={cx('flex items-start gap-3 cursor-pointer group', disabled && 'opacity-50 cursor-not-allowed', className)}>
            <RadixCheckbox.Root
                checked={checked}
                onCheckedChange={(value) => onCheckedChange(value === true)}
                disabled={disabled}
                className={cx(
                    'w-5 h-5 shrink-0 rounded border-2 transition-all duration-150 mt-0.5',
                    'flex items-center justify-center',
                    'focus:outline-none focus:ring-2 focus:ring-black/10 focus:ring-offset-1',
                    checked
                        ? 'bg-black border-black'
                        : 'border-gray-300 bg-white group-hover:border-gray-400'
                )}>
                <RadixCheckbox.Indicator>
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                </RadixCheckbox.Indicator>
            </RadixCheckbox.Root>
            {(label || description) && (
                <div className="flex-1 min-w-0">
                    {label && <div className="text-sm font-medium text-gray-900">{label}</div>}
                    {description && <div className="text-xs text-gray-500">{description}</div>}
                </div>
            )}
        </label>
    );
};

export default Checkbox;
