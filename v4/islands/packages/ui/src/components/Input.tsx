import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode, ForwardedRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { cx } from '../lib/classnames';
import { INTERACTION_DURATION } from '../lib/designTokens';

const baseInputStyles = `block w-full rounded-lg border border-line focus:border-line-strong focus:ring-2 focus:ring-line/70 text-sm transition-all ${INTERACTION_DURATION} bg-surface-elevated placeholder:text-content-hint text-content`;

const inputDensityStyles = {
    default: 'min-h-12 px-3 py-3',
    compact: 'min-h-11 px-3 py-2 [@media(pointer:fine)]:min-h-10'
} as const;

interface InputProps extends InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    multiline?: boolean;
    rows?: number;
    density?: keyof typeof inputDensityStyles;
}

const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
    (
        {
            label,
            error,
            helperText,
            leftIcon,
            rightIcon,
            multiline = false,
            rows = 4,
            density = 'default',
            className = '',
            id,
            required,
            readOnly,
            'aria-describedby': ariaDescribedBy,
            ...props
        },
        ref
    ) => {
        const generatedId = useId();
        const inputId = id ?? `input-${generatedId}`;
        const errorId = `${inputId}-error`;
        const helperId = `${inputId}-helper`;
        const describedBy = [
            ariaDescribedBy,
            error ? errorId : helperText ? helperId : undefined
        ].filter(Boolean).join(' ') || undefined;
        const errorStyles = error ? 'border-danger-line focus:border-danger focus:ring-danger/20 bg-danger-surface/70' : '';
        const readOnlyStyles = readOnly ? '!bg-surface-subtle !text-content-hint cursor-default focus:!ring-0 focus:!border-line' : '';

        // Padding logic
        const leftPadding = leftIcon ? 'pl-11' : '';
        const rightPadding = rightIcon ? 'pr-11' : '';

        // Icon position styles
        const iconBase = 'absolute flex pointer-events-none text-content-hint pl-4 pr-4';
        const iconPosition = multiline ? 'top-0 pt-3 items-start' : 'inset-y-0 items-center';

        const inputClasses = cx(
            baseInputStyles,
            inputDensityStyles[density],
            readOnlyStyles,
            errorStyles,
            leftPadding,
            rightPadding,
            multiline && 'resize-y min-h-[100px]'
        );

        return (
            <div className={cx('relative', className)}>
                {label && (
                    <label htmlFor={inputId} className="block text-sm font-medium text-content-secondary mb-1.5 ml-1">
                        {label} {required && <span className="text-danger">*</span>}
                    </label>
                )}

                <div className="relative">
                    {leftIcon && (
                        <div className={cx(iconBase, iconPosition, 'left-0')}>
                            {leftIcon}
                        </div>
                    )}

                    {multiline ? (
                        <textarea
                            ref={ref as ForwardedRef<HTMLTextAreaElement>}
                            id={inputId}
                            rows={rows}
                            readOnly={readOnly}
                            className={inputClasses}
                            aria-invalid={!!error}
                            aria-describedby={describedBy}
                            {...(props as InputHTMLAttributes<HTMLTextAreaElement>)}
                        />
                    ) : (
                        <input
                            ref={ref as ForwardedRef<HTMLInputElement>}
                            id={inputId}
                            readOnly={readOnly}
                            className={inputClasses}
                            aria-invalid={!!error}
                            aria-describedby={describedBy}
                            {...(props as InputHTMLAttributes<HTMLInputElement>)}
                        />
                    )}

                    {rightIcon && (
                        <div className={cx(iconBase, iconPosition, 'right-0')}>
                            {rightIcon}
                        </div>
                    )}
                </div>

                {error && (
                    <p id={errorId} role="alert" className="mt-1.5 text-sm text-danger ml-1 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {error}
                    </p>
                )}

                {helperText && !error && (
                    <p id={helperId} className="text-content-secondary text-xs mt-1.5 ml-1">{helperText}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export { Input };
