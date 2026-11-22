import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '@lingui/react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import App from './components/App';
import ErrorBoundary from './components/ErrorBoundary';
import { activateDocumentLocale, i18n } from './i18n';
import { createQueryClient, sessionStoragePersister, shouldPersistQuery } from './lib/query-client';

const SCREEN_SELECTOR = '[data-screen]';

const markScreenFailed = (element: HTMLElement, reason: string) => {
    element.dataset.screenStatus = 'error';
    element.dataset.screenError = reason;
};

const ScreenErrorFallback = ({
    element,
    name
}: {
    element: HTMLElement;
    name: string;
}) => {
    useEffect(() => {
        markScreenFailed(element, 'render_error');
    }, [element]);

    return <div>Component Error: {name}</div>;
};

const mountScreen = async (element: HTMLElement, name: string): Promise<void> => {
    try {
        await activateDocumentLocale();
        if (!element.isConnected) {
            element.dataset.screenStatus = 'pending';
            return;
        }

        const encodedProps = element.dataset.screenProps;
        const props = encodedProps ? JSON.parse(decodeURIComponent(encodedProps)) : {};
        const queryClient = createQueryClient();
        const root = createRoot(element);
        const handleMounted = () => {
            element.dataset.screenStatus = 'mounted';
        };
        root.render(
            <StrictMode>
                <ErrorBoundary fallback={<ScreenErrorFallback element={element} name={name} />}>
                    <I18nProvider i18n={i18n}>
                        <PersistQueryClientProvider
                            client={queryClient}
                            persistOptions={{
                                persister: sessionStoragePersister,
                                maxAge: 1000 * 60 * 60 * 24,
                                dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery }
                            }}>
                            <App __name={name} __onMounted={handleMounted} {...props} />
                        </PersistQueryClientProvider>
                    </I18nProvider>
                </ErrorBoundary>
            </StrictMode>
        );
    } catch {
        markScreenFailed(element, 'bootstrap_error');
        element.innerHTML = `<div>Component Error: ${name}</div>`;
    }
};

const startScreen = (element: HTMLElement) => {
    const name = element.dataset.screen;
    if (!name || element.dataset.screenStatus !== 'pending') {
        return;
    }

    element.dataset.screenStatus = 'loading';
    void mountScreen(element, name);
};

const startScreensIn = (node: Node) => {
    if (!(node instanceof HTMLElement)) {
        return;
    }

    if (node.matches(SCREEN_SELECTOR)) {
        startScreen(node);
    }
    node.querySelectorAll<HTMLElement>(SCREEN_SELECTOR).forEach(startScreen);
};

startScreensIn(document.body);
new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        mutation.addedNodes.forEach(startScreensIn);
    }
}).observe(document.body, {
    childList: true,
    subtree: true
});
