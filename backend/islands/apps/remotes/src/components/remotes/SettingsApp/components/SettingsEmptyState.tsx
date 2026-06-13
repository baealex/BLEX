import type { ReactNode } from 'react';

interface SettingsEmptyStateProps {
    iconClassName: string;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

const SettingsEmptyState = ({
    iconClassName,
    title,
    description,
    action,
    className = ''
}: SettingsEmptyStateProps) => {
    const containerClasses = ['py-10 text-center border border-dashed border-line rounded-2xl', className]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={containerClasses}>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surface-subtle mb-3">
                <i className={`${iconClassName} text-lg text-content-hint`} />
            </div>
            <h3 className="text-base font-semibold text-content mb-1">{title}</h3>
            {description && (
                <p className={`text-content-secondary text-sm ${action ? 'mb-5' : ''}`}>{description}</p>
            )}
            {action}
        </div>
    );
};

export default SettingsEmptyState;
