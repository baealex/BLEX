import { createRoot } from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import App from './components/App';
import ErrorBoundary from './components/ErrorBoundary';
import { createQueryClient, sessionStoragePersister } from './lib/query-client';

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
        const props = this.getAttribute('props')
            ? JSON.parse(decodeURIComponent(this.getAttribute('props') || ''))
            : {};

        try {
            const queryClient = createQueryClient();
            const root = createRoot(this);
            root.render(
                <ErrorBoundary fallback={<div>Component Error: {name}</div>}>
                    <PersistQueryClientProvider
                        client={queryClient}
                        persistOptions={{
                            persister: sessionStoragePersister,
                            maxAge: 1000 * 60 * 60 * 24
                        }}>
                        <App __name={name} {...props} />
                    </PersistQueryClientProvider>
                </ErrorBoundary>
            );
        } catch {
            this.innerHTML = `<div>Component Error: ${name}</div>`;
        }
    }
});
