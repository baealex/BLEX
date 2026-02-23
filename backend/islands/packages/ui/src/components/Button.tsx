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
        primary: 'text-content-inverted bg-action hover:bg-action-hover focus:ring-action/20 border-transparent',
        secondary: 'text-content bg-surface-elevated border-line-strong shadow-sm hover:bg-surface-subtle hover:border-line focus:ring-line-strong/70 active:bg-line-light',
        danger: 'text-content-inverted bg-danger hover:bg-danger focus:ring-danger/30 border-transparent',
        ghost: 'text-content-secondary hover:text-content hover:bg-surface-subtle focus:ring-line/70 border-transparent'
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

export { Button };
