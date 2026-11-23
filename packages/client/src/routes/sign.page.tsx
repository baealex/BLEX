import { getDocumentLocale } from '../i18n/locale.js';
import { ui } from '../i18n/public-ui.js';
import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument } from '~/application/document';
import { AuthPanel, authField, authInput, authSubmit } from '~/features/auth/ui/panel';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({ brand, siteKey, social, params, error, csrf, invite }: PageProps['sign']): string {
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
                <title>{ui('Sign up - {value0}', { value0: brand.siteName })}</title>
                <SiteTheme />
                {siteKey && (
                    <script src="https://js.hcaptcha.com/1/api.js" async defer data-blex-trusted-script="hcaptcha" />
                )}
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader brand={brand} />
                <main className="flex min-h-[calc(100vh-10.5rem)] justify-center px-4 py-16 md:px-6">
                    <div className="w-full max-w-[420px]">
                        <AuthPanel
                            title={ui('Sign up')}
                            description={ui('Create an account on {value0}', { value0: brand.siteName })}
                            id="signup-title"
                        >
                            {social.length > 0 && (
                                <div className="mb-6 grid gap-2">
                                    {social.map((name) => (
                                        <a
                                            key={name}
                                            className="rounded-lg border border-line py-3 text-center text-sm font-semibold hover:bg-surface-subtle"
                                            href={`/login/start/${name.toLowerCase()}${params ? `?${params}` : ''}`}
                                        >
                                            {ui('Continue with your {provider} account', { provider: name })}
                                        </a>
                                    ))}
                                    <p className="text-center text-xs text-content-hint">{ui('or')}</p>
                                </div>
                            )}
                            {error && (
                                <p
                                    role="alert"
                                    className="mb-4 rounded-xl border border-danger-line bg-danger-surface p-3 text-sm text-danger"
                                >
                                    {error}
                                </p>
                            )}
                            <form action={params ? `/sign?${params}` : '/sign'} method="post" className="space-y-4">
                                <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
                                <label className={authField}>
                                    {ui('Username', {}, 'public.Username.367001d7')}
                                    <input
                                        className={authInput}
                                        name="username"
                                        autoComplete="username"
                                        placeholder={ui(
                                            'Enter your username',
                                            {},
                                            'public.Enter your username.259a7b95'
                                        )}
                                        pattern="[a-z0-9]{4,15}"
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    {ui('Display name')}
                                    <input
                                        className={authInput}
                                        name="name"
                                        autoComplete="name"
                                        placeholder={ui('Enter your display name')}
                                        maxLength={150}
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    {ui('Email')}
                                    <input
                                        className={authInput}
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder={ui('Enter your email address')}
                                        maxLength={254}
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    {ui('Password')}
                                    <input
                                        className={authInput}
                                        name="password"
                                        type="password"
                                        placeholder={ui(
                                            'Enter your password',
                                            {},
                                            'public.Enter your password.047b6c50'
                                        )}
                                        minLength={8}
                                        autoComplete="new-password"
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    {ui('Confirm password')}
                                    <input
                                        className={authInput}
                                        name="passwordCheck"
                                        type="password"
                                        placeholder={ui('Enter your password again')}
                                        minLength={8}
                                        autoComplete="new-password"
                                        required
                                    />
                                </label>
                                <details open={Boolean(invite)}>
                                    <summary className="cursor-pointer text-xs font-semibold text-content-secondary">
                                        {ui('Invite code')}
                                    </summary>
                                    <input
                                        className={authInput}
                                        name="inviteCode"
                                        aria-label={ui('Invite code')}
                                        defaultValue={invite}
                                        maxLength={64}
                                    />
                                </details>
                                {siteKey && (
                                    <div className="h-captcha" data-sitekey={siteKey} data-blex-hcaptcha-widget="" />
                                )}
                                <button className={authSubmit} type="submit">
                                    {ui('Create account')}
                                </button>
                            </form>
                            <p className="mt-6 border-t border-line-light pt-6 text-center text-sm font-medium text-content-secondary">
                                {ui('Already have an account?')}{' '}
                                <a
                                    href={params ? `/login?${params}` : '/login'}
                                    className="ml-1 font-bold text-content underline"
                                >
                                    {ui('Log in')}
                                </a>
                            </p>
                        </AuthPanel>
                    </div>
                </main>
                <SiteFooter brand={brand} />
            </body>
        </html>
    );
}
