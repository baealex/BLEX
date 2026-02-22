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
            container: 'bg-gray-50 border-gray-200',
            iconColor: 'text-gray-600',
            titleColor: 'text-gray-900',
            textColor: 'text-gray-700',
            defaultIcon: <Info className="w-5 h-5" />
        },
        warning: {
            container: 'bg-amber-50 border-amber-200',
            iconColor: 'text-amber-700',
            titleColor: 'text-amber-900',
            textColor: 'text-amber-800',
            defaultIcon: <AlertTriangle className="w-5 h-5" />
        },
        success: {
            container: 'bg-emerald-50 border-emerald-200',
            iconColor: 'text-emerald-700',
            titleColor: 'text-emerald-900',
            textColor: 'text-emerald-800',
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
