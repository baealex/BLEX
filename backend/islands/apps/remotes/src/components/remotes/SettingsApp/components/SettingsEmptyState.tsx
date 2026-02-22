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
    const containerClasses = ['py-16 text-center border border-dashed border-gray-200 rounded-2xl', className]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={containerClasses}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-50 mb-4">
                <i className={`${iconClassName} text-2xl text-gray-300`} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
            {description && (
                <p className={`text-gray-500 text-sm ${action ? 'mb-6' : ''}`}>{description}</p>
            )}
            {action}
        </div>
    );
};

export default SettingsEmptyState;
