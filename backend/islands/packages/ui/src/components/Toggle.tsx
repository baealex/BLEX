import * as RadixSwitch from '@radix-ui/react-switch';
import { cx } from '../lib/classnames';

interface ToggleProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    size?: 'sm' | 'md';
    disabled?: boolean;
    className?: string;
    'aria-label'?: string;
}

const Toggle = ({
    checked,
    onCheckedChange,
    size = 'md',
    disabled = false,
    className,
    ...props
}: ToggleProps) => {
    const sizes = {
        sm: {
            root: 'w-8 h-5',
            thumb: 'w-4 h-4 data-[state=checked]:translate-x-[14px]'
        },
        md: {
            root: 'w-11 h-6',
            thumb: 'w-5 h-5 data-[state=checked]:translate-x-[22px]'
        }
    };

    const s = sizes[size];

    return (
        <RadixSwitch.Root
            checked={checked}
            onCheckedChange={onCheckedChange}
            disabled={disabled}
            className={cx(
                s.root,
                'rounded-full transition-colors duration-200 relative',
                'focus:outline-none focus:ring-2 focus:ring-black/10 focus:ring-offset-1',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                checked ? 'bg-black' : 'bg-gray-300',
                className
            )}
            {...props}>
            <RadixSwitch.Thumb
                className={cx(
                    s.thumb,
                    'block rounded-full bg-white shadow-sm transition-transform duration-200',
                    'translate-x-0.5'
                )}
            />
        </RadixSwitch.Root>
    );
};

export default Toggle;
