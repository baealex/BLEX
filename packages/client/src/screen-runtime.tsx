import { StrictMode, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from '@lingui/react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { MountNotifier, renderScreen } from './components/screen-content';
import ErrorBoundary from './components/ErrorBoundary';
import { parseScreen } from './components/screen-props';
import { i18n } from './i18n';
import { activateScreenLocale } from './i18n/screen-catalog';
import { createQueryClient, sessionStoragePersister, shouldPersistQuery } from './lib/query-client';

const SCREEN_SELECTOR = '[data-screen]';
const mountedScreens = new Map<HTMLElement, Root>();
const screenErrorText = (name: string) => `Component Error: ${name}`;

const markScreenFailed = (element: HTMLElement, reason: string) => {
    element.dataset.screenStatus = 'error';
    element.dataset.screenError = reason;
};

const mountScreen = async (element: HTMLElement, name: string): Promise<void> => {
    try {
        const encodedProps = element.dataset.screenProps;
        const props: unknown = encodedProps ? JSON.parse(decodeURIComponent(encodedProps)) : {};
        const screen = parseScreen(name, props);
        if (!screen) throw new Error();

        await activateScreenLocale();
        if (!element.isConnected) {
            element.dataset.screenStatus = 'pending';
            return;
        }

        const queryClient = createQueryClient();
        const root = createRoot(element);
        mountedScreens.set(element, root);
        const handleMounted = () => {
            element.dataset.screenStatus = 'mounted';
        };
        root.render(
            <StrictMode>
                <ErrorBoundary
                    fallback={<div>{screenErrorText(name)}</div>}
                    onError={() => markScreenFailed(element, 'render_error')}
                >
                    <I18nProvider i18n={i18n}>
                        <PersistQueryClientProvider
                            client={queryClient}
                            persistOptions={{
                                persister: sessionStoragePersister,
                                maxAge: 1000 * 60 * 60 * 24,
                                dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery }
                            }}
                        >
                            <Suspense>
                                {renderScreen(screen)}
                                <MountNotifier onMounted={handleMounted} />
                            </Suspense>
                        </PersistQueryClientProvider>
                    </I18nProvider>
                </ErrorBoundary>
            </StrictMode>
        );
    } catch {
        markScreenFailed(element, 'bootstrap_error');
        element.textContent = screenErrorText(name);
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

const visitScreensIn = (node: Node, visit: (screen: HTMLElement) => void) => {
    if (!(node instanceof HTMLElement)) return;
    const nested = node.querySelectorAll<HTMLElement>(SCREEN_SELECTOR);
    if (node.matches(SCREEN_SELECTOR)) visit(node);
    nested.forEach(visit);
};

const stopScreen = (screen: HTMLElement) => {
    if (screen.isConnected) return;
    mountedScreens.get(screen)?.unmount();
    mountedScreens.delete(screen);
};

visitScreensIn(document.body, startScreen);
new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.removedNodes) visitScreensIn(node, stopScreen);
        for (const node of mutation.addedNodes) visitScreensIn(node, startScreen);
    }
}).observe(document.body, {
    childList: true,
    subtree: true
});
