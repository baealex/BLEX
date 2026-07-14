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
            root: 'h-11 w-11 -mx-1.5 -my-3',
            track: 'before:h-5 before:w-8',
            thumb: 'left-1.5 w-4 h-4 data-[state=checked]:translate-x-[14px]'
        },
        md: {
            root: 'h-11 w-11 -my-2.5',
            track: 'before:h-6 before:w-11',
            thumb: 'left-0 w-5 h-5 data-[state=checked]:translate-x-[22px]'
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
                s.track,
                'relative inline-flex shrink-0 cursor-pointer items-center rounded-full bg-transparent p-0',
                'before:absolute before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:content-[\'\']',
                'transition-transform duration-150 before:transition-colors before:duration-150 active:scale-95',
                'motion-reduce:transition-none motion-reduce:before:transition-none',
                'focus:outline-none focus-visible:before:ring-2 focus-visible:before:ring-action/20',
                'focus-visible:before:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
                checked ? 'before:bg-action' : 'before:bg-line-strong',
                className
            )}
            {...props}>
            <RadixSwitch.Thumb
                className={cx(
                    s.thumb,
                    'absolute top-1/2 block -translate-y-1/2 translate-x-0.5 rounded-full',
                    'bg-surface-elevated shadow-sm transition-transform duration-150 motion-reduce:transition-none'
                )}
            />
        </RadixSwitch.Root>
    );
};

export { Toggle };
