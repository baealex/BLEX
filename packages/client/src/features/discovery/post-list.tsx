import { ui } from '../../i18n/public-ui.js';
import { timeSince } from '../../lib/date-format';
import type { ReactNode } from 'react';
import { SiteIcon, type SiteIconName } from '../../appearance/icons';
import { loginPromptProps } from '../engagement/ui/login-prompt';
import type { CardLikes, PostRow } from '../../contracts/public';
import { avatarUrl, dateLabel, dateValue, mediaUrl, pageUrl } from './view-helpers';

export function postPath(post: Pick<PostRow, 'authorUsername' | 'slug'>): string {
    return `/@${encodeURIComponent(post.authorUsername)}/${encodeURIComponent(post.slug)}`;
}

function PostCardLike({ post, likes }: { post: PostRow; likes?: CardLikes }): ReactNode {
    const liked = likes?.likedIds.has(post.id) ?? false;
    const count = post.likeCount ?? 0;
    const className = `inline-flex h-7 min-w-[51px] items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-300 active:scale-95 ${
        liked
            ? 'border-danger-line bg-danger-surface text-danger'
            : 'border-line bg-surface-elevated text-content-hint hover:border-line-strong hover:bg-surface-subtle hover:text-content-secondary'
    }`;
    const label = `${liked ? ui('Unlike') : ui('Like')} (${count})`;
    const content = (
        <>
            <SiteIcon name="heart" />
            <span>{String(count)}</span>
        </>
    );
    if (!likes?.csrfToken)
        return (
            <a
                {...loginPromptProps(likes?.returnTo ?? postPath(post), 'like')}
                className={className}
                aria-label={label}
            >
                {content}
            </a>
        );
    return (
        <form method="post" action={`/like/${encodeURIComponent(post.slug)}`}>
            <input type="hidden" name="csrfmiddlewaretoken" value={likes.csrfToken} />
            <input type="hidden" name="returnTo" value={likes.returnTo} />
            <button type="submit" className={`cursor-pointer ${className}`} aria-label={label} aria-pressed={liked}>
                {content}
            </button>
        </form>
    );
}

function PostCard({
    post,
    showAuthor,
    priority = false,
    likes,
    relativeDate = false
}: {
    post: PostRow;
    showAuthor: boolean;
    priority?: boolean;
    relativeDate?: boolean;
    likes?: CardLikes;
}): ReactNode {
    const titleHref = postPath(post);
    const authorHref = `/@${encodeURIComponent(post.authorUsername)}`;
    const hasImage = Boolean(post.image && post.image !== 'None' && post.image !== 'null');
    const series = post.seriesUrl ? (
        <a
            href={`${authorHref}/series/${encodeURIComponent(post.seriesUrl)}`}
            className="inline-flex max-w-32 items-center truncate rounded-full bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-content transition-all duration-150 hover:bg-line-light"
        >
            <SiteIcon name="stack-2" className="mr-1.5" />
            <span className="truncate">{post.seriesName ?? ui('Series')}</span>
        </a>
    ) : null;
    return (
        <article
            className="group flex flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-150 hover:ring-line-strong/70 active:scale-[0.98]"
            key={post.id}
        >
            {hasImage ? (
                <div className="aspect-[16/9] overflow-hidden">
                    <a href={titleHref} className="block h-full">
                        <img
                            className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
                            src={mediaUrl(post.image) ?? undefined}
                            alt={post.title}
                            loading={priority ? 'eager' : 'lazy'}
                        />
                    </a>
                </div>
            ) : null}
            <div className="flex flex-grow flex-col p-5">
                <h2 className="mb-3 line-clamp-2 text-md font-bold leading-snug text-content">
                    <a href={titleHref} className="transition-colors duration-150 hover:text-content-secondary">
                        {post.title}
                    </a>
                </h2>
                <div className="mb-3 flex items-center gap-3 text-xs text-content-secondary">
                    <div className="flex items-center gap-1.5">
                        <SiteIcon name="calendar" className="text-content-hint" />
                        {post.publishedDate ? (
                            <time dateTime={dateValue(post.publishedDate) ?? undefined}>
                                {relativeDate ? timeSince(post.publishedDate) : dateLabel(post.publishedDate)}
                            </time>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <SiteIcon name="clock" className="text-content-hint" />
                        <span>{ui('{value0} min', { value0: post.readTime })}</span>
                    </div>
                </div>
                <p
                    className={`mb-4 text-sm leading-relaxed text-content-secondary ${hasImage ? 'line-clamp-3' : 'flex-grow'}`}
                >
                    <a href={titleHref}>{post.description || post.subtitle}</a>
                </p>
                <footer className="mt-auto flex items-center justify-between border-t border-line-light pt-4">
                    {showAuthor ? (
                        <div className="flex min-w-0 items-center gap-2">
                            <a href={authorHref} className="shrink-0">
                                <img
                                    className="size-6 rounded-full object-cover ring-2 ring-line-light"
                                    src={avatarUrl(post.authorAvatar)}
                                    alt={post.authorUsername}
                                    loading="lazy"
                                />
                            </a>
                            <a
                                href={authorHref}
                                className="truncate text-xs font-semibold text-content transition-colors hover:text-content-secondary"
                            >
                                {post.authorUsername}
                            </a>
                        </div>
                    ) : (
                        (series ?? <div />)
                    )}
                    <div className="flex items-center gap-4 text-content-secondary">
                        <span className="flex items-center gap-1.5 text-xs">
                            <SiteIcon name="message-circle" />
                            <span aria-hidden="true">{String(post.commentCount ?? 0)}</span>
                            <span className="sr-only">
                                {ui('{value0, plural, one{# comment} other{# comments}}', {
                                    value0: post.commentCount ?? 0
                                })}
                            </span>
                        </span>
                        {PostCardLike({
                            post,
                            likes
                        })}
                    </div>
                </footer>
            </div>
        </article>
    );
}

export function EmptyState({
    title,
    message,
    icon = 'writing',
    framed = false,
    actionUrl,
    actionLabel,
    actionIcon
}: {
    title: string;
    message?: string;
    icon?: SiteIconName;
    framed?: boolean;
    actionUrl?: string;
    actionLabel?: string;
    actionIcon?: SiteIconName;
}): ReactNode {
    return (
        <div className={`py-10 text-center ${framed ? 'rounded-2xl border border-line-light bg-surface-subtle' : ''}`}>
            <div className={`mx-auto ${framed ? 'max-w-sm px-5' : 'max-w-sm'}`}>
                {icon ? (
                    <div
                        className={`mb-4 inline-flex size-12 items-center justify-center rounded-xl ${framed ? 'bg-surface-elevated' : 'bg-surface-subtle'}`}
                    >
                        <SiteIcon name={icon} className="text-lg text-content-hint" />
                    </div>
                ) : null}
                <h2 className="mb-2 text-lg font-semibold text-content">{title}</h2>
                {message ? (
                    <p
                        className={`text-sm leading-relaxed text-content-secondary ${actionUrl && actionLabel ? 'mb-6' : ''}`}
                    >
                        {message}
                    </p>
                ) : null}
                {actionUrl && actionLabel ? (
                    <a
                        href={actionUrl}
                        className="inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 text-sm font-medium text-content-inverted transition-colors duration-150 hover:bg-action-hover active:scale-[0.98]"
                    >
                        {actionIcon ? <SiteIcon name={actionIcon} className="text-sm" /> : null}
                        <span>{actionLabel}</span>
                    </a>
                ) : null}
            </div>
        </div>
    );
}

export function PostGrid({
    posts,
    showAuthor = true,
    priorityFirst = true,
    className = '',
    likes,
    relativeDate = false
}: {
    posts: PostRow[];
    showAuthor?: boolean;
    priorityFirst?: boolean;
    className?: string;
    likes?: CardLikes;
    relativeDate?: boolean;
}): ReactNode {
    if (!posts.length)
        return <EmptyState title={ui('No public posts yet.')} message={ui('Published posts will appear here.')} />;
    return (
        <div className={`masonry-grid ${className}`.trim()}>
            {posts.map((post, index) =>
                PostCard({
                    post,
                    showAuthor,
                    priority: priorityFirst && index === 0,
                    likes,
                    relativeDate
                })
            )}
        </div>
    );
}

export function Pagination({
    path,
    search,
    preserve,
    page,
    pages,
    always = false
}: {
    path: string;
    search: URLSearchParams;
    preserve: string[];
    page: number;
    pages: number;
    always?: boolean;
}): ReactNode {
    if (pages <= 1 && !always) return null;
    const item = (
        targetPage: number,
        label: string,
        active = false,
        disabled = false,
        rel?: string,
        ariaLabel?: string
    ) => (
        <div
            className={`pagination-item ${active ? 'pagination-active' : ''} ${disabled ? 'pagination-disabled' : ''}`.trim()}
            key={label}
        >
            {disabled ? (
                <span className="pagination-link" {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}>
                    <SiteIcon name={label as SiteIconName} />
                </span>
            ) : (
                <a
                    className="pagination-link"
                    href={pageUrl(path, search, preserve, targetPage)}
                    rel={rel}
                    aria-label={ariaLabel}
                >
                    {label.startsWith('chevron') ? <SiteIcon name={label as SiteIconName} /> : label}
                </a>
            )}
        </div>
    );
    const start = pages <= 5 ? 1 : page <= 2 ? 1 : Math.min(Math.max(1, page - 2), pages - 4);
    const end = pages <= 5 ? pages : page <= 2 ? 5 : Math.min(pages, start + 4);
    const numbers = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    return (
        <nav className="pagination-nav" aria-label={ui('Page navigation')}>
            <div className="pagination-action prev">
                {item(1, 'chevrons-left', false, page <= 1, undefined, ui('First page'))}
                {item(page - 1, 'chevron-left', false, page <= 1, 'prev', ui('Previous page'))}
            </div>
            <div className="pagination-pages">
                {numbers.map((number) => item(number, String(number), number === page))}
            </div>
            <div className="pagination-action next">
                {item(page + 1, 'chevron-right', false, page >= pages, 'next', ui('Next page'))}
                {item(pages, 'chevrons-right', false, page >= pages, undefined, ui('Last page'))}
            </div>
        </nav>
    );
}

export type { CardLikes };
