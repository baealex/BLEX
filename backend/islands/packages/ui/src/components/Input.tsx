import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode, ForwardedRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { cx } from '../lib/classnames';
import { INTERACTION_DURATION } from '../lib/designTokens';

const baseInputStyles = `block w-full rounded-lg border border-line focus:border-line-strong focus:ring-2 focus:ring-line/70 text-sm py-3 px-3 min-h-12 transition-all ${INTERACTION_DURATION} bg-surface-elevated placeholder:text-content-hint text-content`;

interface InputProps extends InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    multiline?: boolean;
    rows?: number;
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
            className = '',
            id,
            required,
            readOnly,
            ...props
        },
        ref
    ) => {
        const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
        const errorId = `${inputId}-error`;
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
                            aria-describedby={error ? errorId : undefined}
                            {...(props as InputHTMLAttributes<HTMLTextAreaElement>)}
                        />
                    ) : (
                        <input
                            ref={ref as ForwardedRef<HTMLInputElement>}
                            id={inputId}
                            readOnly={readOnly}
                            className={inputClasses}
                            aria-invalid={!!error}
                            aria-describedby={error ? errorId : undefined}
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
                    <p className="text-content-secondary text-xs mt-1.5 ml-1">{helperText}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export { Input };
