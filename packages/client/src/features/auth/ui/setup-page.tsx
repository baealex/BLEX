import { ui } from '../../../i18n/public-ui.js';
import type { ReactNode } from 'react';
import { readSetupPageData, type SetupPageData } from './form-page-data';
import { AuthPanel, authField, authInput, authSubmit } from './panel.js';
import { serverFooter } from './server-footer';

/**
 * `setupToken` is the token the server already accepted, or empty when the form asks for it.
 * The fields stay uncontrolled, so hydration keeps whatever the visitor typed before this code arrived.
 */
export function SetupPage({
    data,
    setupToken,
    footer
}: {
    data: SetupPageData;
    setupToken: string;
    footer: ReactNode;
}) {
    return (
        <>
            <main className="flex min-h-[calc(100vh-10.5rem)] justify-center px-4 py-16 md:px-6">
                <div className="w-full max-w-[420px]">
                    <AuthPanel title={ui('Create your first administrator')} id="setup-title" lock>
                        {data.error && (
                            <p
                                role="alert"
                                className="mb-4 rounded-xl border border-danger-line bg-danger-surface p-3 text-sm text-danger"
                            >
                                {data.error}
                            </p>
                        )}
                        <form action="/setup" method="post" className="space-y-4">
                            <input type="hidden" name="csrfmiddlewaretoken" value={data.csrfToken} />
                            {setupToken ? (
                                <input type="hidden" name="setupToken" value={setupToken} />
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
            {footer}
        </>
    );
}

export function mountPage(value: unknown, content: Element) {
    const data = readSetupPageData(value);
    if (!data) throw new Error('The setup form data is invalid, so the form stays as server HTML.');
    // The setup token stays out of the page data, so the browser keeps the one in the server form.
    const setupToken =
        content.querySelector<HTMLInputElement>(':scope > main form input[type="hidden"][name="setupToken"]')?.value ??
        '';
    return <SetupPage data={data} setupToken={setupToken} footer={serverFooter(content)} />;
}
