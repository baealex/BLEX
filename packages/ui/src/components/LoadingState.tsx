interface LoadingStateProps {
    type?: 'list' | 'form' | 'spinner';
    ariaLabel: string;
}

const LoadingState = ({ type = 'form', ariaLabel }: LoadingStateProps) => {
    const spacing = type === 'spinner'
        ? 'p-8'
        : type === 'list'
            ? 'py-12'
            : 'min-h-52 py-16';

    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={ariaLabel}
            className={`flex items-center justify-center gap-2 text-sm font-medium text-content-secondary ${spacing}`}>
            <span
                aria-hidden="true"
                className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-action motion-reduce:animate-none"
            />
            <span>{ariaLabel}</span>
        </div>
    );
};

export { LoadingState };
