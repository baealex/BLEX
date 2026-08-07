import { useEffect } from 'react';
import { useLingui } from '@lingui/react/macro';
import { X, XCircle } from '@blex/ui/icons';

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
    const { t } = useLingui();

    useEffect(() => {
        if (autoDismiss && onDismiss) {
            const timer = setTimeout(onDismiss, dismissDelay);
            return () => clearTimeout(timer);
        }
    }, [autoDismiss, onDismiss, dismissDelay]);

    return (
        <div
            className="bg-danger-surface border border-danger-line text-danger px-4 py-3 rounded-xl shadow-sm animate-fade-in"
            role="alert"
            aria-live="assertive">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                    <XCircle className="w-5 h-5 text-danger flex-shrink-0" aria-hidden="true" />
                    <span className="font-medium text-sm">{message}</span>
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="text-danger hover:text-danger transition-colors focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-1 rounded-lg p-1"
                        aria-label={t({
                            id: 'common.dismiss_error',
                            message: 'Dismiss error message'
                        })}>
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
};
