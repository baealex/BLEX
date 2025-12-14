import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode, ForwardedRef } from 'react';
import { baseInputStyles } from './settingsStyles';
import { cx } from '~/lib/classnames';

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
        const errorStyles = error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10 bg-red-50/30' : '';
        const readOnlyStyles = readOnly ? '!bg-gray-50 !text-gray-500 cursor-default focus:!ring-0 focus:!border-gray-200' : '';

        // Padding logic
        const leftPadding = leftIcon ? 'pl-11' : '';
        const rightPadding = rightIcon ? 'pr-11' : '';

        // Icon position styles
        const iconBase = 'absolute flex pointer-events-none text-gray-400 pl-4 pr-4';
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
                    <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">
                        {label} {required && <span className="text-red-500">*</span>}
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
                            {...(props as InputHTMLAttributes<HTMLTextAreaElement>)}
                        />
                    ) : (
                        <input
                            ref={ref as ForwardedRef<HTMLInputElement>}
                            id={inputId}
                            readOnly={readOnly}
                            className={inputClasses}
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
                    <p className="mt-1.5 text-sm text-red-500 ml-1 flex items-center gap-1.5">
                        <i className="fas fa-exclamation-circle text-xs" />
                        {error}
                    </p>
                )}

                {helperText && !error && (
                    <p className="text-gray-500 text-xs mt-1.5 ml-1">{helperText}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export default Input;
