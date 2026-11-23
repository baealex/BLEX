import type { AppLocale } from '../i18n/locale';

type ToastCall = (message: unknown, options?: Record<string, unknown>) => unknown;

type LazyToast = ToastCall & {
    success: ToastCall;
    error: ToastCall;
    info: ToastCall;
    warning: ToastCall;
    loading: ToastCall;
    promise: (...args: unknown[]) => unknown;
    dismiss: (...args: unknown[]) => unknown;
    message: ToastCall;
};

declare global {
    interface Window {
        configuration: {
            media: string;
            static: string;
            locale: AppLocale;
            timeZone: string;
            user?: {
                isAuthenticated: 'True';
                username: string;
            };
        };
        NEXT_URL: string;
        toast: LazyToast;
    }
}
