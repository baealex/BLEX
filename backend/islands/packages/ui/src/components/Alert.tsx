import type { ReactNode } from 'react';
import { Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

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
            container: 'bg-surface-subtle border-line',
            iconColor: 'text-content-secondary',
            titleColor: 'text-content',
            textColor: 'text-content-secondary',
            defaultIcon: <Info className="w-5 h-5" />
        },
        warning: {
            container: 'bg-warning-surface border-warning-line',
            iconColor: 'text-warning',
            titleColor: 'text-content',
            textColor: 'text-content-secondary',
            defaultIcon: <AlertTriangle className="w-5 h-5" />
        },
        success: {
            container: 'bg-success-surface border-success-line',
            iconColor: 'text-success',
            titleColor: 'text-content',
            textColor: 'text-content-secondary',
            defaultIcon: <CheckCircle className="w-5 h-5" />
        },
        error: {
            container: 'bg-danger-surface border-danger-line',
            iconColor: 'text-danger',
            titleColor: 'text-content',
            textColor: 'text-content-secondary',
            defaultIcon: <XCircle className="w-5 h-5" />
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
