import { ui } from '../../../i18n/public-ui.js';
import type { ReactNode } from 'react';
import { readReauthenticatePageData, type ReauthenticatePageData } from './form-page-data';
import { serverFooter } from './server-footer';

const fieldClass = 'block h-12 w-full rounded-lg border border-line bg-surface px-3';

/** The fields stay uncontrolled, so hydration keeps whatever the visitor typed before this code arrived. */
export function ReauthenticatePage({ data, footer }: { data: ReauthenticatePageData; footer: ReactNode }) {
    const returnQuery = new URLSearchParams({ next: data.next });
    return (
        <>
            <main className="min-h-[calc(100vh-10.5rem)]">
                <div className="mx-auto my-16 w-full max-w-md px-4">
                    <section className="rounded-2xl border border-line bg-surface p-6 shadow-subtle">
                        <h1 className="text-xl font-semibold text-content">{ui('Verify your identity')}</h1>
                        <p className="mt-2 text-sm text-content-secondary">
                            {ui('After verification, return to settings and try your change again.')}
                        </p>
                        {data.error && (
                            <p className="mt-4 text-danger" role="alert">
                                {data.error}
                            </p>
                        )}
                        {data.showForm && (
                            <form action={`/reauthenticate?${returnQuery}`} method="post" className="mt-5 space-y-4">
                                <input type="hidden" name="csrfmiddlewaretoken" value={data.csrfToken} />
                                {!data.pendingFactor && (
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
                                {data.hasSecondFactor && (
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
                        {data.providers.length > 0 ? (
                            <div className="mt-5 space-y-3">
                                {data.providers.map((provider) => (
                                    <form
                                        key={provider.key}
                                        action={`/login/start/${provider.key}?${returnQuery}`}
                                        method="post"
                                    >
                                        <input type="hidden" name="csrfmiddlewaretoken" value={data.csrfToken} />
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
                            !data.showForm && (
                                <p className="mt-4 text-sm text-content-secondary">
                                    {ui('Contact the site administrator to recover access to your account.')}
                                </p>
                            )
                        )}
                        <a
                            className="mt-4 inline-flex min-h-11 items-center text-sm text-content-secondary hover:underline"
                            href={data.next}
                        >
                            {ui('Cancel')}
                        </a>
                    </section>
                </div>
            </main>
            {footer}
        </>
    );
}

export function mountPage(value: unknown, content: Element) {
    const data = readReauthenticatePageData(value);
    if (!data) throw new Error('The identity check data is invalid, so the form stays as server HTML.');
    return <ReauthenticatePage data={data} footer={serverFooter(content)} />;
}
