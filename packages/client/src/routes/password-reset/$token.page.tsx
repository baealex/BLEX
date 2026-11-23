import { getDocumentLocale } from '../../i18n/locale.js';
import { ui } from '../../i18n/public-ui.js';
import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({ brand, view, linkClass, fieldClass }: PageProps['password-reset/$token']): string {
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <meta name="referrer" content="no-referrer" />
                <title>{ui('Reset password - {value0}', { value0: brand.siteName })}</title>
                <SiteTheme />
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader brand={brand} />
                <main className="min-h-[calc(100vh-10.5rem)]">
                    <div className="mx-auto my-16 w-full max-w-md px-4">
                        <section className="rounded-2xl border border-line bg-surface p-6 shadow-subtle">
                            <h1 className="text-xl font-semibold text-content">{ui('Reset password')}</h1>
                            {view.state === 'invalid' && (
                                <>
                                    <p className="mt-2 text-sm text-content-secondary">
                                        {ui(
                                            'This link has expired or has already been used. Ask the site administrator for a new link.'
                                        )}
                                    </p>
                                    <a className={linkClass} href="/login">
                                        {ui('Go to sign in')}
                                    </a>
                                </>
                            )}
                            {view.state === 'done' && (
                                <>
                                    <p className="mt-2 text-sm text-content-secondary" role="status">
                                        {ui('Your new password has been saved. Sign in again.')}
                                    </p>
                                    <a className={linkClass} href="/login">
                                        {ui('Go to sign in')}
                                    </a>
                                </>
                            )}
                            {view.state === 'form' && (
                                <>
                                    <p className="mt-2 text-sm text-content-secondary">
                                        {ui(
                                            'Enter a new password for {value0}. Saving it signs you out on every device.',
                                            { value0: view.username }
                                        )}
                                    </p>
                                    {view.error && (
                                        <p className="mt-4 text-danger" role="alert">
                                            {view.error}
                                        </p>
                                    )}
                                    <form action={view.action} method="post" className="mt-5 space-y-4">
                                        <input type="hidden" name="csrfmiddlewaretoken" value={view.csrf} />
                                        <label className="block space-y-1">
                                            <span className="text-sm text-content">{ui('New password')}</span>
                                            <input
                                                className={fieldClass}
                                                type="password"
                                                name="password"
                                                autoComplete="new-password"
                                                required
                                            />
                                        </label>
                                        <label className="block space-y-1">
                                            <span className="text-sm text-content">{ui('Confirm new password')}</span>
                                            <input
                                                className={fieldClass}
                                                type="password"
                                                name="passwordConfirm"
                                                autoComplete="new-password"
                                                required
                                            />
                                        </label>
                                        <button
                                            className="min-h-11 w-full rounded-lg bg-action px-4 text-content-inverted hover:bg-action-hover active:scale-95"
                                            type="submit"
                                        >
                                            {ui('Save')}
                                        </button>
                                    </form>
                                </>
                            )}
                        </section>
                    </div>
                </main>
                <SiteFooter brand={brand} />
            </body>
        </html>
    );
}
