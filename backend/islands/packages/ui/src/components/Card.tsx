import type { ReactNode } from 'react';

interface CardProps {
    title?: string;
    subtitle?: string;
    icon?: ReactNode;
    children: ReactNode;
    className?: string;
    noPadding?: boolean;
}

const Card = ({
 title,
 subtitle,
 icon,
 children,
 className = '',
 noPadding = false
}: CardProps) => {
    return (
        <div className={`bg-surface ring-1 ring-line/60 rounded-2xl ${noPadding ? '' : 'p-6 md:p-8'} ${className}`}>
            {(title || subtitle || icon) && (
                <div className={`${noPadding ? 'p-6 md:p-8 pb-4' : 'mb-6'}`}>
                    <div className="flex items-start gap-4">
                        {icon && (
                            <div className="p-2.5 bg-surface-subtle rounded-xl text-content-secondary">
                                {icon}
                            </div>
                        )}
                        <div className="flex-1 min-w-0 pt-1">
                            {title && <h3 className="text-lg font-semibold text-content tracking-tight">{title}</h3>}
                            {subtitle && <p className="text-sm text-content-secondary mt-1 leading-relaxed">{subtitle}</p>}
                        </div>
                    </div>
                </div>
            )}
            <div className={noPadding ? 'p-6 md:p-8 pt-0' : ''}>{children}</div>
        </div>
    );
};

export default Card;
