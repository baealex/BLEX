import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '../lib/classnames';
import { INTERACTION_DURATION } from '../lib/designTokens';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    fullWidth?: boolean;
    children: ReactNode;
}

const Button = ({
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    children,
    className = '',
    disabled,
    ...props
}: ButtonProps) => {
    const baseStyles = `inline-flex justify-center items-center gap-2 border border-transparent font-semibold transition-all ${INTERACTION_DURATION} focus:outline-none focus:ring-4 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`;

    const variantStyles = {
        primary: 'text-white bg-gray-900 hover:bg-gray-800 focus:ring-gray-900/20 border-transparent',
        secondary: 'text-gray-800 bg-white border-gray-300 shadow-sm hover:bg-gray-50 hover:border-gray-400 focus:ring-gray-300 active:bg-gray-100',
        danger: 'text-white bg-red-600 hover:bg-red-700 focus:ring-red-500/30 border-transparent',
        ghost: 'text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-200 border-transparent'
    };

    const sizeStyles = {
        sm: 'px-3 py-1.5 text-xs rounded-lg min-h-[36px]',
        md: 'px-4.5 py-2 text-sm rounded-lg min-h-[40px]',
        lg: 'px-6 py-2.5 text-base rounded-lg min-h-[44px]'
    };

    const widthStyle = fullWidth ? 'w-full' : '';

    return (
        <button
            className={cx(baseStyles, variantStyles[variant], sizeStyles[size], widthStyle, className)}
            disabled={disabled || isLoading}
            {...props}>
            {isLoading ? (
                <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    {children}
                </>
            ) : (
                <>
                    {leftIcon && <span>{leftIcon}</span>}
                    {children}
                    {rightIcon && <span>{rightIcon}</span>}
                </>
            )}
        </button>
    );
};

export default Button;
