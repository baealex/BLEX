import type { ReactNode } from 'react';

interface SettingsHeaderProps {
    title: string;
    description?: string;
    action?: ReactNode;
    actionPosition?: 'bottom' | 'right';
}

const SettingsHeader = ({
    title,
    description,
    action,
    actionPosition = 'bottom'
}: SettingsHeaderProps) => {
    if (actionPosition === 'right') {
        return (
            <div className="mb-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <h1 className="text-xl font-semibold tracking-tight text-content">{title}</h1>
                        {description && (
                            <p className="text-sm text-content-secondary leading-relaxed">{description}</p>
                        )}
                    </div>
                    {action && (
                        <div className="flex flex-shrink-0 justify-end">
                            {action}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="mb-5">
            <div className="space-y-1">
                <h1 className="text-xl font-semibold tracking-tight text-content">{title}</h1>
                {description && (
                    <p className="text-sm text-content-secondary leading-relaxed">{description}</p>
                )}
            </div>
            {action && (
                <div className="mt-4">
                    {action}
                </div>
            )}
        </div>
    );
};

export default SettingsHeader;
