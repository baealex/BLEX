import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { cx } from '../lib/classnames';
import { INTERACTION_DURATION } from '../lib/designTokens';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    size?: 'sm' | 'md' | 'lg';
    variant?: 'ghost' | 'danger-ghost';
    rounded?: 'full' | 'lg';
    'aria-label': string;
    children: ReactNode;
}

const IconButton = ({
    size = 'md',
    variant = 'ghost',
    rounded = 'lg',
    children,
    className = '',
    ...props
}: IconButtonProps) => {
    const baseStyles = `inline-flex items-center justify-center transition-all ${INTERACTION_DURATION} focus:outline-none focus:ring-2 focus:ring-action/20 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`;

    const variantStyles = {
        'ghost': 'text-content-secondary hover:text-content hover:bg-surface-subtle active:bg-line-light',
        'danger-ghost': 'text-danger hover:text-danger hover:bg-danger-surface active:bg-danger-surface'
    };

    const sizeStyles = {
        sm: 'w-11 h-11',
        md: 'w-12 h-12',
        lg: 'w-14 h-14'
    };

    const roundedStyles = {
        full: 'rounded-full',
        lg: 'rounded-lg'
    };

    return (
        <button
            type="button"
            className={cx(baseStyles, variantStyles[variant], sizeStyles[size], roundedStyles[rounded], className)}
            {...props}>
            {children}
        </button>
    );
};

export { IconButton };
