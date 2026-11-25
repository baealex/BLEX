import { useEffect, useRef, useState } from 'react';
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

function MetaDot({ inverted = false }: { inverted?: boolean }) {
    return (
        <span
            aria-hidden="true"
            className={`size-[3px] shrink-0 rounded-full ${inverted ? 'bg-white/60' : 'bg-content-hint'}`}
        />
    );
}

function PostCover({ data }: { data: PostPageData }) {
    const { cover, image, avatar, authorPath, published, seriesLink, seriesNavigation, timelapsePath } = data;
    const inverted = cover === 'overlay';
    const large = inverted || cover === 'split';
    const metadataColor = inverted ? 'text-white/80' : 'text-content-secondary';
    const heading = (
        <>
            {seriesLink && (
                <a
                    href={seriesLink}
                    className={`mb-3 inline-flex min-h-11 max-w-full items-center gap-2 text-sm font-semibold transition-colors duration-150 ${inverted ? 'text-white/80 hover:text-white' : 'text-content-secondary hover:text-content'}`}
                >
                    <SiteIcon name="stack-2" className="shrink-0 text-base" />
                    <span className={`truncate ${inverted ? 'text-white' : 'text-content'}`}>{data.seriesName}</span>
                    {seriesNavigation && (
                        <>
                            <MetaDot inverted={inverted} />
                            <span className="shrink-0 tabular-nums">{`${seriesNavigation.index} / ${seriesNavigation.total}`}</span>
                        </>
                    )}
                </a>
            )}
            <h1
                itemProp="headline"
                className={`${large ? 'text-3xl sm:text-4xl' : 'text-[1.75rem] sm:text-4xl'} ${inverted ? 'text-white' : 'text-content'} font-bold leading-tight tracking-tight break-words break-keep`}
            >
                {data.title}
            </h1>
            {data.subtitle && (
                <p
                    className={`mt-3 text-lg font-medium leading-relaxed break-keep sm:text-xl ${inverted ? 'text-white/85' : 'text-content-secondary'}`}
                >
                    {data.subtitle}
                </p>
            )}
            <div
                className="mt-6 flex items-center gap-3 sm:mt-7"
                itemProp="author"
                itemScope
                itemType="https://schema.org/Person"
            >
                <a href={authorPath} className="group shrink-0">
                    <img
                        src={avatar}
                        alt={data.username}
                        className={`size-10 rounded-full object-cover ring-1 transition-shadow duration-150 ${inverted ? 'ring-white/60 group-hover:ring-white' : 'ring-line group-hover:ring-line-strong'}`}
                    />
                </a>
                <div className="min-w-0">
                    <a
                        href={authorPath}
                        className={`text-sm font-semibold transition-colors duration-150 ${inverted ? 'text-white hover:text-white/80' : 'text-content hover:text-content-secondary'}`}
                        itemProp="name"
                    >
                        {data.username}
                    </a>
                    <div className={`flex flex-wrap items-center gap-x-2 text-[13px] leading-6 ${metadataColor}`}>
                        {published && (
                            <>
                                <time dateTime={published.iso}>
                                    {data.visibility === 'draft'
                                        ? `${published.text} ${ui('Preview')}`
                                        : published.text}
                                </time>
                                <MetaDot inverted={inverted} />
                            </>
                        )}
                        <span>
                            <span className="sr-only">{`${ui('Reading time:')} `}</span>
                            {ui('{minutes} min read', { minutes: data.readTime })}
                        </span>
                        {timelapsePath && (
                            <>
                                <MetaDot inverted={inverted} />
                                <a
                                    href={timelapsePath}
                                    className={`underline decoration-1 underline-offset-[3px] transition-colors duration-150 ${inverted ? 'decoration-white/50 hover:text-white' : 'decoration-line-strong hover:text-content'}`}
                                >
                                    {ui('See how it was written')}
                                </a>
                            </>
                        )}
                    </div>
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
    const shown = cover !== 'none' && picture;
    return (
        <>
            <div className={`post-cover-${cover} ${shown ? 'mb-8 sm:mb-10' : 'mb-12 sm:mb-14'}`}>{heading}</div>
            {shown && <div className="mb-10 sm:mb-14">{picture}</div>}
        </>
    );
}

function OutlineLinks({ headings }: { headings: PostPageData['headings'] }) {
    return (
        <nav className="px-4 py-4" aria-label={ui('Table of contents')} data-site-outline>
            <ul className="space-y-1">
                {headings.map((heading) => (
                    <li key={heading.id}>
                        <a
                            href={`#${encodeURIComponent(heading.id)}`}
                            className="toc-item block rounded-lg px-3 py-3 text-sm text-content-secondary transition-all duration-150 hover:bg-surface-subtle hover:text-content active:scale-95"
                            style={{ paddingInlineStart: heading.level * 12 + 16 }}
                        >
                            {heading.text}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

/** The heading the reader is in: the last one that has scrolled up under the sticky header. */
function useCurrentHeading(headings: PostPageData['headings']): string | null {
    const [current, setCurrent] = useState<string | null>(null);
    useEffect(() => {
        const elements = headings.flatMap((heading) => document.getElementById(heading.id) ?? []);
        if (!elements.length) return;
        let frame = 0;
        const update = () => {
            frame = 0;
            let passed: string | null = null;
            for (const element of elements) {
                if (element.getBoundingClientRect().top > 120) break;
                passed = element.id;
            }
            setCurrent(passed);
        };
        const schedule = () => {
            frame ||= requestAnimationFrame(update);
        };
        const controller = new AbortController();
        window.addEventListener('scroll', schedule, { passive: true, signal: controller.signal });
        window.addEventListener('resize', schedule, { signal: controller.signal });
        update();
        return () => {
            controller.abort();
            cancelAnimationFrame(frame);
        };
    }, [headings]);
    return current;
}

/** The desktop outline stays quiet beside the text: one rule, with the reader's place marked on it. */
function SideOutline({ headings }: { headings: PostPageData['headings'] }) {
    const current = useCurrentHeading(headings);
    const top = Math.min(...headings.map((heading) => heading.level));
    return (
        <nav
            className="max-h-[min(calc(100vh-10rem),36rem)] overscroll-contain pr-2"
            aria-label={ui('Table of contents')}
            data-site-outline
        >
            <p aria-hidden="true" className="text-[13px] font-semibold text-content-secondary">
                {ui('Table of contents')}
            </p>
            <ul className="mt-3 border-l border-line">
                {headings.map((heading) => {
                    const here = heading.id === current;
                    return (
                        <li key={heading.id}>
                            <a
                                href={`#${encodeURIComponent(heading.id)}`}
                                aria-current={here ? 'location' : undefined}
                                className={`toc-item -ml-px block border-l-2 py-1.5 text-sm leading-normal transition-colors duration-150 ${here ? 'border-content font-semibold text-content' : 'border-transparent text-content-secondary hover:text-content'}`}
                                style={{ paddingInlineStart: 14 + (heading.level - top) * 14 }}
                            >
                                {heading.text}
                            </a>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

const quietLabel = 'text-[13px] font-semibold text-content-secondary';
const textLink =
    'inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-content transition-colors duration-150 hover:text-content-secondary';
const sectionTitle = 'text-xl font-bold tracking-tight text-content';

function SeriesProgress({ index, total }: { index: number; total: number }) {
    // Past two dozen posts, separate steps would blur into one line anyway.
    if (total > 24)
        return (
            <div aria-hidden="true" className="mt-3.5 h-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-content" style={{ width: `${(index / total) * 100}%` }} />
            </div>
        );
    const steps = Array.from({ length: total }, (_, position) => position + 1);
    return (
        <div aria-hidden="true" className="mt-3.5 flex gap-1">
            {steps.map((step) => (
                <span key={step} className={`h-1 flex-1 rounded-full ${step <= index ? 'bg-content' : 'bg-line'}`} />
            ))}
        </div>
    );
}

const seriesTile =
    'flex min-h-11 flex-col gap-1.5 rounded-2xl px-5 pt-4 pb-5 ring-1 ring-line transition-shadow duration-150 hover:ring-line-strong active:scale-[0.99]';

function PostSeries({
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
    const heading = (
        <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
                <p className={quietLabel}>{ui('Series')}</p>
                <h2 id="post-series-heading" className={`mt-1 break-words break-keep ${sectionTitle}`}>
                    <a href={seriesPath} className="transition-colors duration-150 hover:text-content-secondary">
                        {name}
                    </a>
                </h2>
            </div>
            {navigation && (
                <p className="shrink-0 text-sm font-semibold tabular-nums text-content-secondary">
                    {`${navigation.index} / ${navigation.total}`}
                </p>
            )}
        </div>
    );
    if (!navigation) {
        return (
            <section className="mt-20" aria-labelledby="post-series-heading">
                {heading}
                <p className="mt-3 text-sm text-content-secondary">
                    {ui('This hidden post does not appear in the series list.')}
                </p>
                <a href={seriesPath} className={textLink}>
                    {ui('View all series')}
                    <SiteIcon name="arrow-right" className="text-xs" />
                </a>
            </section>
        );
    }
    const { index, total, entries, previous, next } = navigation;
    const link = (entry: PostSeriesEntry) => publicPostPath(author, entry.url);
    return (
        <section className="mt-20" aria-labelledby="post-series-heading">
            {heading}
            <SeriesProgress index={index} total={total} />
            {(previous || next) && (
                <nav aria-label={ui('Navigate series')} className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {previous && (
                        <a href={link(previous)} rel="prev" className={seriesTile}>
                            <span className={quietLabel}>{ui('Previous post')}</span>
                            <span className="line-clamp-2 font-semibold leading-snug break-words break-keep text-content">
                                {previous.title}
                            </span>
                        </a>
                    )}
                    {next && (
                        <a href={link(next)} rel="next" className={`${seriesTile} sm:col-start-2 sm:text-right`}>
                            <span className={quietLabel}>{ui('Next post')}</span>
                            <span className="line-clamp-2 font-semibold leading-snug break-words break-keep text-content">
                                {next.title}
                            </span>
                        </a>
                    )}
                </nav>
            )}
            <details className="group mt-2">
                <summary className={`${textLink} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                    {ui('Posts in this series')}
                    <SiteIcon
                        name="chevron-down"
                        className="text-xs transition-transform duration-150 group-open:rotate-180"
                    />
                </summary>
                <ol className="mt-1 border-t border-line-light">
                    {entries.map((entry) => {
                        const here = entry.index === index;
                        const content = (
                            <>
                                <span className="w-6 shrink-0 tabular-nums text-content-hint">{entry.index}</span>
                                <span className="min-w-0 flex-1 break-words break-keep">{entry.title}</span>
                                {here && (
                                    <span className="shrink-0 text-[13px] font-semibold text-content-secondary">
                                        {ui('Reading')}
                                    </span>
                                )}
                            </>
                        );
                        const row = 'flex min-h-11 items-baseline gap-3 py-3 text-[15px] leading-snug';
                        return (
                            <li key={entry.url} className="border-b border-line-light">
                                {here ? (
                                    <span aria-current="page" className={`${row} font-semibold text-content`}>
                                        {content}
                                    </span>
                                ) : (
                                    <a
                                        href={link(entry)}
                                        className={`${row} text-content-secondary transition-colors duration-150 hover:text-content`}
                                    >
                                        {content}
                                    </a>
                                )}
                            </li>
                        );
                    })}
                </ol>
                {total > entries.length && (
                    <a href={seriesPath} className={`${textLink} mt-1`}>
                        {ui('{count, plural, one{See # post} other{See all # posts}}', { count: total })}
                        <SiteIcon name="arrow-right" className="text-xs" />
                    </a>
                )}
            </details>
        </section>
    );
}

const subscribeButton =
    'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-[13px] font-semibold ring-1 transition-colors duration-150 active:scale-[0.98] sm:w-auto';

function ColophonSubscription({ data }: { data: PostPageData }) {
    const { postPath, csrfToken, subscription: author } = data;
    if (!author) return null;
    const label = ui('Subscribe to new posts by {value0}', { value0: author.username });
    if (!data.viewerAuthenticated)
        return (
            <LoginPromptLink
                returnTo={postPath}
                action="subscribe"
                aria-label={label}
                className={`${subscribeButton} shrink-0 text-content ring-line hover:ring-line-strong`}
            >
                <SiteIcon name="bell" className="text-xs" />
                {ui('Subscribe')}
            </LoginPromptLink>
        );
    return (
        <form
            className="mb-0 shrink-0"
            action={`/v1/users/@${encodeURIComponent(author.username)}/subscription`}
            method="post"
        >
            <input type="hidden" name="returnTo" value={postPath} />
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
            {author.isSubscribed && <input type="hidden" name="action" value="unsubscribe" />}
            <button
                type="submit"
                className={`${subscribeButton} ${author.isSubscribed ? 'text-content-secondary ring-line hover:text-content' : 'text-content ring-line hover:ring-line-strong'}`}
                aria-label={label}
                aria-pressed={author.isSubscribed}
            >
                <SiteIcon name={author.isSubscribed ? 'check' : 'bell'} className="text-xs" />
                {author.isSubscribed ? ui('Subscribed') : ui('Subscribe')}
            </button>
        </form>
    );
}

const colophonRow = 'grid gap-4 border-b border-line sm:grid-cols-[6rem_minmax(0,1fr)]';

/** What a book prints on its last page: who wrote this post, when, and under which tags. */
function PostColophon({ data }: { data: PostPageData }) {
    const { authorPath, published, updated, timelapsePath, tags } = data;
    const homepage = data.authorHomepage;
    const revised = updated && published && updated.text !== published.text ? updated : undefined;
    const timelapse = timelapsePath && (
        <>
            <MetaDot />
            <a
                href={timelapsePath}
                className="text-[13px] font-semibold text-content underline decoration-line-strong decoration-1 underline-offset-[3px] transition-colors duration-150 hover:text-content-secondary"
            >
                {ui('See how it was written')}
            </a>
        </>
    );
    const date = (label: string, value: NonNullable<PostPageData['published']>, last: boolean) => (
        <div className={`${colophonRow} grid-cols-[5rem_minmax(0,1fr)] items-baseline py-3.5`}>
            <dt className={quietLabel}>{label}</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-x-2 text-[15px] leading-relaxed text-content">
                <time dateTime={value.iso}>{value.text}</time>
                {last && timelapse}
            </dd>
        </div>
    );
    return (
        <section className="mt-16 border-t border-content" aria-labelledby="post-info-heading">
            <h2 id="post-info-heading" className="sr-only">
                {ui('Post information')}
            </h2>
            <dl>
                <div className={`${colophonRow} grid-cols-[3.5rem_minmax(0,1fr)] items-start py-6`}>
                    <dt>
                        <span className="sr-only">{ui('Author')}</span>
                        <img
                            src={data.avatar}
                            alt=""
                            className="size-14 rounded-full object-cover ring-1 ring-line"
                            loading="lazy"
                        />
                    </dt>
                    <dd className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <div className="min-w-0">
                            <p className="break-words text-lg font-bold leading-snug tracking-tight text-content">
                                {data.username}
                            </p>
                            {data.authorBio && (
                                <p className="mt-0.5 text-sm leading-relaxed break-keep text-content-secondary">
                                    {data.authorBio}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-x-5">
                                <a href={authorPath} className={textLink}>
                                    {ui('View profile')}
                                    <SiteIcon name="arrow-right" className="text-xs" />
                                </a>
                                {homepage && (
                                    <a
                                        href={homepage}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex min-h-11 min-w-0 items-center gap-1.5 text-sm font-medium text-content-secondary transition-colors duration-150 hover:text-content"
                                    >
                                        <SiteIcon name="link" className="shrink-0 text-xs" />
                                        <span className="sr-only">{`${ui('Author website')}: `}</span>
                                        <span className="truncate">
                                            {homepage.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
                                        </span>
                                    </a>
                                )}
                            </div>
                        </div>
                        <ColophonSubscription data={data} />
                    </dd>
                </div>
                {published &&
                    date(
                        data.visibility === 'draft' ? ui('Preview source') : ui('First published'),
                        published,
                        !revised
                    )}
                {revised && date(ui('Updated'), revised, true)}
                {tags.length > 0 && (
                    <div className={`${colophonRow} grid-cols-[5rem_minmax(0,1fr)] items-start py-1`}>
                        <dt className={`flex min-h-11 items-center ${quietLabel}`}>{ui('Tags')}</dt>
                        <dd className="flex min-w-0 flex-wrap gap-x-4" itemProp="keywords">
                            {tags.map((tag) => (
                                <a
                                    key={tag}
                                    href={`/tag/${encodeURIComponent(tag)}`}
                                    className="inline-flex min-h-11 min-w-0 items-center text-[15px] leading-snug break-words text-content-secondary transition-colors duration-150 hover:text-content"
                                >
                                    {/* One text run, so a long tag wraps with its mark. */}
                                    <span className="min-w-0">
                                        <span className="text-content-hint">#</span>
                                        {tag}
                                    </span>
                                </a>
                            ))}
                        </dd>
                    </div>
                )}
            </dl>
        </section>
    );
}

const dockButton =
    'inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full text-content-secondary transition-all duration-200 hover:bg-surface-subtle/80 hover:text-content active:scale-95';

/** Rows like the author's overview, so a list of posts reads the same everywhere. */
function RelatedPosts({ posts, username }: { posts: RelatedPostView[]; username: string }) {
    if (!posts.length) return null;
    return (
        <section className="mt-20" aria-labelledby="related-post-heading">
            <h2 id="related-post-heading" className={sectionTitle}>
                {ui('Related posts')}
            </h2>
            <ul className="mt-3 border-t border-line-light">
                {posts.map((post) => (
                    <li key={post.href} className="border-b border-line-light">
                        <a href={post.href} className="group flex items-center gap-4 py-5 sm:gap-8 sm:py-6">
                            <div className="min-w-0 flex-1">
                                <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight break-keep text-content transition-colors duration-150 group-hover:text-content-secondary sm:text-lg">
                                    {post.title}
                                </h3>
                                {post.description ? (
                                    <p className="mt-1.5 hidden truncate text-sm text-content-secondary sm:block">
                                        {post.description}
                                    </p>
                                ) : null}
                                <p className="mt-2.5 flex flex-wrap items-center gap-x-2 text-[13px] text-content-secondary">
                                    {post.username !== username && (
                                        <>
                                            <span className="font-semibold text-content">{post.username}</span>
                                            <MetaDot />
                                        </>
                                    )}
                                    {post.date && (
                                        <>
                                            <time dateTime={post.date.iso}>{post.date.text}</time>
                                            <MetaDot />
                                        </>
                                    )}
                                    <span>{ui('{minutes} min', { minutes: post.readTime })}</span>
                                </p>
                            </div>
                            {post.image ? (
                                <div className="aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-xl bg-surface-subtle ring-1 ring-line/60 sm:w-36">
                                    <img
                                        className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                                        src={post.image}
                                        alt=""
                                        loading="lazy"
                                    />
                                </div>
                            ) : null}
                        </a>
                    </li>
                ))}
            </ul>
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
                    <OutlineLinks headings={headings} />
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

    // New HTML replaces the blocks this effect decorated, so it runs again for each body.
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
            <main className="min-h-[calc(100vh-10.5rem)]">
                {fullCover && coverSection}
                <div className={`post-detail-body px-4 md:px-6${fullCover ? ' post-detail-body--after-cover' : ''}`}>
                    <div className="post-detail-layout">
                        <aside className="post-detail-sidebar">
                            <div className="sticky top-28 space-y-4">{banners('left')}</div>
                        </aside>
                        <div className="post-detail-main mt-6 pb-16">
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
                                {hasBanner('bottom') && <div className="mb-16 space-y-4">{banners('bottom')}</div>}
                                <PostColophon data={data} />
                            </article>
                            {visibility !== 'draft' && data.seriesLink && data.seriesName && (
                                <PostSeries
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
                            {visibility === 'public' && <RelatedPosts posts={data.related} username={data.username} />}
                        </div>
                        <aside className="post-detail-sidebar">
                            <div className="sticky top-28 space-y-4">
                                {headings.length > 0 && <SideOutline headings={headings} />}
                                {banners('right')}
                            </div>
                        </aside>
                    </div>
                </div>
                {hasDock && <PostDock data={data} />}
            </main>
            <div className="post-detail-footer-action-space">
                <SiteFooter brand={data.brand} year={data.copyrightYear} />
            </div>
        </>
    );
}
