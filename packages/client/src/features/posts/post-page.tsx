import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SiteIcon, type SiteIconName } from '../../appearance/icons.js';
import { SiteFooter } from '../../appearance/shell.js';
import type { PostSeriesEntry, PostSeriesNavigation } from '@blex/contracts/pages';
import { ui } from '../../i18n/public-ui.js';
import { PostCommentsApp } from '../engagement/ui/comments.js';
import { LoginPromptLink } from '../engagement/ui/login-prompt-link.js';
import { CodeBlockHeader } from './code-block-header';
import type { DecoratedCodeBlock } from './code-blocks-client';
import { publicPostPath } from './paths';
import type { PostPageData, RelatedPostView } from './post-page-data';
import { usePostPrompts } from './post-prompts';

function PostCover({ data }: { data: PostPageData }) {
    const { cover, image, avatar, authorPath, published, updated, seriesLink, timelapsePath } = data;
    const inverted = cover === 'overlay';
    const large = inverted || cover === 'split';
    const metadataColor = inverted ? 'text-white/80' : 'text-content-secondary';
    const separator = inverted ? 'text-white/55' : 'text-line-strong';
    const heading = (
        <>
            {seriesLink && (
                <div className="mb-6 flex items-center gap-2">
                    <a
                        href={seriesLink}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${inverted ? 'bg-white/90 text-neutral-950 hover:bg-white' : 'bg-action text-content-inverted hover:bg-action-hover'}`}
                    >
                        <SiteIcon name="stack-2" className="size-3 opacity-70" />
                        {data.seriesName}
                    </a>
                </div>
            )}
            <h1
                itemProp="headline"
                className={`${large ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl lg:text-4xl'} ${inverted ? 'text-white' : 'text-content'} ${data.subtitle ? (large ? 'mb-4' : 'mb-3') : inverted ? 'mb-6' : 'mb-8'} font-bold leading-tight break-words`}
            >
                {data.title}
            </h1>
            {data.subtitle && (
                <p
                    className={`text-lg font-medium leading-relaxed sm:text-xl ${inverted ? 'mb-6 text-white/85' : 'mb-8 text-content-secondary'}`}
                >
                    {data.subtitle}
                </p>
            )}
            <div
                className={`flex items-center gap-4 text-sm ${large ? '' : 'border-b border-line-light pb-8'}`}
                itemProp="author"
                itemScope
                itemType="https://schema.org/Person"
            >
                <a href={authorPath} className="group shrink-0">
                    <img
                        src={avatar}
                        alt={data.username}
                        className={`size-10 rounded-full object-cover ring-2 transition-all ${inverted ? 'ring-white/60 group-hover:ring-white' : 'ring-line-light group-hover:ring-line-strong'}`}
                    />
                </a>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <a
                        href={authorPath}
                        className={`font-semibold transition-colors ${inverted ? 'text-white hover:text-white/80' : 'text-content hover:text-content-secondary'}`}
                        itemProp="name"
                    >
                        {data.username}
                    </a>
                    {published && (
                        <>
                            <span className={separator}>·</span>
                            <time className={metadataColor} dateTime={published.iso}>
                                {`${published.text} ${data.visibility === 'draft' ? ui('Preview') : ui('Publish')}`}
                            </time>
                        </>
                    )}
                    {updated && published && updated.text !== published.text && (
                        <>
                            <span className={separator}>·</span>
                            <time className={metadataColor} dateTime={updated.iso}>
                                {`${updated.text} ${ui('Update')}`}
                            </time>
                        </>
                    )}
                    <span className={separator}>·</span>
                    <span className={metadataColor}>
                        <span className="sr-only">{`${ui('Reading time:')} `}</span>
                        {ui('{minutes} min read', { minutes: data.readTime })}
                    </span>
                    {timelapsePath && (
                        <>
                            <span className={separator}>·</span>
                            <a href={timelapsePath} className={`${metadataColor} underline-offset-2 hover:underline`}>
                                {ui('See how it was written')}
                            </a>
                        </>
                    )}
                </div>
            </div>
        </>
    );
    const ratio = data.coverRatio;
    const picture = image && (
        <div
            className="overflow-hidden rounded-2xl ring-1 ring-line/60"
            style={ratio ? { aspectRatio: ratio } : undefined}
        >
            <img
                className={ratio ? 'h-full w-full object-cover' : 'w-full'}
                src={image}
                alt={data.title}
                itemProp="image"
            />
        </div>
    );
    if (cover === 'split') {
        const left = data.coverImagePosition === 'left';
        return (
            <section className={`post-cover-split px-4 md:px-6${left ? ' cover-left' : ''}`}>
                <div className="post-detail-frame grid gap-8 pt-10 sm:pt-14 lg:grid-cols-2 lg:items-center lg:py-14">
                    <div className={left ? 'lg:order-2' : undefined}>{heading}</div>
                    <div className={left ? 'lg:order-1' : undefined}>{picture}</div>
                </div>
            </section>
        );
    }
    if (inverted)
        return (
            <section className="post-cover-overlay relative isolate flex min-h-[clamp(20rem,44vh,32rem)] items-end overflow-hidden">
                <img className="absolute inset-0 -z-10 h-full w-full object-cover" src={image} alt={data.title} />
                <div className="post-cover-overlay-shade absolute inset-0 -z-10" />
                <div className="w-full px-4 pt-28 pb-10 sm:pb-14 md:px-6">
                    <div className="post-detail-layout">
                        <div className="post-cover-overlay-copy">{heading}</div>
                    </div>
                </div>
            </section>
        );
    return (
        <>
            <div className={`post-cover-${cover} mb-12 sm:mb-16`}>{heading}</div>
            {cover !== 'none' && picture && <div className="mb-12 sm:mb-16">{picture}</div>}
        </>
    );
}

function OutlineLinks({ headings, mobile }: { headings: PostPageData['headings']; mobile?: boolean }) {
    return (
        <nav className="px-4 py-4" aria-label={ui('Table of contents')} data-site-outline>
            <ul className="space-y-1">
                {headings.map((heading) => (
                    <li key={heading.id}>
                        <a
                            href={`#${encodeURIComponent(heading.id)}`}
                            className={`toc-item block rounded-lg px-3 text-sm text-content-secondary transition-all duration-150 hover:bg-surface-subtle hover:text-content active:scale-95 ${mobile ? 'py-3' : 'py-2'}`}
                            style={{ paddingInlineStart: heading.level * 12 + (mobile ? 16 : -6) }}
                        >
                            {heading.text}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

function PostSeriesCard({
    name,
    seriesPath,
    author,
    navigation
}: {
    name: string;
    seriesPath: string;
    author: string;
    navigation: PostSeriesNavigation | null;
}) {
    const allPosts = 'text-sm font-medium text-content-secondary hover:text-content';
    if (!navigation) {
        return (
            <section
                className="mb-16 mt-16 rounded-2xl bg-surface p-6 text-center ring-1 ring-line/60 sm:p-8"
                aria-labelledby="post-series-heading"
            >
                <h2 id="post-series-heading" className="mb-2 text-lg font-bold text-content">
                    <a href={seriesPath}>{name}</a>
                </h2>
                <p className="mb-6 text-sm text-content-secondary">
                    {ui('This hidden post does not appear in the series list.')}
                </p>
                <a href={seriesPath} className={allPosts}>
                    {ui('View all series')}
                </a>
            </section>
        );
    }
    const link = (entry: PostSeriesEntry) => publicPostPath(author, entry.url);
    const step = (entry: PostSeriesEntry | null, label: string) =>
        entry ? (
            <a href={link(entry)} rel={label === ui('Previous') ? 'prev' : 'next'} className={allPosts}>
                {label}
            </a>
        ) : (
            <span className="text-sm font-medium text-line-strong">{label}</span>
        );
    return (
        <section
            className="mb-16 mt-16 rounded-2xl bg-surface p-6 ring-1 ring-line/60 sm:p-8"
            aria-labelledby="post-series-heading"
        >
            <p className="mb-3 text-sm font-medium text-content-secondary">
                {`${navigation.index} / ${navigation.total}`}
            </p>
            <h2 id="post-series-heading" className="mb-2 text-2xl font-bold text-content">
                <a href={seriesPath}>{name}</a>
            </h2>
            <ol className="mt-6 space-y-2">
                {navigation.entries.map((entry) => (
                    <li
                        key={entry.url}
                        className={`flex items-center gap-4 rounded-xl p-3${entry.index === navigation.index ? ' bg-surface-subtle' : ''}`}
                    >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-sm font-bold text-content-secondary">
                            {entry.index}
                        </span>
                        {entry.index === navigation.index ? (
                            <>
                                <span className="flex-1 font-semibold text-content" aria-current="page">
                                    {entry.title}
                                </span>
                                <span className="rounded-md bg-action px-2.5 py-1 text-xs font-bold text-content-inverted">
                                    {ui('Reading')}
                                </span>
                            </>
                        ) : (
                            <a
                                href={link(entry)}
                                className="flex-1 font-medium text-content-secondary hover:text-content"
                            >
                                {entry.title}
                            </a>
                        )}
                    </li>
                ))}
            </ol>
            {navigation.total > 1 && (
                <nav
                    aria-label={ui('Navigate series')}
                    className="mt-8 flex items-center justify-between gap-4 border-t border-line-light pt-6"
                >
                    {step(navigation.previous, ui('Previous'))}
                    <a href={seriesPath} className={allPosts}>
                        {ui('All posts')}
                    </a>
                    {step(navigation.next, ui('Next'))}
                </nav>
            )}
        </section>
    );
}

function ArticleInfo({ data }: { data: PostPageData }) {
    const { postPath, authorPath, published, updated, csrfToken, subscription: author } = data;
    const bio = data.authorBio;
    const homepage = data.authorHomepage;
    const subscription =
        author &&
        (data.viewerAuthenticated ? (
            <form action={`/v1/users/@${encodeURIComponent(author.username)}/subscription`} method="post">
                <input type="hidden" name="returnTo" value={postPath} />
                <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
                {author.isSubscribed && <input type="hidden" name="action" value="unsubscribe" />}
                <button
                    type="submit"
                    className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-subtle"
                    aria-label={ui('Subscribe to new posts by {value0}', { value0: author.username })}
                    aria-pressed={author.isSubscribed}
                >
                    {author.isSubscribed ? ui('Subscribed') : ui('Subscribe')}
                </button>
            </form>
        ) : (
            <LoginPromptLink
                returnTo={postPath}
                action="subscribe"
                aria-label={ui('Subscribe to new posts by {value0}', { value0: author.username })}
                className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-subtle"
            >
                {ui('Subscribe')}
            </LoginPromptLink>
        ));
    const entries: Array<[string, ReactNode]> = [
        [
            ui('Author'),
            <div key="author" className="flex items-start justify-between gap-4">
                <div>
                    <a href={authorPath} className="font-semibold hover:text-content-secondary">
                        {data.username}
                    </a>
                    {bio && <p className="mt-1 leading-relaxed text-content-secondary">{bio}</p>}
                </div>
                {subscription}
            </div>
        ]
    ];
    if (published)
        entries.push([
            data.visibility === 'draft' ? ui('Preview source') : ui('First published'),
            <time key="published" dateTime={published.iso}>
                {published.text}
            </time>
        ]);
    if (updated && published && updated.text !== published.text)
        entries.push([
            ui('Updated'),
            <time key="updated" dateTime={updated.iso}>
                {updated.text}
            </time>
        ]);
    if (homepage)
        entries.push([
            ui('Author website'),
            <a
                key="homepage"
                href={homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words hover:text-content"
            >
                {homepage}
            </a>
        ]);
    return (
        <section
            className="my-16 rounded-2xl bg-surface p-6 ring-1 ring-line/60 sm:p-8"
            aria-labelledby="post-info-heading"
        >
            <h2
                id="post-info-heading"
                className="mb-6 border-b border-line-light pb-4 text-lg font-bold leading-snug text-content"
            >
                {ui('Post information')}
            </h2>
            <dl className="grid gap-4 text-sm">
                {entries.map(([label, value]) => (
                    <div key={label} className="sm:flex sm:items-start sm:gap-6">
                        <dt className="text-xs font-medium text-content-hint sm:w-24 sm:shrink-0">{label}</dt>
                        <dd className="mt-1 min-w-0 flex-1 text-content-secondary sm:mt-0">{value}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

const dockButton =
    'inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full text-content-secondary transition-all duration-200 hover:bg-surface-subtle/80 hover:text-content active:scale-95';

function RelatedPosts({ posts, username }: { posts: RelatedPostView[]; username: string }) {
    if (!posts.length)
        return (
            <div className="py-12 text-center">
                <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-surface-subtle">
                    <SiteIcon name="compass" className="text-2xl text-content-hint" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{ui('Browse more posts by {username}', { username })}</h3>
                <p className="mb-6 text-sm text-content-secondary">{ui('Find more posts on this profile.')}</p>
                <a
                    href={`/@${encodeURIComponent(username)}`}
                    className="inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 text-sm font-medium text-content-inverted hover:bg-action-hover"
                >
                    <span>{ui('View profile')}</span>
                    <SiteIcon name="arrow-right" className="text-xs opacity-70" />
                </a>
            </div>
        );
    return (
        <section aria-labelledby="related-post-heading">
            <div className="mb-8 flex items-center gap-3">
                <span className="h-6 w-1.5 rounded-full bg-action" />
                <h3 id="related-post-heading" className="text-xl font-bold sm:text-2xl">
                    {ui('Related posts')}
                </h3>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {posts.map((post) => {
                    const { href, image, date } = post;
                    return (
                        <article
                            key={href}
                            className="group flex h-full flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-150 hover:ring-line-strong/70"
                        >
                            {image && (
                                <a href={href} className="block aspect-[16/9] overflow-hidden">
                                    <img
                                        className="size-full object-cover motion-safe:transition-transform motion-safe:group-hover:scale-105"
                                        src={image}
                                        alt={post.title}
                                        loading="lazy"
                                    />
                                </a>
                            )}
                            <div className="flex flex-1 flex-col p-5">
                                <h4 className="mb-2 line-clamp-2 text-base font-bold leading-snug">
                                    <a href={href}>{post.title}</a>
                                </h4>
                                <div className="mb-3 flex gap-3 text-xs text-content-secondary">
                                    {date && <time dateTime={date.iso}>{date.text}</time>}
                                    <span>{ui('{minutes} min', { minutes: post.readTime })}</span>
                                </div>
                                <p className="mb-4 line-clamp-3 flex-1 text-sm leading-relaxed text-content-secondary">
                                    <a href={href}>{post.description}</a>
                                </p>
                                <a
                                    href={`/@${encodeURIComponent(post.username)}`}
                                    className="mt-auto flex items-center gap-2 border-t border-line-light pt-3 text-xs font-semibold"
                                >
                                    <img
                                        className="size-6 rounded-full object-cover"
                                        src={post.avatar}
                                        alt=""
                                        loading="lazy"
                                    />
                                    {post.username}
                                </a>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

function ShareItem({ icon, label, hint }: { icon: SiteIconName; label: string; hint: string }) {
    return (
        <>
            <span className="flex size-8 items-center justify-center rounded-lg bg-surface-subtle text-xs">
                <SiteIcon name={icon} />
            </span>
            <span className="flex flex-col">
                <span className="font-semibold">{label}</span>
                <span className="text-xs text-content-hint">{hint}</span>
            </span>
        </>
    );
}

const statusNotices = (): Record<string, [string, string]> => ({
    draft: [
        ui('This is a draft preview.'),
        ui(
            'This preview shows the last saved content as a post. Only the author can view it, and it is excluded from public lists and search.'
        )
    ],
    hidden: [
        ui('This post is private.'),
        ui('Only the author can view this post. Turn off private visibility in post settings to publish it.')
    ],
    scheduled: [
        ui('This post is scheduled.'),
        ui(
            'Only the author can view this post before its scheduled time. It will then appear at its public URL and in RSS, sitemaps, and Markdown.'
        )
    ]
});

function PostStatusNotice({ visibility, editPath }: { visibility: string; editPath?: string }) {
    const [title, message] = statusNotices()[visibility];
    return (
        <section
            data-post-status-notice
            data-post-status-visibility={visibility}
            className="mb-8 rounded-lg border border-line bg-surface-subtle px-4 py-4 sm:px-5 sm:py-5"
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-content-hint">{ui('Post status')}</p>
                    <h2 className="mt-1 text-lg font-semibold text-content">{title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-content-secondary">{message}</p>
                </div>
                {editPath && (
                    <a
                        href={editPath}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-content-secondary transition-all duration-150 hover:bg-surface hover:text-content active:scale-95"
                    >
                        {ui('Edit')}
                    </a>
                )}
            </div>
        </section>
    );
}

function PostDock({ data }: { data: PostPageData }) {
    const { postPath, canonical, csrfToken, canManage, headings, like } = data;
    const markdown = data.markdownUrl;
    const share: Array<[string, string, SiteIconName, string]> = [
        [
            ui('Share on X'),
            ui('Write a shared post in a new window'),
            'brand-x',
            `https://twitter.com/intent/tweet?${new URLSearchParams({
                text: data.title,
                url: canonical
            })}`
        ],
        [
            ui('Share on Threads'),
            ui('Share with your Threads followers'),
            'brand-threads',
            `https://www.threads.com/intent/post?${new URLSearchParams({
                text: data.title,
                url: canonical
            })}`
        ],
        [
            ui('Share on Bluesky'),
            ui('Share with your Bluesky followers'),
            'brand-bluesky',
            `https://bsky.app/intent/compose?${new URLSearchParams({ text: `${data.title} ${canonical}` })}`
        ],
        [
            ui('Share on LinkedIn'),
            ui('Share with your professional network'),
            'brand-linkedin',
            `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url: canonical })}`
        ],
        [
            ui('Share on Facebook'),
            ui('Share in a feed or message'),
            'brand-facebook',
            `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: canonical })}`
        ]
    ];
    return (
        <>
            <div className="post-action-dock pointer-events-none fixed inset-x-0 z-30 flex justify-center">
                <div className="post-action-bar pointer-events-auto">
                    {data.visibility === 'public' && (
                        <>
                            {like?.canLike ? (
                                <form method="post" action={`/like/${encodeURIComponent(data.slug)}`}>
                                    <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
                                    <input type="hidden" name="returnTo" value={postPath} />
                                    <button
                                        type="submit"
                                        className={`${dockButton} px-2 text-sm font-medium`}
                                        aria-label={`${like.isLiked ? ui('Unlike') : ui('Like')} (${like.countLikes})`}
                                        aria-pressed={like.isLiked}
                                    >
                                        <SiteIcon
                                            name="heart"
                                            className={like.isLiked ? 'size-4 fill-current text-danger' : 'size-4'}
                                        />
                                        {like.countLikes}
                                    </button>
                                </form>
                            ) : (
                                <LoginPromptLink
                                    returnTo={postPath}
                                    action="like"
                                    className={`${dockButton} px-2 text-sm font-medium`}
                                    aria-label={ui('Like ({value0})', { value0: like?.countLikes ?? 0 })}
                                >
                                    <SiteIcon name="heart" className="size-4" />
                                    {like?.countLikes ?? 0}
                                </LoginPromptLink>
                            )}
                            <div className="post-action-divider" />
                        </>
                    )}
                    {headings.length > 0 && (
                        <button
                            type="button"
                            className={`${dockButton} xl:hidden`}
                            data-open-dialog="post-toc"
                            aria-label={ui('Show table of contents')}
                        >
                            <SiteIcon name="list" className="size-4" />
                        </button>
                    )}
                    {data.visibility !== 'draft' && (
                        <>
                            {/* The browser can open this menu natively before the page's code arrives. */}
                            <details className="blex-user-menu relative" data-account-menu suppressHydrationWarning>
                                <summary
                                    className={`${dockButton} cursor-pointer`}
                                    aria-label={ui('Share post or copy link')}
                                >
                                    <SiteIcon name="share" className="size-4" />
                                </summary>
                                <div className="absolute bottom-full left-1/2 z-40 mb-3 w-72 -translate-x-1/2 rounded-xl border border-line bg-surface-elevated p-2 text-left shadow-floating">
                                    <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-content-hint">
                                        {ui('Share')}
                                    </div>
                                    <button
                                        type="button"
                                        data-copy-link={canonical}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-content-secondary transition-colors duration-150 hover:bg-surface-subtle hover:text-content active:scale-[0.98]"
                                    >
                                        <ShareItem icon="link" label={ui('Standard link')} hint={ui('Browser URL')} />
                                    </button>
                                    {share.map(([label, hint, icon, href]) => (
                                        <a
                                            key={label}
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-content-secondary transition-colors duration-150 hover:bg-surface-subtle hover:text-content active:scale-[0.98]"
                                        >
                                            <ShareItem icon={icon} label={label} hint={hint} />
                                        </a>
                                    ))}
                                    {markdown && (
                                        <>
                                            <div className="my-1 h-px bg-line-light" />
                                            <button
                                                type="button"
                                                data-copy-link={markdown}
                                                data-copy-message={ui('Agent link copied.')}
                                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-content-secondary transition-colors duration-150 hover:bg-surface-subtle hover:text-content active:scale-[0.98]"
                                            >
                                                <ShareItem
                                                    icon="code"
                                                    label={ui('Link for agents')}
                                                    hint={ui('Markdown reference URL')}
                                                />
                                            </button>
                                        </>
                                    )}
                                    {/* The site script writes the result, possibly before this page hydrates. */}
                                    <p
                                        className="px-3 text-xs text-content-hint"
                                        data-copy-status
                                        role="status"
                                        suppressHydrationWarning
                                        dangerouslySetInnerHTML={{ __html: '' }}
                                    />
                                </div>
                            </details>
                        </>
                    )}
                    {canManage && (
                        <a href={`${postPath}/edit`} className={dockButton} aria-label={ui('Edit')}>
                            <SiteIcon name="pencil" className="size-4" />
                        </a>
                    )}
                </div>
            </div>
            {headings.length > 0 && (
                // The site script can open this sheet before the page's code arrives.
                <dialog
                    id="post-toc"
                    suppressHydrationWarning
                    className="blex-toc-sheet fixed inset-x-0 top-auto bottom-0 m-0 max-h-[70vh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-surface-elevated p-0 text-content shadow-xl"
                >
                    <div className="flex items-center justify-between border-b border-line-light px-6 py-3">
                        <h2 className="text-lg font-bold">{ui('Table of contents')}</h2>
                        <form method="dialog">
                            <button type="submit" className={dockButton} aria-label={ui('Close table of contents')}>
                                <SiteIcon name="x" className="size-4" />
                            </button>
                        </form>
                    </div>
                    <OutlineLinks headings={headings} mobile />
                </dialog>
            )}
        </>
    );
}

const highlightedBlock = 'pre > code[class*="language-"]';

/** The body is sanitized server HTML. Code block controls render into it through portals. */
function PostBody({ html }: { html: string }) {
    const body = useRef<HTMLDivElement>(null);
    const [blocks, setBlocks] = useState<DecoratedCodeBlock[]>([]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: new HTML replaces the blocks this effect decorated.
    useEffect(() => {
        const element = body.current;
        if (!element?.querySelector(highlightedBlock)) return;
        const controller = new AbortController();
        void import('./code-blocks-client')
            .then(({ decorateCodeBlocks }) => decorateCodeBlocks(element, controller.signal))
            .then(
                (decorated) => {
                    if (!controller.signal.aborted) setBlocks(decorated);
                },
                (error: unknown) => console.warn('Could not load the code block controls.', error)
            );
        return () => {
            controller.abort();
            setBlocks([]);
        };
    }, [html]);

    return (
        <>
            <div
                ref={body}
                className="blog-post-content mb-16 max-w-none break-words"
                itemProp="articleBody"
                dangerouslySetInnerHTML={{ __html: html }}
            />
            {blocks.map(({ code, header, label }, index) =>
                createPortal(<CodeBlockHeader code={code} label={label} />, header, String(index))
            )}
        </>
    );
}

export function PostPage({
    data,
    bodyHtml,
    revision = 0
}: {
    data: PostPageData;
    bodyHtml: string;
    /** Changes with each server document, so state seeded from the previous one starts over. */
    revision?: number;
}) {
    const { visibility, cover, banners: allBanners, headings, canManage } = data;
    const fullCover = cover === 'split' || cover === 'overlay';
    const hasDock = visibility === 'public' || headings.length > 0 || (canManage && visibility !== 'draft');
    const prompts = usePostPrompts(revision, hasDock);
    const banners = (position: string) =>
        allBanners
            .filter((banner) => banner.position === position)
            .map((banner) => (
                <div
                    key={banner.id}
                    className="article-banner"
                    dangerouslySetInnerHTML={{ __html: banner.contentHtml }}
                />
            ));
    const hasBanner = (position: string) => allBanners.some((banner) => banner.position === position);
    const coverSection = <PostCover data={data} />;

    return (
        <>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: this only observes activation of the links inside. */}
            <main className="min-h-[calc(100vh-10.5rem)]" data-blex-post-page="" onClick={prompts.onClick}>
                {fullCover && coverSection}
                <div className={`post-detail-body px-4 md:px-6${fullCover ? ' post-detail-body--after-cover' : ''}`}>
                    <div className="post-detail-layout">
                        <aside className="post-detail-sidebar">
                            <div className="sticky top-28 space-y-4">{banners('left')}</div>
                        </aside>
                        <div className="post-detail-main mt-6">
                            <article itemScope itemType="https://schema.org/BlogPosting">
                                {visibility !== 'public' && (
                                    <PostStatusNotice
                                        visibility={visibility}
                                        editPath={canManage ? `${data.postPath}/edit` : undefined}
                                    />
                                )}
                                {!fullCover && coverSection}
                                {hasBanner('top') && <div className="mb-16 space-y-4">{banners('top')}</div>}
                                <PostBody html={bodyHtml} />
                                {data.tags.length > 0 && (
                                    <div className="mb-16 flex flex-wrap gap-2" itemProp="keywords">
                                        {data.tags.map((tag) => (
                                            <a
                                                key={tag}
                                                href={`/tag/${encodeURIComponent(tag)}`}
                                                className="inline-flex items-center rounded-full border border-line-light bg-surface-subtle px-4 py-2 text-sm font-medium text-content-secondary transition-all duration-150 hover:border-line hover:bg-line-light hover:text-content active:scale-95"
                                            >
                                                <span className="mr-1 text-content-hint">#</span>
                                                {tag}
                                            </a>
                                        ))}
                                    </div>
                                )}
                                {hasBanner('bottom') && <div className="mb-16 space-y-4">{banners('bottom')}</div>}
                                <ArticleInfo data={data} />
                            </article>
                            {visibility !== 'draft' && data.seriesLink && data.seriesName && (
                                <PostSeriesCard
                                    name={data.seriesName}
                                    seriesPath={data.seriesLink}
                                    author={data.username}
                                    navigation={data.seriesNavigation}
                                />
                            )}
                            {data.comments && (
                                <div data-blex-post-comments="">
                                    <PostCommentsApp key={revision} model={data.comments} />
                                </div>
                            )}
                        </div>
                        <aside className="post-detail-sidebar">
                            <div className="sticky top-28 space-y-4">
                                {headings.length > 0 && (
                                    <div className="max-h-[400px] overscroll-contain overflow-y-auto rounded-2xl bg-surface ring-1 ring-line/60">
                                        <div className="sticky top-0 z-10 border-b border-line-light bg-surface px-6 py-4">
                                            <h2 className="text-sm font-bold tracking-wider">
                                                {ui('Table of contents')}
                                            </h2>
                                        </div>
                                        <OutlineLinks headings={headings} />
                                    </div>
                                )}
                                {banners('right')}
                            </div>
                        </aside>
                    </div>
                    {visibility === 'public' && (
                        <div className="mx-auto my-16 max-w-7xl">
                            <RelatedPosts posts={data.related} username={data.username} />
                        </div>
                    )}
                </div>
                {hasDock && <PostDock data={data} />}
            </main>
            <div className="post-detail-footer-action-space">
                <SiteFooter brand={data.brand} year={data.copyrightYear} />
            </div>
            {prompts.dialogs}
        </>
    );
}
