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
            <div className="mb-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h2>
                        {description && (
                            <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
                        )}
                    </div>
                    {action && <div className="flex-shrink-0">{action}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="mb-6">
            <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h2>
                {description && (
                    <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
                )}
            </div>
            {action && (
                <div className="mt-6">
                    {action}
                </div>
            )}
        </div>
    );
};

export default SettingsHeader;
