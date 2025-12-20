import type { ReactNode } from 'react';

interface AlertProps {
    variant?: 'info' | 'warning' | 'success' | 'error';
    title?: string;
    children: ReactNode;
    icon?: ReactNode;
    className?: string;
}

const Alert = ({
    variant = 'info',
    title,
    children,
    icon,
    className = ''
}: AlertProps) => {
    const variants = {
        info: {
            container: 'bg-blue-50 border-blue-200',
            iconColor: 'text-blue-600',
            titleColor: 'text-blue-900',
            textColor: 'text-blue-800',
            defaultIcon: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
            )
        },
        warning: {
            container: 'bg-yellow-50 border-yellow-200',
            iconColor: 'text-yellow-600',
            titleColor: 'text-yellow-900',
            textColor: 'text-yellow-800',
            defaultIcon: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
            )
        },
        success: {
            container: 'bg-green-50 border-green-200',
            iconColor: 'text-green-600',
            titleColor: 'text-green-900',
            textColor: 'text-green-800',
            defaultIcon: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
            )
        },
        error: {
            container: 'bg-red-50 border-red-200',
            iconColor: 'text-red-600',
            titleColor: 'text-red-900',
            textColor: 'text-red-800',
            defaultIcon: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
            )
        }
    };

    const config = variants[variant];
    const displayIcon = icon || config.defaultIcon;

    return (
        <div className={`${config.container} border rounded-xl p-4 ${className}`}>
            <div className="flex items-start gap-3">
                <div className={`${config.iconColor} flex-shrink-0 mt-0.5`}>
                    {displayIcon}
                </div>
                <div className="flex-1 min-w-0">
                    {title && (
                        <h4 className={`text-sm font-semibold ${config.titleColor} mb-1`}>
                            {title}
                        </h4>
                    )}
                    <div className={`text-sm ${config.textColor} ${title ? '' : 'leading-relaxed'}`}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Alert;
