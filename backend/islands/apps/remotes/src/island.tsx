import { StrictMode, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import App from './components/App';
import ErrorBoundary from './components/ErrorBoundary';
import { createQueryClient, sessionStoragePersister } from './lib/query-client';

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
        toast: LazyToast;
        __blexIslandMonitor?: {
            notifyBootstrap?: () => void;
            notifyMounted?: (name: string) => void;
            notifyFailed?: (name: string, reason: string) => void;
        };
    }
}

const loadToast = () => import('./utils/toast').then((module) => module.toast);

const createLazyToastCall = (method?: keyof LazyToast) =>
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

const markIslandMounted = (element: HTMLElement, name: string) => {
    element.dataset.islandName = name;
    element.dataset.islandStatus = 'mounted';
    window.__blexIslandMonitor?.notifyMounted?.(name);
};

const markIslandFailed = (element: HTMLElement, name: string, reason: string) => {
    element.dataset.islandName = name;
    element.dataset.islandStatus = 'error';
    element.dataset.islandError = reason;
    window.__blexIslandMonitor?.notifyFailed?.(name, reason);
};

const IslandMountSignal = ({
    element,
    name,
    children
}: {
    element: HTMLElement;
    name: string;
    children: ReactNode;
}) => {
    useEffect(() => {
        markIslandMounted(element, name);
    }, [element, name]);

    return children;
};

const IslandErrorFallback = ({
    element,
    name
}: {
    element: HTMLElement;
    name: string;
}) => {
    useEffect(() => {
        markIslandFailed(element, name, 'render_error');
    }, [element, name]);

    return <div>Component Error: {name}</div>;
};

window.__blexIslandMonitor?.notifyBootstrap?.();

if (!customElements.get('island-component')) {
    customElements.define('island-component', class extends HTMLElement {
    private observer: IntersectionObserver | null = null;
    private isRendered = false;

    constructor() {
        super();
    }

    connectedCallback(): void {
        const name = this.getAttribute('name');
        const lazy = this.getAttribute('lazy') === 'true';

        if (!name) {
            return;
        }

        this.dataset.islandName = name;
        this.dataset.islandStatus = lazy ? 'pending' : 'loading';

        if (lazy) {
            this.setupLazyLoading(name);
        } else {
            this.renderComponent(name);
        }
    }

    disconnectedCallback(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    private setupLazyLoading(name: string): void {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !this.isRendered) {
                        this.dataset.islandStatus = 'loading';
                        this.renderComponent(name);
                        this.isRendered = true;
                        if (this.observer) {
                            this.observer.disconnect();
                            this.observer = null;
                        }
                    }
                });
            },
            {
                rootMargin: '100px',
                threshold: 0.1
            }
        );

        this.observer.observe(this);
    }

    private renderComponent(name: string): void {
        try {
            const props = this.getAttribute('props')
                ? JSON.parse(decodeURIComponent(this.getAttribute('props') || ''))
                : {};
            const queryClient = createQueryClient();
            const root = createRoot(this);
            root.render(
                <StrictMode>
                    <ErrorBoundary fallback={<IslandErrorFallback element={this} name={name} />}>
                        <PersistQueryClientProvider
                            client={queryClient}
                            persistOptions={{
                                persister: sessionStoragePersister,
                                maxAge: 1000 * 60 * 60 * 24
                            }}>
                            <IslandMountSignal element={this} name={name}>
                                <App __name={name} {...props} />
                            </IslandMountSignal>
                        </PersistQueryClientProvider>
                    </ErrorBoundary>
                </StrictMode>
            );
        } catch {
            markIslandFailed(this, name, 'bootstrap_error');
            this.innerHTML = `<div>Component Error: ${name}</div>`;
        }
    }
    });
}
