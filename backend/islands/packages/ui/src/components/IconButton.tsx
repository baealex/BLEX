import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { cx } from '../lib/classnames';

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
    const baseStyles = 'inline-flex items-center justify-center transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles = {
        'ghost': 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
        'danger-ghost': 'text-red-500 hover:text-red-700 hover:bg-red-50'
    };

    const sizeStyles = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12'
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

export default IconButton;
