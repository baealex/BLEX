import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode, ForwardedRef } from 'react';

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
            ...props
        },
        ref
    ) => {
        const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

        const baseInputStyles = 'block w-full rounded-md border border-solid border-gray-200 shadow-sm focus:border-gray-500 focus:ring-gray-500 text-sm p-3 transition-colors';
        const errorStyles = error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : '';
        const iconPadding = leftIcon ? 'pl-10' : rightIcon ? 'pr-10' : '';

        return (
            <div className="w-full">
                {label && (
                    <label htmlFor={inputId} className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        {leftIcon && <span className="mr-2 text-gray-500">{leftIcon}</span>}
                        {label}
                    </label>
                )}

                <div className="relative">
                    {leftIcon && !label && (
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                            {leftIcon}
                        </div>
                    )}

                    {multiline ? (
                        <textarea
                            id={inputId}
                            ref={ref as ForwardedRef<HTMLTextAreaElement>}
                            className={`${baseInputStyles} ${errorStyles} ${iconPadding} ${className}`}
                            rows={rows}
                            {...(props as InputHTMLAttributes<HTMLTextAreaElement>)}
                        />
                    ) : (
                        <input
                            id={inputId}
                            ref={ref as ForwardedRef<HTMLInputElement>}
                            className={`${baseInputStyles} ${errorStyles} ${iconPadding} ${className}`}
                            {...(props as InputHTMLAttributes<HTMLInputElement>)}
                        />
                    )}

                    {rightIcon && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-500">
                            {rightIcon}
                        </div>
                    )}
                </div>

                {error && (
                    <p className="text-gray-500 text-xs mt-1 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                            />
                        </svg>
                        {error}
                    </p>
                )}

                {helperText && !error && (
                    <p className="text-gray-500 text-xs mt-1">{helperText}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export default Input;
