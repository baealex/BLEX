import { Fragment, type ReactNode } from 'react';
import type { DeveloperCommands } from '@blex/contracts/developer-api';
import { developerText, type DeveloperLocale, type DeveloperMessage } from './messages.js';

function Command({ locale, label, children }: { locale: DeveloperLocale; label: string; children: string }) {
    return (
        <div className="mt-4 min-w-0 overflow-hidden rounded-xl border border-line bg-surface-subtle">
            <div className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4">
                <span className="text-xs font-medium text-content-secondary">{label}</span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-content-secondary" data-copy-status="" role="status" />
                    <button
                        type="button"
                        className="min-h-11 shrink-0 px-2 text-xs font-medium text-content-secondary transition-colors duration-150 hover:text-content active:scale-95"
                        aria-label={developerText(locale, 'Copy {label}', { label })}
                        data-copy-link={children}
                        data-copy-message={developerText(locale, 'Copied.')}
                        data-copy-error-message={developerText(locale, 'Could not copy.')}
                    >
                        {developerText(locale, 'Copy')}
                    </button>
                </div>
            </div>
            <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-content">
                <code>{children}</code>
            </pre>
        </div>
    );
}

export function DeveloperQuickstart({
    siteOrigin,
    locale = 'ko',
    commands
}: {
    siteOrigin: string;
    locale?: DeveloperLocale;
    commands: DeveloperCommands;
}) {
    const t = (source: DeveloperMessage) => developerText(locale, source);
    const rich = (source: DeveloperMessage, values: Record<string, ReactNode>) =>
        t(source)
            .split(/(\{\w+\})/g)
            .map((part, index) => (
                <Fragment key={index}>
                    {/^\{\w+\}$/.test(part) && Object.getOwnPropertyDescriptor(values, part.slice(1, -1))
                        ? values[part.slice(1, -1)]
                        : part}
                </Fragment>
            ));
    const steps = [
        ['token', '1. Create a token'],
        ['connect', '2. Check the connection'],
        ['draft', '3. Save your first draft'],
        ['publish', '4. Publish when ready']
    ] as const;
    const troubleshooting = [
        [
            '401 · Check your token',
            'Check that you copied the full token and that it has not expired or been revoked. In a new terminal, run the setup commands from step 1 again.'
        ],
        [
            '403 · Check your token permissions',
            'Use an author account and a token with both Read posts and Write posts selected.'
        ],
        [
            '404 · Check your post number',
            'Set POST_ID to data.id from your response. You can only fetch or edit posts belonging to your account.'
        ],
        [
            '409 · The post has changed',
            'An already published draft cannot be published again. If there is an edit conflict, fetch the latest post and review your changes.'
        ],
        [
            '400 / 422 · Check what you sent',
            'Read error.message and error.fields in the response. Check JSON quotes and commas, and the values of your fields.'
        ]
    ] as const;
    return (
        <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
            <header className="mb-10">
                <p className="text-sm font-medium text-content-hint">{t('BLEX Developer API')}</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-content">
                    {t('Developer API quickstart')}
                </h1>
                <p className="mt-4 leading-relaxed text-content-secondary">
                    {t('Create your first post with a few terminal commands.')}
                    <br />
                    {t('Save a draft first, then publish when you are ready.')}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-content-hint">
                    {t('Use a macOS or Linux terminal, or WSL or Git Bash on Windows. You will need curl.')}
                </p>
                <nav
                    aria-label={t('Quickstart steps')}
                    className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-content-secondary"
                >
                    {steps.map(([id, label]) => (
                        <a
                            key={id}
                            className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-content"
                            href={`#${id}`}
                        >
                            {t(label)}
                        </a>
                    ))}
                </nav>
            </header>

            <article className="space-y-10 text-content">
                <section id="token" className="scroll-mt-24 border-t border-line pt-8">
                    <h2 className="text-xl font-semibold">{t('1. Create a token')}</h2>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {t('A token works like a password that lets an external tool use the API with your account.')}
                    </p>
                    <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-content-secondary">
                        <li>
                            {rich('Sign in with an author account and open {tokens}.', {
                                tokens: (
                                    <a
                                        className="text-content underline underline-offset-4"
                                        href="/settings/developer-api"
                                    >
                                        {t('Token management')}
                                    </a>
                                )
                            })}
                        </li>
                        <li>
                            {rich('Name your token and select both {read} and {write}.', {
                                read: <strong className="font-medium text-content">{t('Read posts')}</strong>,
                                write: <strong className="font-medium text-content">{t('Write posts')}</strong>
                            })}
                        </li>
                        <li>{t('Create the token and copy its full value. You can only see the full token once.')}</li>
                    </ol>
                    <p className="mt-4 leading-relaxed text-content-secondary">
                        {rich(
                            'Replace {token} below with the token you copied, then paste the commands into your terminal. Run the remaining commands in the same terminal.',
                            { token: <code>YOUR_TOKEN</code> }
                        )}
                    </p>
                    <Command
                        locale={locale}
                        label={t('Set up your terminal')}
                    >{`export BLEX_ORIGIN="${siteOrigin}"\nexport BLEX_TOKEN='YOUR_TOKEN'`}</Command>
                    <p className="mt-3 text-sm leading-relaxed text-content-hint">
                        {t(
                            'Keep your token out of public repositories and posts. If it leaks, revoke it in Token management and create another.'
                        )}
                    </p>
                </section>

                <section id="connect" className="scroll-mt-24 border-t border-line pt-8">
                    <h2 className="text-xl font-semibold">{t('2. Check the connection')}</h2>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {t('Fetch your account details to check that your token works.')}
                    </p>
                    <Command locale={locale} label={t('Check your account')}>
                        {commands.me}
                    </Command>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {rich(
                            'If {username} in the response shows your username, you are connected. If you get an error, see {troubleshooting}.',
                            {
                                username: <code>data.user.username</code>,
                                troubleshooting: (
                                    <a className="text-content underline underline-offset-4" href="#errors">
                                        {t('Troubleshooting')}
                                    </a>
                                )
                            }
                        )}
                    </p>
                </section>

                <section id="draft" className="scroll-mt-24 border-t border-line pt-8">
                    <h2 className="text-xl font-semibold">{t('3. Save your first draft')}</h2>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {rich(
                            '{title} is the title and {markdown} is the body. Sending {status} saves a draft that other people cannot see yet.',
                            {
                                title: <code>title</code>,
                                markdown: <code>markdown</code>,
                                status: <code>status: "draft"</code>
                            }
                        )}
                    </p>
                    <Command locale={locale} label={t('Create a draft')}>
                        {commands.create}
                    </Command>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {rich(
                            '{id} in the response is your new post number. If it is 123, save it as shown below. {replace}.',
                            {
                                id: <code>data.id</code>,
                                replace: (
                                    <strong className="font-medium text-content">
                                        {t('Replace 123 with the number from your response')}
                                    </strong>
                                )
                            }
                        )}
                    </p>
                    <Command locale={locale} label={t('Save the post number')}>
                        {'export POST_ID=123'}
                    </Command>
                    <p className="mt-3 text-sm leading-relaxed text-content-secondary">
                        {rich('You can also review and edit your draft in {posts}. It is fine to stop here.', {
                            posts: (
                                <a className="text-content underline underline-offset-4" href="/settings/posts">
                                    {t('Post management')}
                                </a>
                            )
                        })}
                    </p>
                </section>

                <section id="publish" className="scroll-mt-24 border-t border-line pt-8">
                    <h2 className="text-xl font-semibold">{t('4. Publish when ready')}</h2>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {rich('After reviewing the content, run the command below. {publish}.', {
                            publish: (
                                <strong className="font-medium text-content">
                                    {t('Your draft will be published immediately and visible to other people')}
                                </strong>
                            )
                        })}
                    </p>
                    <Command locale={locale} label={t('Publish the draft')}>
                        {commands.publish}
                    </Command>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {rich(
                            'You are done when {status} is {published}. Add {url} to this site’s address to open the published post.',
                            {
                                status: <code>data.status</code>,
                                published: <code>published</code>,
                                url: <code>data.public_url</code>
                            }
                        )}
                    </p>
                </section>

                <section className="border-t border-line pt-8" aria-labelledby="more-examples">
                    <h2 id="more-examples" className="text-xl font-semibold">
                        {t('Try a little more')}
                    </h2>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {t('Expand an example when you need it. Keep using the post number you saved above.')}
                    </p>
                    <details className="mt-4 border-b border-line pb-4">
                        <summary className="min-h-11 cursor-pointer py-3 font-medium">
                            {t('Change a post title')}
                        </summary>
                        <p className="mt-2 leading-relaxed text-content-secondary">
                            {t('Send only the fields you want to change. The body and tags you omit are kept.')}
                        </p>
                        <Command locale={locale} label={t('Update the title')}>
                            {commands.update}
                        </Command>
                        <p className="mt-3 text-sm leading-relaxed text-content-hint">
                            {t(
                                'If several tools edit the same post, use expected_updated_at to prevent conflicts. See the API reference for details.'
                            )}
                        </p>
                    </details>
                    <details className="mt-4 border-b border-line pb-4">
                        <summary className="min-h-11 cursor-pointer py-3 font-medium">
                            {t('Add an image to the body')}
                        </summary>
                        <p className="mt-2 leading-relaxed text-content-secondary">
                            {rich('Replace {file} with the path to an image on your computer, then upload it.', {
                                file: <code>./cover.png</code>
                            })}
                        </p>
                        <Command locale={locale} label={t('Upload an image')}>
                            {commands.image}
                        </Command>
                        <p className="mt-3 leading-relaxed text-content-secondary">
                            {rich('Put {url} from the response into {markdown} and include it in your Markdown body.', {
                                url: <code>data.url</code>,
                                markdown: <code>![image description](URL)</code>
                            })}
                        </p>
                    </details>
                </section>

                <section id="errors" className="scroll-mt-24 border-t border-line pt-8">
                    <h2 className="text-xl font-semibold">{t('Start here if you get an error')}</h2>
                    <dl className="mt-5 space-y-5 leading-relaxed text-content-secondary">
                        {troubleshooting.map(([title, description]) => (
                            <div key={title}>
                                <dt className="font-medium text-content">{t(title)}</dt>
                                <dd className="mt-1">{t(description)}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            </article>

            <footer className="mt-10 border-t border-line pt-6">
                <h2 className="font-semibold text-content">{t('Need another feature?')}</h2>
                <p className="mt-2 leading-relaxed text-content-secondary">
                    {t(
                        'The API reference covers search, tags, series, and scheduled publishing. Enter your full token in Authorize to send requests from your browser.'
                    )}
                </p>
                <a
                    className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-action px-4 py-2 text-sm font-medium text-content-inverted transition-colors duration-150 hover:bg-action-hover active:scale-95"
                    href="/api/developer/v1/docs"
                >
                    {t('Open the API reference')}
                </a>
            </footer>
        </div>
    );
}
