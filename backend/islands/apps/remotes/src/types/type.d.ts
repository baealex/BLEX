import type Alpine from 'alpinejs';
import 'react';

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

declare module 'react' {
    interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
        jsx?: boolean;
        global?: boolean;
    }
}

declare module '*.scss' {
    const content: { [className: string]: string };
    export default content;
}

declare global {
    interface Window {
        Alpine: Alpine;
        configuration: {
            media: string;
            static: string;
            user?: {
                isAuthenticated: boolean;
                username: string;
            };
            googleClientId?: string;
            githubClientId?: string;
        };
        NEXT_URL: string;
        toast: LazyToast;
        __blexIslandMonitor?: {
            notifyBootstrap?: () => void;
            notifyMounted?: (name: string) => void;
            notifyFailed?: (name: string, reason: string) => void;
        };
    }
}
