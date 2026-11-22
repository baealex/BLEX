const ISLAND_SELECTOR = 'island-component';
const LAZY_ROOT_MARGIN = '300px';

let runtimePromise: Promise<unknown> | null = null;
let lazyObserver: IntersectionObserver | null = null;
let mutationObserver: MutationObserver | null = null;

const loadIslandRuntime = () => {
    if (runtimePromise) {
        return runtimePromise;
    }

    lazyObserver?.disconnect();
    lazyObserver = null;
    mutationObserver?.disconnect();
    mutationObserver = null;

    runtimePromise = import('../island').catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[BLEX islands] Failed to load the island runtime', error);
        window.__blexIslandMonitor?.notifyFailed?.('runtime', 'load_error');
        throw error;
    });

    return runtimePromise;
};

const observeLazyIsland = (element: Element) => {
    if (!('IntersectionObserver' in window)) {
        void loadIslandRuntime();
        return;
    }

    if (!lazyObserver) {
        lazyObserver = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                void loadIslandRuntime();
            }
        }, {
            rootMargin: LAZY_ROOT_MARGIN,
            threshold: 0
        });
    }

    lazyObserver.observe(element);
};

const processIsland = (element: Element) => {
    if (runtimePromise || customElements.get(ISLAND_SELECTOR)) {
        return;
    }

    if (element.getAttribute('lazy') === 'true') {
        observeLazyIsland(element);
        return;
    }

    void loadIslandRuntime();
};

const processAddedNode = (node: Node) => {
    if (!(node instanceof Element)) {
        return;
    }

    if (node.matches(ISLAND_SELECTOR)) {
        processIsland(node);
    }

    node.querySelectorAll(ISLAND_SELECTOR).forEach(processIsland);
};

const initializeIslandLoader = () => {
    document.querySelectorAll(ISLAND_SELECTOR).forEach(processIsland);

    if (runtimePromise || !('MutationObserver' in window)) {
        return;
    }

    mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(processAddedNode);

            if (runtimePromise) {
                return;
            }
        }
    });
    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
};

type ToastMethod =
    | 'success'
    | 'error'
    | 'info'
    | 'warning'
    | 'loading'
    | 'promise'
    | 'dismiss'
    | 'message';

const loadToast = () => import('../utils/toast').then((module) => module.toast);

const createLazyToastCall = (method?: ToastMethod) =>
    (...args: unknown[]) => loadToast().then((toast) => {
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

initializeIslandLoader();
