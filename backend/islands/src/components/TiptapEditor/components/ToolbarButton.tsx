import React from 'react';

interface ToolbarButtonProps {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
    className?: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
    onClick,
    isActive = false,
    disabled = false,
    title,
    children,
    className = ''
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`
            p-2 rounded-md transition-colors duration-200 min-w-[36px] h-9 flex items-center justify-center
            ${isActive
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-solid border-gray-300'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${className}
        `}>
        {children}
    </button>
);

export default ToolbarButton;