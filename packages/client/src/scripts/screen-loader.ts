const SCREEN_SELECTOR = '[data-screen]';

let runtimePromise: Promise<unknown> | null = null;
let mutationObserver: MutationObserver | null = null;

const loadScreenRuntime = () => {
    if (runtimePromise) {
        return runtimePromise;
    }

    mutationObserver?.disconnect();
    mutationObserver = null;

    runtimePromise = import('../screen-runtime').catch((error: unknown) => {
        console.error('[BLEX] Failed to load the screen runtime', error);
        // A tab opened before a deploy asks for files that are gone, so it takes the reload a missing catalog starts.
        document.dispatchEvent(new Event('blex:catalog-failed'));
        throw error;
    });

    return runtimePromise;
};

const containsScreen = (node: Node) =>
    node instanceof Element && (node.matches(SCREEN_SELECTOR) || node.querySelector(SCREEN_SELECTOR) !== null);

const initializeScreenLoader = () => {
    if (document.querySelector(SCREEN_SELECTOR)) {
        void loadScreenRuntime();
        return;
    }

    if (!('MutationObserver' in window)) {
        return;
    }

    mutationObserver = new MutationObserver((mutations) => {
        if (mutations.some((mutation) => Array.from(mutation.addedNodes).some(containsScreen))) {
            void loadScreenRuntime();
        }
    });
    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
};

type ToastMethod = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'promise' | 'dismiss' | 'message';

const loadToast = () => import('../utils/toast').then((module) => module.toast);

const createLazyToastCall =
    (method?: ToastMethod) =>
    (...args: unknown[]) =>
        loadToast().then((toast) => {
            if (method) {
                return (toast[method] as (...toastArgs: unknown[]) => unknown)(...args);
            }

            return (toast as (...toastArgs: unknown[]) => unknown)(...args);
        });

window.toast = Object.assign(createLazyToastCall(), {
    success: createLazyToastCall('success'),
    error: createLazyToastCall('error'),
    info: createLazyToastCall('info'),
    warning: createLazyToastCall('warning'),
    loading: createLazyToastCall('loading'),
    promise: createLazyToastCall('promise'),
    dismiss: createLazyToastCall('dismiss'),
    message: createLazyToastCall('message')
});

initializeScreenLoader();
