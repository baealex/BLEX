import { ui } from '../../i18n/public-ui.js';
import { timeSince } from '../../lib/date-format';
import type { ReactNode } from 'react';
import { SiteIcon, type SiteIconName } from '../../appearance/icons';
import { LoginPromptLink } from '../engagement/ui/login-prompt-link';
import type { CardLikes, PostRow } from '@blex/contracts/public';
import type { DiscoveryPagination } from './discovery-page-data';
import { avatarUrl, dateLabel, dateValue, mediaUrl, pageUrl } from './view-helpers';

export function postPath(post: Pick<PostRow, 'authorUsername' | 'slug'>): string {
    return `/@${encodeURIComponent(post.authorUsername)}/${encodeURIComponent(post.slug)}`;
}

/** A post card's display values. Pages that hydrate publish this in their HTML, so each field is listed by hand. */
export interface PostCardView {
    href: string;
    title: string;
    image: string | null;
    date: { iso: string; text: string } | null;
    readTime: number;
    summary: string;
    author: { username: string; href: string; avatar: string } | null;
    series: { name: string; href: string } | null;
    likeAction: string;
    likeCount: number;
    liked: boolean;
    commentCount: number;
}

export type PostCardLikes = Pick<CardLikes, 'csrfToken' | 'returnTo'>;

// Dates are formatted once on the server, so a browser's clock or locale data cannot break hydration.
export function postCardView(
    post: PostRow,
    {
        showAuthor = true,
        likes,
        relativeDate = false
    }: { showAuthor?: boolean; likes?: CardLikes; relativeDate?: boolean } = {}
): PostCardView {
    const authorHref = `/@${encodeURIComponent(post.authorUsername)}`;
    const hasImage = Boolean(post.image && post.image !== 'None' && post.image !== 'null');
    const published = post.publishedDate;
    const iso = dateValue(published);
    return {
        href: postPath(post),
        title: post.title,
        image: hasImage ? mediaUrl(post.image) : null,
        date: published && iso ? { iso, text: relativeDate ? timeSince(published) : dateLabel(published) } : null,
        readTime: post.readTime,
        summary: post.description || post.subtitle,
        author: showAuthor
            ? { username: post.authorUsername, href: authorHref, avatar: avatarUrl(post.authorAvatar) }
            : null,
        series:
            !showAuthor && post.seriesUrl
                ? {
                      name: post.seriesName ?? ui('Series'),
                      href: `${authorHref}/series/${encodeURIComponent(post.seriesUrl)}`
                  }
                : null,
        likeAction: `/like/${encodeURIComponent(post.slug)}`,
        likeCount: post.likeCount ?? 0,
        liked: likes?.likedIds.has(post.id) ?? false,
        commentCount: post.commentCount ?? 0
    };
}

function PostCardLike({ card, likes }: { card: PostCardView; likes?: PostCardLikes }): ReactNode {
    const { liked, likeCount: count } = card;
    const className = `touch-target relative inline-flex h-7 min-w-[51px] items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-300 active:scale-95 ${
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
            <LoginPromptLink
                returnTo={likes?.returnTo ?? card.href}
                action="like"
                className={className}
                aria-label={label}
            >
                {content}
            </LoginPromptLink>
        );
    return (
        <form method="post" action={card.likeAction}>
            <input type="hidden" name="csrfmiddlewaretoken" value={likes.csrfToken} />
            <input type="hidden" name="returnTo" value={likes.returnTo} />
            <button type="submit" className={`cursor-pointer ${className}`} aria-label={label} aria-pressed={liked}>
                {content}
            </button>
        </form>
    );
}

function PostCard({
    card,
    priority,
    likes
}: {
    card: PostCardView;
    priority: boolean;
    likes?: PostCardLikes;
}): ReactNode {
    const { href, author, series } = card;
    return (
        <article className="group flex flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-150 hover:ring-line-strong/70 active:scale-[0.98]">
            {card.image ? (
                <div className="aspect-[16/9] overflow-hidden">
                    <a href={href} className="block h-full">
                        <img
                            className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
                            src={card.image}
                            alt={card.title}
                            loading={priority ? 'eager' : 'lazy'}
                        />
                    </a>
                </div>
            ) : null}
            <div className="flex flex-grow flex-col p-5">
                <h2 className="mb-3 line-clamp-2 text-md font-bold leading-snug text-content">
                    <a href={href} className="transition-colors duration-150 hover:text-content-secondary">
                        {card.title}
                    </a>
                </h2>
                <div className="mb-3 flex items-center gap-3 text-xs text-content-secondary">
                    <div className="flex items-center gap-1.5">
                        <SiteIcon name="calendar" className="text-content-hint" />
                        {card.date ? <time dateTime={card.date.iso}>{card.date.text}</time> : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <SiteIcon name="clock" className="text-content-hint" />
                        <span>{ui('{value0} min', { value0: card.readTime })}</span>
                    </div>
                </div>
                <p
                    className={`mb-4 text-sm leading-relaxed text-content-secondary ${card.image ? 'line-clamp-3' : 'flex-grow'}`}
                >
                    <a href={href}>{card.summary}</a>
                </p>
                <footer className="mt-auto flex items-center justify-between border-t border-line-light pt-4">
                    {author ? (
                        <div className="flex min-w-0 items-center gap-2">
                            <a href={author.href} className="touch-target relative shrink-0">
                                <img
                                    className="size-6 rounded-full object-cover ring-2 ring-line-light"
                                    src={author.avatar}
                                    alt={author.username}
                                    loading="lazy"
                                />
                            </a>
                            <a
                                href={author.href}
                                className="truncate text-xs font-semibold text-content transition-colors hover:text-content-secondary"
                            >
                                {author.username}
                            </a>
                        </div>
                    ) : series ? (
                        <a
                            href={series.href}
                            className="touch-target relative inline-flex max-w-32 items-center whitespace-nowrap rounded-full bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-content transition-all duration-150 hover:bg-line-light"
                        >
                            <SiteIcon name="stack-2" className="mr-1.5" />
                            <span className="min-w-0 truncate">{series.name}</span>
                        </a>
                    ) : (
                        <div />
                    )}
                    <div className="flex items-center gap-4 text-content-secondary">
                        <span className="flex items-center gap-1.5 text-xs">
                            <SiteIcon name="message-circle" />
                            <span aria-hidden="true">{String(card.commentCount)}</span>
                            <span className="sr-only">
                                {ui('{value0, plural, one{# comment} other{# comments}}', {
                                    value0: card.commentCount
                                })}
                            </span>
                        </span>
                        <PostCardLike card={card} likes={likes} />
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

export function PostCardGrid({
    cards,
    likes,
    priorityFirst = true,
    className = ''
}: {
    cards: PostCardView[];
    likes?: PostCardLikes;
    priorityFirst?: boolean;
    className?: string;
}): ReactNode {
    return (
        <div className={`masonry-grid ${className}`.trim()}>
            {cards.map((card, index) => (
                <PostCard key={card.href} card={card} priority={priorityFirst && index === 0} likes={likes} />
            ))}
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
        <PostCardGrid
            cards={posts.map((post) => postCardView(post, { showAuthor, likes, relativeDate }))}
            likes={likes}
            priorityFirst={priorityFirst}
            className={className}
        />
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
                // An arrow with nowhere to go is only drawn; the current page is announced instead.
                <span className="pagination-link" aria-hidden="true">
                    <SiteIcon name={label as SiteIconName} />
                </span>
            ) : (
                <a
                    className="pagination-link"
                    href={pageUrl(path, search, preserve, targetPage)}
                    rel={rel}
                    aria-label={ariaLabel}
                    aria-current={active ? 'page' : undefined}
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

export function PageNavigation({ pagination }: { pagination: DiscoveryPagination }): ReactNode {
    const { path, search, preserve, page, pages } = pagination;
    return (
        <Pagination path={path} search={new URLSearchParams(search)} preserve={preserve} page={page} pages={pages} />
    );
}

export type { CardLikes };
