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

        const baseInputStyles = 'block w-full rounded-2xl border border-gray-200 shadow-sm focus:border-black/30 focus:ring-4 focus:ring-black/5 text-sm p-3.5 transition-all duration-200 bg-white placeholder-gray-400 text-gray-900 font-medium';
        const errorStyles = error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10 bg-red-50/30' : '';

        const leftPadding = leftIcon && !label ? 'pl-11' : '';
        const rightPadding = rightIcon ? 'pr-11' : '';

        return (
            <div className="w-full group">
                {label && (
                    <label htmlFor={inputId} className="flex items-center text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide ml-1">
                        {leftIcon && <span className="mr-2 text-gray-400">{leftIcon}</span>}
                        {label}
                    </label>
                )}

                <div className="relative">
                    {leftIcon && !label && (
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-gray-600 transition-colors">
                            {leftIcon}
                        </div>
                    )}

                    {multiline ? (
                        <textarea
                            id={inputId}
                            ref={ref as ForwardedRef<HTMLTextAreaElement>}
                            className={`${baseInputStyles} ${errorStyles} ${className} resize-y min-h-[100px]`}
                            rows={rows}
                            {...(props as InputHTMLAttributes<HTMLTextAreaElement>)}
                        />
                    ) : (
                        <input
                            id={inputId}
                            ref={ref as ForwardedRef<HTMLInputElement>}
                            className={`${baseInputStyles} ${errorStyles} ${leftPadding} ${rightPadding} ${className}`}
                            {...(props as InputHTMLAttributes<HTMLInputElement>)}
                        />
                    )}

                    {rightIcon && (
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-gray-600 transition-colors">
                            {rightIcon}
                        </div>
                    )}
                </div>

                {error && (
                    <p className="text-red-500 text-xs mt-1.5 flex items-center font-medium ml-1 animate-fadeIn">
                        <svg className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
                    <p className="text-gray-500 text-xs mt-1.5 ml-1">{helperText}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export default Input;
