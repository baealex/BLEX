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
    const containerClasses = ['py-16 text-center border border-dashed border-line rounded-2xl', className]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={containerClasses}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-subtle mb-4">
                <i className={`${iconClassName} text-2xl text-content-hint`} />
            </div>
            <h3 className="text-lg font-semibold text-content mb-1">{title}</h3>
            {description && (
                <p className={`text-content-secondary text-sm ${action ? 'mb-6' : ''}`}>{description}</p>
            )}
            {action}
        </div>
    );
};

export default SettingsEmptyState;
