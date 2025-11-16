import type { ReactNode } from 'react';

interface CardProps {
    title?: string;
    subtitle?: string;
    icon?: ReactNode;
    children: ReactNode;
    className?: string;
    noPadding?: boolean;
}

const Card = ({ title, subtitle, icon, children, className = '', noPadding = false }: CardProps) => {
    return (
        <div className={`bg-gray-50 border border-gray-200 rounded-2xl ${noPadding ? '' : 'p-6'} ${className}`}>
            {(title || subtitle || icon) && (
                <div className={`${noPadding ? 'p-6 pb-4' : 'mb-4'}`}>
                    <div className="flex items-center gap-3">
                        {icon && <div className="text-gray-500">{icon}</div>}
                        <div className="flex-1">
                            {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
                            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
                        </div>
                    </div>
                </div>
            )}
            <div className={noPadding ? 'p-6 pt-0' : ''}>{children}</div>
        </div>
    );
};

export default Card;
