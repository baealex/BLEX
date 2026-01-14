import type { ReactNode } from 'react';

interface SettingsHeaderProps {
    title: string;
    description?: string;
    action?: ReactNode;
    /** Position of the action element. Default: 'bottom' */
    actionPosition?: 'bottom' | 'right';
}

/**
 * Common header component for Settings pages.
 * Provides consistent styling for title, description, and optional action button.
 */
const SettingsHeader = ({
    title,
    description,
    action,
    actionPosition = 'bottom'
}: SettingsHeaderProps) => {
    // Right position: title/description on left, action on right (same row)
    if (actionPosition === 'right') {
        return (
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
                    {description && (
                        <p className="text-gray-600">{description}</p>
                    )}
                </div>
                {action && <div>{action}</div>}
            </div>
        );
    }

    // Bottom position (default): action below title/description
    return (
        <div className="mb-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
                {description && (
                    <p className="text-gray-600">{description}</p>
                )}
            </div>
            {action && (
                <div>{action}</div>
            )}
        </div>
    );
};

export default SettingsHeader;
