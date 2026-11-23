import { getDocumentLocale } from '../i18n/locale.js';
import { ui } from '../i18n/public-ui.js';
import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument } from '~/application/document';
import { AuthPanel, authField, authInput, authSubmit } from '~/features/auth/ui/panel';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage({ error, csrf, token }: PageProps['setup']): string {
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
                <title>{ui('Set up BLEX')}</title>
                <SiteTheme />
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader hideAuthLinks />
                <main className="flex min-h-[calc(100vh-10.5rem)] justify-center px-4 py-16 md:px-6">
                    <div className="w-full max-w-[420px]">
                        <AuthPanel title={ui('Create your first administrator')} id="setup-title" lock>
                            {error && (
                                <p
                                    role="alert"
                                    className="mb-4 rounded-xl border border-danger-line bg-danger-surface p-3 text-sm text-danger"
                                >
                                    {error}
                                </p>
                            )}
                            <form action="/setup" method="post" className="space-y-4">
                                <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
                                {token ? (
                                    <input type="hidden" name="setupToken" value={token} />
                                ) : (
                                    <label className={authField}>
                                        {ui('Setup token')}
                                        <input
                                            className={authInput}
                                            type="password"
                                            name="setupToken"
                                            autoComplete="off"
                                            required
                                        />
                                    </label>
                                )}
                                <label className={authField}>
                                    {ui('Username', {}, 'public.Username.367001d7')}
                                    <input
                                        className={authInput}
                                        name="username"
                                        autoComplete="username"
                                        maxLength={15}
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    {ui('Display name')}
                                    <input
                                        className={authInput}
                                        name="displayName"
                                        autoComplete="name"
                                        maxLength={150}
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    {ui('Email')}
                                    <input
                                        className={authInput}
                                        type="email"
                                        name="email"
                                        autoComplete="email"
                                        maxLength={254}
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    {ui('Password')}
                                    <input
                                        className={authInput}
                                        type="password"
                                        name="password"
                                        autoComplete="new-password"
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    {ui('Confirm password')}
                                    <input
                                        className={authInput}
                                        type="password"
                                        name="passwordCheck"
                                        autoComplete="new-password"
                                        required
                                    />
                                </label>
                                <button className={authSubmit} type="submit">
                                    {ui('Create administrator')}
                                </button>
                            </form>
                        </AuthPanel>
                    </div>
                </main>
                <SiteFooter />
            </body>
        </html>
    );
}
