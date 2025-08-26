import { createRoot } from 'react-dom/client';
import App from './components/App';
import ErrorBoundary from './components/ErrorBoundary';

customElements.define('island-component', class extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback(): void {
        const name = this.getAttribute('name');
        const props = this.getAttribute('props') ? JSON.parse(decodeURIComponent(this.getAttribute('props') || '')) : {};

        if (!name) {
            return;
        }

        try {
            const root = createRoot(this);
            root.render(
                <ErrorBoundary fallback={<div>Component Error: {name}</div>}>
                    <App __name={name} {...props} />
                </ErrorBoundary>
            );
        } catch {
            this.innerHTML = `<div>Component Error: ${name}</div>`;
        }
    }
});
