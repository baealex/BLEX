interface LoadingStateProps {
    rows?: number;
    type?: 'list' | 'form' | 'spinner';
}

const LoadingState = ({ rows = 3, type = 'form' }: LoadingStateProps) => {
    if (type === 'list') {
        return (
            <div className="space-y-3 animate-pulse" role="status" aria-live="polite" aria-label="로딩 중">
                {[...Array(rows)].map((_, i) => (
                    <div key={i} className="flex items-start gap-4 p-5 bg-surface-subtle rounded-2xl">
                        <div className="w-12 h-12 bg-line-light rounded-xl flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-line-light rounded w-48" />
                            <div className="h-4 bg-line-light rounded w-32" />
                            <div className="h-3 bg-line-light rounded w-20" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (type === 'spinner') {
        return (
            <div className="flex items-center justify-center p-8" role="status" aria-live="polite" aria-label="로딩 중">
                <div className="relative w-8 h-8">
                    <svg className="animate-spin text-action" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                </div>
            </div>
        );
    }

    // Default form type
    return (
        <div role="status" aria-live="polite" aria-label="로딩 중">
            <div className="animate-pulse">
                <div className="h-8 bg-line-light rounded w-32 mb-6" />
                <div className="space-y-4">
                    {[...Array(rows)].map((_, i) => (
                        <div key={i}>
                            <div className="h-4 bg-line-light rounded w-16 mb-2" />
                            <div className="h-10 bg-line-light rounded" />
                        </div>
                    ))}
                </div>
                <div className="h-12 bg-line-light rounded w-full mt-6" />
            </div>
        </div>
    );
};

export default LoadingState;
