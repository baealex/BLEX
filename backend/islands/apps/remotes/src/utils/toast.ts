import type { ReactNode } from 'react';
import { toast as sonnerToast } from '@blex/ui/toast';

const TOASTER_ROOT_ID = 'blex-toast-root';

const DURATION = {
    success: 2000,
    error: 5000,
    info: 3000,
    warning: 4000
} as const;

type ToastMessage = string | ReactNode;

type ToastOptions = {
    duration?: number;
    [key: string]: unknown;
};

const ensureToaster = () => {
    if (typeof document === 'undefined' || document.getElementById(TOASTER_ROOT_ID)) {
        return;
    }

    const toaster = document.createElement('island-component');
    toaster.id = TOASTER_ROOT_ID;
    toaster.setAttribute('name', 'Toaster');
    toaster.dataset.islandName = 'Toaster';
    toaster.dataset.islandStatus = 'pending';
    document.body.appendChild(toaster);
};

export const toast = Object.assign(
    (message: ToastMessage, options?: ToastOptions) => {
        ensureToaster();
        return sonnerToast(message, options);
    },
    {
        success: (message: ToastMessage, options?: ToastOptions) => {
            ensureToaster();
            return sonnerToast.success(message, {
                duration: DURATION.success,
                ...options
            });
        },
        error: (message: ToastMessage, options?: ToastOptions) => {
            ensureToaster();
            return sonnerToast.error(message, {
                duration: DURATION.error,
                ...options
            });
        },
        info: (message: ToastMessage, options?: ToastOptions) => {
            ensureToaster();
            return sonnerToast.info(message, {
                duration: DURATION.info,
                ...options
            });
        },
        warning: (message: ToastMessage, options?: ToastOptions) => {
            ensureToaster();
            return sonnerToast.warning(message, {
                duration: DURATION.warning,
                ...options
            });
        },
        loading: (...args: Parameters<typeof sonnerToast.loading>) => {
            ensureToaster();
            return sonnerToast.loading(...args);
        },
        promise: (...args: Parameters<typeof sonnerToast.promise>) => {
            ensureToaster();
            return sonnerToast.promise(...args);
        },
        dismiss: sonnerToast.dismiss,
        message: (...args: Parameters<typeof sonnerToast.message>) => {
            ensureToaster();
            return sonnerToast.message(...args);
        }
    }
);
