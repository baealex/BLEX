import { ui } from '../../../i18n/public-ui.js';
import type { ReactNode } from 'react';
import { readSignupPageData, type SignupPageData } from './form-page-data';
import { AuthPanel, authField, authInput, authSubmit } from './panel.js';
import { serverFooter } from './server-footer';

// The application draws the hCaptcha widget here, sometimes before this page hydrates, so React never manages what is inside.
const captchaFrame = { __html: '' };

/** The fields stay uncontrolled, so hydration keeps whatever the visitor typed before this code arrived. */
export function SignupPage({ data, footer }: { data: SignupPageData; footer: ReactNode }) {
    const { query } = data;
    return (
        <>
            <main className="flex min-h-[calc(100vh-10.5rem)] justify-center px-4 py-16 md:px-6">
                <div className="w-full max-w-[420px]">
                    <AuthPanel
                        title={ui('Sign up')}
                        description={ui('Create an account on {value0}', { value0: data.siteName })}
                        id="signup-title"
                    >
                        {data.providers.length > 0 && (
                            <div className="mb-6 grid gap-2">
                                {data.providers.map((name) => (
                                    <a
                                        key={name}
                                        className="rounded-lg border border-line py-3 text-center text-sm font-semibold hover:bg-surface-subtle"
                                        href={`/login/start/${name.toLowerCase()}${query ? `?${query}` : ''}`}
                                    >
                                        {ui('Continue with your {provider} account', { provider: name })}
                                    </a>
                                ))}
                                <p className="text-center text-xs text-content-hint">{ui('or')}</p>
                            </div>
                        )}
                        {data.error && (
                            <p
                                role="alert"
                                className="mb-4 rounded-xl border border-danger-line bg-danger-surface p-3 text-sm text-danger"
                            >
                                {data.error}
                            </p>
                        )}
                        <form action={query ? `/sign?${query}` : '/sign'} method="post" className="space-y-4">
                            <input type="hidden" name="csrfmiddlewaretoken" value={data.csrfToken} />
                            <label className={authField}>
                                {ui('Username')}
                                <input
                                    className={authInput}
                                    name="username"
                                    autoComplete="username"
                                    placeholder={ui('Enter your username')}
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
                                    placeholder={ui('Enter your password')}
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
                            {/* A visitor may open or close this before the code arrives, and hydration keeps their choice. */}
                            <details open={Boolean(data.invite)} suppressHydrationWarning>
                                <summary className="cursor-pointer text-xs font-semibold text-content-secondary">
                                    {ui('Invite code')}
                                </summary>
                                <input
                                    className={authInput}
                                    name="inviteCode"
                                    aria-label={ui('Invite code')}
                                    defaultValue={data.invite}
                                    maxLength={64}
                                />
                            </details>
                            {data.captchaSiteKey && (
                                <div
                                    data-sitekey={data.captchaSiteKey}
                                    data-blex-hcaptcha-widget=""
                                    dangerouslySetInnerHTML={captchaFrame}
                                    suppressHydrationWarning
                                />
                            )}
                            <button className={authSubmit} type="submit">
                                {ui('Create account')}
                            </button>
                        </form>
                        <p className="mt-6 border-t border-line-light pt-6 text-center text-sm font-medium text-content-secondary">
                            {ui('Already have an account?')}{' '}
                            <a
                                href={query ? `/login?${query}` : '/login'}
                                className="ml-1 font-bold text-content underline"
                            >
                                {ui('Log in')}
                            </a>
                        </p>
                    </AuthPanel>
                </div>
            </main>
            {footer}
        </>
    );
}

export function mountPage(value: unknown, content: Element) {
    const data = readSignupPageData(value);
    if (!data) throw new Error('The sign-up form data is invalid, so the form stays as server HTML.');
    return <SignupPage data={data} footer={serverFooter(content)} />;
}
