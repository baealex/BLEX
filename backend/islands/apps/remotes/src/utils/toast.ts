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
    if (typeof document === 'undefined') {
        return null;
    }

    const existingToaster = document.getElementById(TOASTER_ROOT_ID);
    if (existingToaster) {
        return existingToaster;
    }

    const toaster = document.createElement('island-component');
    toaster.id = TOASTER_ROOT_ID;
    toaster.setAttribute('name', 'Toaster');
    toaster.dataset.islandName = 'Toaster';
    toaster.dataset.islandStatus = 'pending';
    document.body.appendChild(toaster);

    return toaster;
};

const runWhenToasterReady = <T>(callback: () => T) => {
    const toaster = ensureToaster();
    if (!toaster || toaster.dataset.islandStatus === 'mounted') {
        return callback();
    }

    let isResolved = false;
    let observer: MutationObserver | undefined;
    const timeoutRef: { id?: number } = {};

    const run = () => {
        if (isResolved) return;

        isResolved = true;
        if (timeoutRef.id !== undefined) {
            window.clearTimeout(timeoutRef.id);
        }
        observer?.disconnect();
        callback();
    };

    if (typeof MutationObserver !== 'undefined') {
        observer = new MutationObserver(() => {
            if (toaster.dataset.islandStatus === 'mounted') {
                run();
            }
        });
        observer.observe(toaster, {
            attributes: true,
            attributeFilter: ['data-island-status']
        });
    }

    timeoutRef.id = window.setTimeout(run, 1000);
};

export const toast = Object.assign(
    (message: ToastMessage, options?: ToastOptions) => {
        return runWhenToasterReady(() => sonnerToast(message, options));
    },
    {
        success: (message: ToastMessage, options?: ToastOptions) => {
            return runWhenToasterReady(() => sonnerToast.success(message, {
                duration: DURATION.success,
                ...options
            }));
        },
        error: (message: ToastMessage, options?: ToastOptions) => {
            return runWhenToasterReady(() => sonnerToast.error(message, {
                duration: DURATION.error,
                ...options
            }));
        },
        info: (message: ToastMessage, options?: ToastOptions) => {
            return runWhenToasterReady(() => sonnerToast.info(message, {
                duration: DURATION.info,
                ...options
            }));
        },
        warning: (message: ToastMessage, options?: ToastOptions) => {
            return runWhenToasterReady(() => sonnerToast.warning(message, {
                duration: DURATION.warning,
                ...options
            }));
        },
        loading: (...args: Parameters<typeof sonnerToast.loading>) => {
            return runWhenToasterReady(() => sonnerToast.loading(...args));
        },
        promise: (...args: Parameters<typeof sonnerToast.promise>) => {
            return runWhenToasterReady(() => sonnerToast.promise(...args));
        },
        dismiss: sonnerToast.dismiss,
        message: (...args: Parameters<typeof sonnerToast.message>) => {
            return runWhenToasterReady(() => sonnerToast.message(...args));
        }
    }
);
