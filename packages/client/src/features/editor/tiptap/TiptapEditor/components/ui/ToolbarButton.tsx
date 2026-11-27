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
        aria-label={title}
        aria-pressed={isActive}
        className={`
            p-2 rounded-md transition-colors duration-200 min-w-[36px] h-9 flex items-center justify-center
            ${isActive ? 'bg-action text-content-inverted' : 'text-content-secondary hover:bg-floating-glass-hover hover:text-content'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${className}
        `}
    >
        {children}
    </button>
);

export default ToolbarButton;
