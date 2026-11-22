interface ToolbarButtonProps {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
    className?: string;
}

const ToolbarButton = ({
    onClick,
    isActive = false,
    disabled = false,
    title,
    children,
    className = ''
}: ToolbarButtonProps) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`
            p-2 rounded-md transition-colors duration-200 min-w-[36px] h-9 flex items-center justify-center
            ${isActive
                ? 'bg-black text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${className}
        `}>
        {children}
    </button>
);

export default ToolbarButton;
