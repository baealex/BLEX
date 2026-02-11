import { toast as sonnerToast } from '@blex/ui';

const DURATION = {
    success: 2000,
    error: 5000,
    info: 3000,
    warning: 4000
} as const;

type ToastOptions = {
    duration?: number;
    [key: string]: unknown;
};

export const toast = Object.assign(
    (message: string | React.ReactNode, options?: ToastOptions) =>
        sonnerToast(message, options),
    {
        success: (message: string | React.ReactNode, options?: ToastOptions) =>
            sonnerToast.success(message, {
                duration: DURATION.success,
                ...options
            }),
        error: (message: string | React.ReactNode, options?: ToastOptions) =>
            sonnerToast.error(message, {
                duration: DURATION.error,
                ...options
            }),
        info: (message: string | React.ReactNode, options?: ToastOptions) =>
            sonnerToast.info(message, {
                duration: DURATION.info,
                ...options
            }),
        warning: (message: string | React.ReactNode, options?: ToastOptions) =>
            sonnerToast.warning(message, {
                duration: DURATION.warning,
                ...options
            }),
        loading: sonnerToast.loading,
        promise: sonnerToast.promise,
        dismiss: sonnerToast.dismiss,
        message: sonnerToast.message
    }
);
