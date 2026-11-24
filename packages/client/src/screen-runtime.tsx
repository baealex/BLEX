import { type ReactNode, StrictMode, Suspense, useEffect, useState } from 'react';
import { I18nProvider } from '@lingui/react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ScreenPage } from './application/screen-page';
import ErrorBoundary from './components/ErrorBoundary';
import { parseScreen, parseScreenPage, type Screen, screenViewerName } from './components/screen-props';
import { i18n } from './i18n';
import type { AppLocale } from './i18n/locale';
import { activateScreenLocale, loadScreenCatalog } from './i18n/screen-catalog';
import { createQueryClient, createSessionStoragePersister, shouldPersistQuery } from './lib/query-client';

export { activateScreenLocale };

const screenErrorText = (name: string) => `Component Error: ${name}`;

/** Loads a screen's module, so the screen renders in one pass when its page shows. */
async function loadScreenElement(screen: Screen): Promise<ReactNode> {
    switch (screen.name) {
        case 'SearchPage': {
            const { default: SearchPage } = await import('./features/search');
            return <SearchPage {...screen.props} />;
        }
        case 'Signup': {
            const { default: Signup } = await import('./features/auth/signup');
            return <Signup />;
        }
        case 'PostEditor': {
            const { default: PostEditor } = await import('./features/editor');
            return <PostEditor {...screen.props} />;
        }
        case 'SettingsApp': {
            const { default: SettingsApp } = await import('./features/settings');
            return <SettingsApp {...screen.props} />;
        }
    }
}

const MountNotifier = ({ onMounted }: { onMounted: () => void }) => {
    useEffect(onMounted, [onMounted]);
    return null;
};

/** Keeps the screen's status on its element, and its errors inside it, so the rest of the page keeps working. */
function ScreenHost({ name, children }: { name: string; children: ReactNode }) {
    const [status, setStatus] = useState<'loading' | 'mounted' | 'error'>('loading');
    return (
        <div
            data-screen={name}
            data-screen-status={status}
            data-screen-error={status === 'error' ? 'render_error' : undefined}
        >
            <StrictMode>
                <ErrorBoundary fallback={<div>{screenErrorText(name)}</div>} onError={() => setStatus('error')}>
                    <Suspense>
                        {children}
                        <MountNotifier
                            onMounted={() => setStatus((current) => (current === 'error' ? current : 'mounted'))}
                        />
                    </Suspense>
                </ErrorBoundary>
            </StrictMode>
        </div>
    );
}

const ScreenFailure = ({ name }: { name: string }) => (
    <div data-screen={name} data-screen-status="error" data-screen-error="bootstrap_error">
        {screenErrorText(name)}
    </div>
);

/**
 * Builds a screen page's content once the screen's code and messages for the page's language are loaded.
 * The data the server sent is checked first, and a screen that cannot load shows its error in place.
 * A tab opened before a deploy asks for files that are gone, so a failed load also takes the reload a
 * missing catalog starts.
 */
export async function loadScreen(value: unknown, locale: AppLocale): Promise<ReactNode> {
    const data = parseScreenPage(value);
    if (!data) {
        return (
            <main className="min-h-[calc(100vh-10.5rem)]">
                <ScreenFailure name="Screen" />
            </main>
        );
    }
    const { name } = data.screen;
    const screen = parseScreen(name, data.screen.props);
    let content: ReactNode = <ScreenFailure name={name} />;
    if (screen) {
        try {
            const [element] = await Promise.all([
                loadScreenElement(screen).catch((error: unknown) => {
                    document.dispatchEvent(new Event('blex:catalog-failed'));
                    throw error;
                }),
                loadScreenCatalog(locale)
            ]);
            content = (
                <ScreenHost name={name}>
                    <I18nProvider i18n={i18n}>
                        <PersistQueryClientProvider
                            client={createQueryClient()}
                            persistOptions={{
                                persister: createSessionStoragePersister(screenViewerName(data)),
                                maxAge: 1000 * 60 * 60 * 24,
                                dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery }
                            }}
                        >
                            {element}
                        </PersistQueryClientProvider>
                    </I18nProvider>
                </ScreenHost>
            );
        } catch (error) {
            console.error(`The ${name} screen could not be loaded.`, error);
        }
    }
    return <ScreenPage data={data}>{content}</ScreenPage>;
}
