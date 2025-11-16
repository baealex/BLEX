interface LoadingStateProps {
    rows?: number;
    type?: 'card' | 'list' | 'form';
}

const LoadingState = ({ rows = 3, type = 'form' }: LoadingStateProps) => {
    if (type === 'card') {
        return (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-40 mb-6" />
                    <div className="space-y-4">
                        {[...Array(rows)].map((_, i) => (
                            <div key={i} className="bg-gray-50 rounded-2xl p-6">
                                <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
                                <div className="h-10 bg-gray-200 rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (type === 'list') {
        return (
            <div className="space-y-3 animate-pulse">
                {[...Array(rows)].map((_, i) => (
                    <div key={i} className="flex items-start gap-4 p-5 bg-gray-50 rounded-2xl">
                        <div className="w-12 h-12 bg-gray-200 rounded-xl flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-48" />
                            <div className="h-4 bg-gray-200 rounded w-32" />
                            <div className="h-3 bg-gray-200 rounded w-20" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Default form type
    return (
        <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
            <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-32 mb-6" />
                <div className="space-y-4">
                    {[...Array(rows)].map((_, i) => (
                        <div key={i}>
                            <div className="h-4 bg-gray-200 rounded w-16 mb-2" />
                            <div className="h-10 bg-gray-200 rounded" />
                        </div>
                    ))}
                </div>
                <div className="h-12 bg-gray-200 rounded w-full mt-6" />
            </div>
        </div>
    );
};

export default LoadingState;
