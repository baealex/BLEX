import type { ReactNode } from 'react';

type SettingsEmptyStateIconProps =
    | { icon: ReactNode; iconClassName?: string }
    | { icon?: never; iconClassName: string };

type SettingsEmptyStateProps = SettingsEmptyStateIconProps & {
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
};

const SettingsEmptyState = ({
    icon,
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
            <div
                aria-hidden="true"
                className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-surface-subtle text-content-hint [&>svg]:h-5 [&>svg]:w-5">
                {icon ?? <i className={`${iconClassName} text-lg`} />}
            </div>
            <h3 className={`text-base font-semibold text-content ${action && !description ? 'mb-5' : description ? 'mb-1' : ''}`}>
                {title}
            </h3>
            {description && (
                <p className={`text-content-secondary text-sm ${action ? 'mb-5' : ''}`}>{description}</p>
            )}
            {action}
        </div>
    );
};

export default SettingsEmptyState;
