import { toast as sonnerToast } from 'sonner';

/**
 * Toast notification utility using Sonner
 * A modern, beautiful toast notification library
 */

// Re-export all Sonner toast methods
export const toast = Object.assign(
    // Default toast
    (message: string) => sonnerToast(message),
    {
        // Toast methods
        success: (message: string) => sonnerToast.success(message),
        error: (message: string) => sonnerToast.error(message),
        info: (message: string) => sonnerToast.info(message),
        warning: (message: string) => sonnerToast.warning(message),
        loading: (message: string) => sonnerToast.loading(message),
        promise: sonnerToast.promise,
        dismiss: sonnerToast.dismiss
    }
);
