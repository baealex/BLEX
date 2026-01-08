import { useEffect } from 'react';

interface ErrorAlertProps {
    message: string;
    onDismiss?: () => void;
    autoDismiss?: boolean;
    dismissDelay?: number;
}

export const ErrorAlert = ({
    message,
    onDismiss,
    autoDismiss = true,
    dismissDelay = 3000
}: ErrorAlertProps) => {
    useEffect(() => {
        if (autoDismiss && onDismiss) {
            const timer = setTimeout(onDismiss, dismissDelay);
            return () => clearTimeout(timer);
        }
    }, [autoDismiss, onDismiss, dismissDelay]);

    return (
        <div
            className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl shadow-sm animate-fade-in"
            role="alert"
            aria-live="assertive">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                    <svg
                        className="w-5 h-5 text-red-600 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true">
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <span className="font-medium text-sm">{message}</span>
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="text-red-600 hover:text-red-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded-lg p-1"
                        aria-label="오류 메시지 닫기">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
};
