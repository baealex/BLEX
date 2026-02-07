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
            container: 'bg-blue-50 border-blue-200',
            iconColor: 'text-blue-600',
            titleColor: 'text-blue-900',
            textColor: 'text-blue-800',
            defaultIcon: <Info className="w-5 h-5" />
        },
        warning: {
            container: 'bg-yellow-50 border-yellow-200',
            iconColor: 'text-yellow-600',
            titleColor: 'text-yellow-900',
            textColor: 'text-yellow-800',
            defaultIcon: <AlertTriangle className="w-5 h-5" />
        },
        success: {
            container: 'bg-green-50 border-green-200',
            iconColor: 'text-green-600',
            titleColor: 'text-green-900',
            textColor: 'text-green-800',
            defaultIcon: <CheckCircle className="w-5 h-5" />
        },
        error: {
            container: 'bg-red-50 border-red-200',
            iconColor: 'text-red-600',
            titleColor: 'text-red-900',
            textColor: 'text-red-800',
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
