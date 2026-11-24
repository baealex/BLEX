import { Fragment, type ReactNode, useState } from 'react';
import type { DeveloperCommands } from '@blex/contracts/developer-api';
import { SiteFooter } from '../../appearance/shell.js';
import { i18n, type MessageDescriptor } from '@lingui/core';
import { msg, t } from '@lingui/core/macro';
import { loadDeveloperMessages } from './developer-catalog.js';
import type { DeveloperQuickstartData } from './quickstart-data';

function Command({ label, children }: { label: string; children: string }) {
    const [status, setStatus] = useState('');
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(children);
            setStatus(t({ id: 'developer.quickstart.copied', message: 'Copied.' }));
        } catch {
            setStatus(t({ id: 'developer.quickstart.copy_failed', message: 'Could not copy.' }));
        }
    };
    return (
        <div className="mt-4 min-w-0 overflow-hidden rounded-xl border border-line bg-surface-subtle">
            <div className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4">
                <span className="text-xs font-medium text-content-secondary">{label}</span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-content-secondary" role="status">
                        {status}
                    </span>
                    <button
                        type="button"
                        className="min-h-11 shrink-0 px-2 text-xs font-medium text-content-secondary transition-colors duration-150 hover:text-content active:scale-95"
                        aria-label={t({ id: 'developer.quickstart.copy_label', message: `Copy ${label}` })}
                        onClick={() => void copy()}
                    >
                        {t({ id: 'developer.quickstart.copy', message: 'Copy' })}
                    </button>
                </div>
            </div>
            <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-content">
                <code>{children}</code>
            </pre>
        </div>
    );
}

/** Translates a sentence and puts each element where its `{name}` placeholder lands. */
function rich(message: MessageDescriptor, nodes: Record<string, ReactNode>) {
    // Each placeholder translates to itself, so the sentence keeps it where the language puts it.
    const slots = Object.fromEntries(Object.keys(nodes).map((name) => [name, `{${name}}`]));
    const occurrences = new Map<string, number>();
    return i18n
        ._(message.id, slots, { message: message.message })
        .split(/(\{\w+\})/g)
        .map((part) => {
            const occurrence = occurrences.get(part) ?? 0;
            occurrences.set(part, occurrence + 1);
            return (
                <Fragment key={JSON.stringify([part, occurrence])}>
                    {/^\{\w+\}$/.test(part) && Object.getOwnPropertyDescriptor(nodes, part.slice(1, -1))
                        ? nodes[part.slice(1, -1)]
                        : part}
                </Fragment>
            );
        });
}

export function DeveloperQuickstart({ siteOrigin, commands }: { siteOrigin: string; commands: DeveloperCommands }) {
    const steps = [
        ['token', t({ id: 'developer.quickstart.token.title', message: '1. Create a token' })],
        ['connect', t({ id: 'developer.quickstart.connect.title', message: '2. Check the connection' })],
        ['draft', t({ id: 'developer.quickstart.draft.title', message: '3. Save your first draft' })],
        ['publish', t({ id: 'developer.quickstart.publish.title', message: '4. Publish when ready' })]
    ] as const;
    const troubleshooting = [
        [
            t({ id: 'developer.quickstart.errors.401_title', message: '401 · Check your token' }),
            t({
                id: 'developer.quickstart.errors.401_description',
                message:
                    'Check that you copied the full token and that it has not expired or been revoked. In a new terminal, run the setup commands from step 1 again.'
            })
        ],
        [
            t({ id: 'developer.quickstart.errors.403_title', message: '403 · Check your token permissions' }),
            t({
                id: 'developer.quickstart.errors.403_description',
                message: 'Use an author account and a token with both Read posts and Write posts selected.'
            })
        ],
        [
            t({ id: 'developer.quickstart.errors.404_title', message: '404 · Check your post number' }),
            t({
                id: 'developer.quickstart.errors.404_description',
                message:
                    'Set POST_ID to data.id from your response. You can only fetch or edit posts belonging to your account.'
            })
        ],
        [
            t({ id: 'developer.quickstart.errors.409_title', message: '409 · The post has changed' }),
            t({
                id: 'developer.quickstart.errors.409_description',
                message:
                    'An already published draft cannot be published again. If there is an edit conflict, fetch the latest post and review your changes.'
            })
        ],
        [
            t({ id: 'developer.quickstart.errors.400_title', message: '400 / 422 · Check what you sent' }),
            t({
                id: 'developer.quickstart.errors.400_description',
                message:
                    'Read error.message and error.fields in the response. Check JSON quotes and commas, and the values of your fields.'
            })
        ]
    ] as const;
    return (
        <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
            <header className="mb-10">
                <p className="text-sm font-medium text-content-hint">
                    {t({ id: 'developer.api_name', message: 'BLEX Developer API' })}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-content">
                    {t({ id: 'developer.quickstart.title', message: 'Developer API quickstart' })}
                </h1>
                <p className="mt-4 leading-relaxed text-content-secondary">
                    {t({
                        id: 'developer.quickstart.intro',
                        message: 'Create your first post with a few terminal commands.'
                    })}
                    <br />
                    {t({
                        id: 'developer.quickstart.intro_publish',
                        message: 'Save a draft first, then publish when you are ready.'
                    })}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-content-hint">
                    {t({
                        id: 'developer.quickstart.requirements',
                        message: 'Use a macOS or Linux terminal, or WSL or Git Bash on Windows. You will need curl.'
                    })}
                </p>
                <nav
                    aria-label={t({ id: 'developer.quickstart.steps', message: 'Quickstart steps' })}
                    className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-content-secondary"
                >
                    {steps.map(([id, label]) => (
                        <a
                            key={id}
                            className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-content"
                            href={`#${id}`}
                        >
                            {label}
                        </a>
                    ))}
                </nav>
            </header>

            <article className="space-y-10 text-content">
                <section id="token" className="scroll-mt-24 border-t border-line pt-8">
                    <h2 className="text-xl font-semibold">
                        {t({ id: 'developer.quickstart.token.title', message: '1. Create a token' })}
                    </h2>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {t({
                            id: 'developer.quickstart.token.description',
                            message:
                                'A token works like a password that lets an external tool use the API with your account.'
                        })}
                    </p>
                    <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-content-secondary">
                        <li>
                            {rich(
                                msg({
                                    id: 'developer.quickstart.token.open_settings',
                                    message: 'Sign in with an author account and open {tokens}.'
                                }),
                                {
                                    tokens: (
                                        <a
                                            className="text-content underline underline-offset-4"
                                            href="/settings/developer-api"
                                        >
                                            {t({
                                                id: 'developer.quickstart.token.settings_link',
                                                message: 'Token management'
                                            })}
                                        </a>
                                    )
                                }
                            )}
                        </li>
                        <li>
                            {rich(
                                msg({
                                    id: 'developer.quickstart.token.select_scopes',
                                    message: 'Name your token and select both {read} and {write}.'
                                }),
                                {
                                    read: (
                                        <strong className="font-medium text-content">
                                            {t({ id: 'developer.quickstart.token.read_scope', message: 'Read posts' })}
                                        </strong>
                                    ),
                                    write: (
                                        <strong className="font-medium text-content">
                                            {t({
                                                id: 'developer.quickstart.token.write_scope',
                                                message: 'Write posts'
                                            })}
                                        </strong>
                                    )
                                }
                            )}
                        </li>
                        <li>
                            {t({
                                id: 'developer.quickstart.token.copy_value',
                                message:
                                    'Create the token and copy its full value. You can only see the full token once.'
                            })}
                        </li>
                    </ol>
                    <p className="mt-4 leading-relaxed text-content-secondary">
                        {rich(
                            msg({
                                id: 'developer.quickstart.token.setup',
                                message:
                                    'Replace {token} below with the token you copied, then paste the commands into your terminal. Run the remaining commands in the same terminal.'
                            }),
                            { token: <code>YOUR_TOKEN</code> }
                        )}
                    </p>
                    <Command
                        label={t({ id: 'developer.quickstart.token.setup_command', message: 'Set up your terminal' })}
                    >{`export BLEX_ORIGIN="${siteOrigin}"\nexport BLEX_TOKEN='YOUR_TOKEN'`}</Command>
                    <p className="mt-3 text-sm leading-relaxed text-content-hint">
                        {t({
                            id: 'developer.quickstart.token.keep_secret',
                            message:
                                'Keep your token out of public repositories and posts. If it leaks, revoke it in Token management and create another.'
                        })}
                    </p>
                </section>

                <section id="connect" className="scroll-mt-24 border-t border-line pt-8">
                    <h2 className="text-xl font-semibold">
                        {t({ id: 'developer.quickstart.connect.title', message: '2. Check the connection' })}
                    </h2>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {t({
                            id: 'developer.quickstart.connect.description',
                            message: 'Fetch your account details to check that your token works.'
                        })}
                    </p>
                    <Command label={t({ id: 'developer.quickstart.connect.command', message: 'Check your account' })}>
                        {commands.me}
                    </Command>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {rich(
                            msg({
                                id: 'developer.quickstart.connect.result',
                                message:
                                    'If {username} in the response shows your username, you are connected. If you get an error, see {troubleshooting}.'
                            }),
                            {
                                username: <code>data.user.username</code>,
                                troubleshooting: (
                                    <a className="text-content underline underline-offset-4" href="#errors">
                                        {t({
                                            id: 'developer.quickstart.troubleshooting_link',
                                            message: 'Troubleshooting'
                                        })}
                                    </a>
                                )
                            }
                        )}
                    </p>
                </section>

                <section id="draft" className="scroll-mt-24 border-t border-line pt-8">
                    <h2 className="text-xl font-semibold">
                        {t({ id: 'developer.quickstart.draft.title', message: '3. Save your first draft' })}
                    </h2>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {rich(
                            msg({
                                id: 'developer.quickstart.draft.description',
                                message:
                                    '{title} is the title and {markdown} is the body. Sending {status} saves a draft that other people cannot see yet.'
                            }),
                            {
                                title: <code>title</code>,
                                markdown: <code>markdown</code>,
                                status: <code>status: "draft"</code>
                            }
                        )}
                    </p>
                    <Command label={t({ id: 'developer.quickstart.draft.command', message: 'Create a draft' })}>
                        {commands.create}
                    </Command>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {rich(
                            msg({
                                id: 'developer.quickstart.draft.post_number',
                                message:
                                    '{id} in the response is your new post number. If it is 123, save it as shown below. {replace}.'
                            }),
                            {
                                id: <code>data.id</code>,
                                replace: (
                                    <strong className="font-medium text-content">
                                        {t({
                                            id: 'developer.quickstart.draft.replace_number',
                                            message: 'Replace 123 with the number from your response'
                                        })}
                                    </strong>
                                )
                            }
                        )}
                    </p>
                    <Command
                        label={t({ id: 'developer.quickstart.draft.save_command', message: 'Save the post number' })}
                    >
                        {'export POST_ID=123'}
                    </Command>
                    <p className="mt-3 text-sm leading-relaxed text-content-secondary">
                        {rich(
                            msg({
                                id: 'developer.quickstart.draft.review',
                                message: 'You can also review and edit your draft in {posts}. It is fine to stop here.'
                            }),
                            {
                                posts: (
                                    <a className="text-content underline underline-offset-4" href="/settings/posts">
                                        {t({ id: 'developer.quickstart.draft.posts_link', message: 'Post management' })}
                                    </a>
                                )
                            }
                        )}
                    </p>
                </section>

                <section id="publish" className="scroll-mt-24 border-t border-line pt-8">
                    <h2 className="text-xl font-semibold">
                        {t({ id: 'developer.quickstart.publish.title', message: '4. Publish when ready' })}
                    </h2>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {rich(
                            msg({
                                id: 'developer.quickstart.publish.description',
                                message: 'After reviewing the content, run the command below. {publish}.'
                            }),
                            {
                                publish: (
                                    <strong className="font-medium text-content">
                                        {t({
                                            id: 'developer.quickstart.publish.warning',
                                            message:
                                                'Your draft will be published immediately and visible to other people'
                                        })}
                                    </strong>
                                )
                            }
                        )}
                    </p>
                    <Command label={t({ id: 'developer.quickstart.publish.command', message: 'Publish the draft' })}>
                        {commands.publish}
                    </Command>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {rich(
                            msg({
                                id: 'developer.quickstart.publish.result',
                                message:
                                    'You are done when {status} is {published}. Add {url} to this site’s address to open the published post.'
                            }),
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
                        {t({ id: 'developer.quickstart.more.title', message: 'Try a little more' })}
                    </h2>
                    <p className="mt-3 leading-relaxed text-content-secondary">
                        {t({
                            id: 'developer.quickstart.more.description',
                            message: 'Expand an example when you need it. Keep using the post number you saved above.'
                        })}
                    </p>
                    {/* The browser can open these examples natively before the page's code arrives. */}
                    <details className="mt-4 border-b border-line pb-4" suppressHydrationWarning>
                        <summary className="min-h-11 cursor-pointer py-3 font-medium">
                            {t({ id: 'developer.quickstart.update.title', message: 'Change a post title' })}
                        </summary>
                        <p className="mt-2 leading-relaxed text-content-secondary">
                            {t({
                                id: 'developer.quickstart.update.description',
                                message: 'Send only the fields you want to change. The body and tags you omit are kept.'
                            })}
                        </p>
                        <Command label={t({ id: 'developer.quickstart.update.command', message: 'Update the title' })}>
                            {commands.update}
                        </Command>
                        <p className="mt-3 text-sm leading-relaxed text-content-hint">
                            {t({
                                id: 'developer.quickstart.update.conflicts',
                                message:
                                    'If several tools edit the same post, use expected_updated_at to prevent conflicts. See the API reference for details.'
                            })}
                        </p>
                    </details>
                    <details className="mt-4 border-b border-line pb-4" suppressHydrationWarning>
                        <summary className="min-h-11 cursor-pointer py-3 font-medium">
                            {t({ id: 'developer.quickstart.image.title', message: 'Add an image to the body' })}
                        </summary>
                        <p className="mt-2 leading-relaxed text-content-secondary">
                            {rich(
                                msg({
                                    id: 'developer.quickstart.image.description',
                                    message:
                                        'Replace {file} with the path to an image on your computer, then upload it.'
                                }),
                                {
                                    file: <code>./cover.png</code>
                                }
                            )}
                        </p>
                        <Command label={t({ id: 'developer.quickstart.image.command', message: 'Upload an image' })}>
                            {commands.image}
                        </Command>
                        <p className="mt-3 leading-relaxed text-content-secondary">
                            {rich(
                                msg({
                                    id: 'developer.quickstart.image.markdown',
                                    message:
                                        'Put {url} from the response into {markdown} and include it in your Markdown body.'
                                }),
                                {
                                    url: <code>data.url</code>,
                                    markdown: <code>![image description](URL)</code>
                                }
                            )}
                        </p>
                    </details>
                </section>

                <section id="errors" className="scroll-mt-24 border-t border-line pt-8">
                    <h2 className="text-xl font-semibold">
                        {t({ id: 'developer.quickstart.errors.title', message: 'Start here if you get an error' })}
                    </h2>
                    <dl className="mt-5 space-y-5 leading-relaxed text-content-secondary">
                        {troubleshooting.map(([title, description]) => (
                            <div key={title}>
                                <dt className="font-medium text-content">{title}</dt>
                                <dd className="mt-1">{description}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            </article>

            <footer className="mt-10 border-t border-line pt-6">
                <h2 className="font-semibold text-content">
                    {t({ id: 'developer.quickstart.reference.title', message: 'Need another feature?' })}
                </h2>
                <p className="mt-2 leading-relaxed text-content-secondary">
                    {t({
                        id: 'developer.quickstart.reference.description',
                        message:
                            'The API reference covers search, tags, series, and scheduled publishing. Enter your full token in Authorize to send requests from your browser.'
                    })}
                </p>
                <a
                    className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-action px-4 py-2 text-sm font-medium text-content-inverted transition-colors duration-150 hover:bg-action-hover active:scale-95"
                    href="/api/developer/v1/docs"
                >
                    {t({ id: 'developer.quickstart.reference.link', message: 'Open the API reference' })}
                </a>
            </footer>
        </div>
    );
}

export function DeveloperQuickstartPage({ data }: { data: DeveloperQuickstartData }) {
    return (
        <>
            <main className="min-h-[calc(100vh-10.5rem)]">
                <DeveloperQuickstart commands={data.commands} siteOrigin={data.siteOrigin} />
            </main>
            <SiteFooter brand={data.brand} year={data.copyrightYear} />
        </>
    );
}

export async function mountPage(data: DeveloperQuickstartData) {
    await loadDeveloperMessages();
    return <DeveloperQuickstartPage data={data} />;
}
