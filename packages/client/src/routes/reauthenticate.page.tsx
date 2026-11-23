import { getDocumentLocale } from '../i18n/locale.js';
import { ui } from '../i18n/public-ui.js';
import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '@blex/contracts/pages';

function reauthenticationPath(next: string) {
    return `/reauthenticate?${new URLSearchParams({ next })}`;
}

export default function renderPage({
    brand,
    account,
    viewer,
    csrf,
    error,
    showForm,
    next,
    pendingFactor,
    fieldClass,
    visibleProviders
}: PageProps['reauthenticate']): string {
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <title>{ui('Verify your identity - {value0}', { value0: brand.siteName })}</title>
                <SiteTheme />
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader
                    brand={brand}
                    viewer={{
                        username: account.username,
                        hasEditorRole: viewer?.role === 'EDITOR',
                        isStaff: Boolean(viewer?.isStaff),
                        unreadCount: Number(viewer?.unreadCount ?? 0),
                        csrfToken: csrf
                    }}
                />
                <main className="min-h-[calc(100vh-10.5rem)]">
                    <div className="mx-auto my-16 w-full max-w-md px-4">
                        <section className="rounded-2xl border border-line bg-surface p-6 shadow-subtle">
                            <h1 className="text-xl font-semibold text-content">{ui('Verify your identity')}</h1>
                            <p className="mt-2 text-sm text-content-secondary">
                                {ui('After verification, return to settings and try your change again.')}
                            </p>
                            {error && (
                                <p className="mt-4 text-danger" role="alert">
                                    {error}
                                </p>
                            )}
                            {showForm && (
                                <form action={reauthenticationPath(next)} method="post" className="mt-5 space-y-4">
                                    <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
                                    {!pendingFactor && (
                                        <label className="block space-y-1">
                                            <span className="text-sm text-content">{ui('Current password')}</span>
                                            <input
                                                className={fieldClass}
                                                type="password"
                                                name="password"
                                                autoComplete="current-password"
                                                required
                                            />
                                        </label>
                                    )}
                                    {account.factorId !== null && (
                                        <label className="block space-y-1">
                                            <span className="text-sm text-content">
                                                {ui('Authenticator code or recovery key')}
                                            </span>
                                            <input
                                                className={fieldClass}
                                                name="code"
                                                autoComplete="one-time-code"
                                                maxLength={64}
                                                required
                                            />
                                        </label>
                                    )}
                                    <button
                                        className="min-h-11 w-full rounded-lg bg-action px-4 text-content-inverted hover:bg-action-hover active:scale-95"
                                        type="submit"
                                    >
                                        {ui('Confirm')}
                                    </button>
                                </form>
                            )}
                            {visibleProviders.length > 0 ? (
                                <div className="mt-5 space-y-3">
                                    {visibleProviders.map((provider) => (
                                        <form
                                            key={provider.key}
                                            action={`/login/start/${provider.key}?${new URLSearchParams({ next })}`}
                                            method="post"
                                        >
                                            <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
                                            <button
                                                className="min-h-11 w-full rounded-lg border border-line px-4 hover:bg-surface-subtle active:scale-95"
                                                type="submit"
                                            >
                                                {ui('Continue with {value0}', { value0: provider.name })}
                                            </button>
                                        </form>
                                    ))}
                                </div>
                            ) : (
                                !showForm && (
                                    <p className="mt-4 text-sm text-content-secondary">
                                        {ui('Contact the site administrator to recover access to your account.')}
                                    </p>
                                )
                            )}
                            <a
                                className="mt-4 inline-flex min-h-11 items-center text-sm text-content-secondary hover:underline"
                                href={next}
                            >
                                {ui('Cancel')}
                            </a>
                        </section>
                    </div>
                </main>
                <SiteFooter brand={brand} />
            </body>
        </html>
    );
}
