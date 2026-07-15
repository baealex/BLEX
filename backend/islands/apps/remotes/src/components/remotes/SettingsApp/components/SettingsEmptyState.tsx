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
    const containerClasses = ['rounded-2xl border border-dashed border-line py-10 text-center', className]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={containerClasses}>
            <div
                aria-hidden="true"
                className="mb-2.5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-surface-subtle text-content-hint [&>svg]:h-4 [&>svg]:w-4">
                {icon ?? <i className={`${iconClassName} text-lg`} />}
            </div>
            <h3 className={`text-base font-semibold text-content ${action && !description ? 'mb-5' : description ? 'mb-1' : ''}`}>
                {title}
            </h3>
            {description && (
                <p className={`text-sm text-content-secondary ${action ? 'mb-5' : ''}`}>{description}</p>
            )}
            {action}
        </div>
    );
};

export default SettingsEmptyState;
