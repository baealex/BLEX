import { ui } from '../../../i18n/public-ui.js';
import type { ReactNode } from 'react';
import { type PasswordResetPageData, readPasswordResetPageData } from './form-page-data';
import { serverFooter } from './server-footer';

const fieldClass =
    'block h-12 w-full rounded-lg border border-line bg-surface px-3 focus:border-content-hint focus:outline-hidden focus:ring-1 focus:ring-content-hint';
const linkClass =
    'mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-action px-4 text-content-inverted hover:bg-action-hover active:scale-95';

/**
 * `action` is the reset link the form posts to, which carries its token. It is empty unless the page shows the form.
 * The fields stay uncontrolled, so hydration keeps whatever the visitor typed before this code arrived.
 */
export function PasswordResetPage({
    data,
    action,
    footer
}: {
    data: PasswordResetPageData;
    action: string;
    footer: ReactNode;
}) {
    return (
        <>
            <main className="min-h-[calc(100vh-10.5rem)]">
                <div className="mx-auto my-16 w-full max-w-md px-4">
                    <section className="rounded-2xl border border-line bg-surface p-6 shadow-subtle">
                        <h1 className="text-xl font-semibold text-content">{ui('Reset password')}</h1>
                        {data.state === 'invalid' && (
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
                        {data.state === 'done' && (
                            <>
                                <p className="mt-2 text-sm text-content-secondary" role="status">
                                    {ui('Your new password has been saved. Sign in again.')}
                                </p>
                                <a className={linkClass} href="/login">
                                    {ui('Go to sign in')}
                                </a>
                            </>
                        )}
                        {data.state === 'form' && (
                            <>
                                <p className="mt-2 text-sm text-content-secondary">
                                    {ui('Enter a new password for {value0}. Saving it signs you out on every device.', {
                                        value0: data.username
                                    })}
                                </p>
                                {data.error && (
                                    <p className="mt-4 text-danger" role="alert">
                                        {data.error}
                                    </p>
                                )}
                                <form action={action} method="post" className="mt-5 space-y-4">
                                    <input type="hidden" name="csrfmiddlewaretoken" value={data.csrfToken} />
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
            {footer}
        </>
    );
}

export function mountPage(value: unknown, content: Element) {
    const data = readPasswordResetPageData(value);
    if (!data) throw new Error('The password reset data is invalid, so the page stays as server HTML.');
    let action = '';
    if (data.state === 'form') {
        // The reset token stays out of the page data, so the browser posts to the link in the server form.
        action = content.querySelector(':scope > main form[method="post"]')?.getAttribute('action') ?? '';
        if (!action) throw new Error('The password reset form is missing, so the page stays as server HTML.');
    }
    return <PasswordResetPage data={data} action={action} footer={serverFooter(content)} />;
}
