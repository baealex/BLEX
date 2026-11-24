import { type ReactNode, StrictMode, useEffect } from 'react';
import { I18nProvider } from '@lingui/react';
import { showToaster } from '~/application/toaster';
import ErrorBoundary from '~/components/ErrorBoundary';
import { i18n } from '~/i18n';
import { toast as sonnerToast } from '~/ui/toast';

const DURATION = {
    success: 2000,
    error: 5000,
    info: 3000,
    warning: 4000
} as const;

// Sonner drops a toast sent before its toaster listens, so the first toasts wait for it, but not past this.
const TOASTER_WAIT_MS = 1000;

type ToastMessage = string | ReactNode;

type ToastOptions = {
    duration?: number;
    [key: string]: unknown;
};

const Mounted = ({ onMounted }: { onMounted: () => void }) => {
    useEffect(onMounted, [onMounted]);
    return null;
};

let toasterMounted = false;
let toasterReady: Promise<void> | null = null;

/**
 * The toaster loads with the first toast and renders in the application, beside its prompts.
 * It shows over work in progress, so a toaster that fails to load or render only loses its toasts.
 */
const mountToaster = () => {
    toasterReady ??= new Promise<void>((resolve) => {
        const ready = () => {
            toasterMounted = true;
            resolve();
        };
        window.setTimeout(resolve, TOASTER_WAIT_MS);
        import('~/features/toaster').then(({ default: Toaster }) => {
            showToaster(
                <StrictMode>
                    <ErrorBoundary fallback={null} onError={resolve}>
                        <I18nProvider i18n={i18n}>
                            <Toaster />
                            <Mounted onMounted={ready} />
                        </I18nProvider>
                    </ErrorBoundary>
                </StrictMode>
            );
        }, resolve);
    });
    return toasterReady;
};

const runWhenToasterReady = <T,>(callback: () => T) => {
    if (toasterMounted) {
        return callback();
    }

    void mountToaster().then(callback);
};

export const toast = Object.assign(
    (message: ToastMessage, options?: ToastOptions) => {
        return runWhenToasterReady(() => sonnerToast(message, options));
    },
    {
        success: (message: ToastMessage, options?: ToastOptions) => {
            return runWhenToasterReady(() =>
                sonnerToast.success(message, {
                    duration: DURATION.success,
                    ...options
                })
            );
        },
        error: (message: ToastMessage, options?: ToastOptions) => {
            return runWhenToasterReady(() =>
                sonnerToast.error(message, {
                    duration: DURATION.error,
                    ...options
                })
            );
        },
        info: (message: ToastMessage, options?: ToastOptions) => {
            return runWhenToasterReady(() =>
                sonnerToast.info(message, {
                    duration: DURATION.info,
                    ...options
                })
            );
        },
        warning: (message: ToastMessage, options?: ToastOptions) => {
            return runWhenToasterReady(() =>
                sonnerToast.warning(message, {
                    duration: DURATION.warning,
                    ...options
                })
            );
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
