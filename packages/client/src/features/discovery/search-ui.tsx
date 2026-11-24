import { ui } from '../../i18n/public-ui.js';
import type { ReactNode } from 'react';
import { SiteIcon } from '../../appearance/icons';
import type { PostRow } from '@blex/contracts/public';
import { avatarUrl, dateLabel, dateValue, mediaUrl } from './view-helpers';
import { postPath } from './post-list';

export function ReactFragment({ children }: { children: ReactNode }): ReactNode {
    return <div>{children}</div>;
}

function withoutParams(search: URLSearchParams, ...names: string[]): URLSearchParams {
    const next = new URLSearchParams(search);
    for (const name of names) next.delete(name);
    return next;
}

function withQuery(path: string, search: URLSearchParams): string {
    const query = search.toString();
    return query ? `${path}?${query}` : path;
}

export function QueryFilter({
    path,
    search,
    placeholder,
    id
}: {
    path: string;
    search: URLSearchParams;
    placeholder: string;
    id: string;
}): ReactNode {
    const others = withoutParams(search, 'q', 'page');
    const occurrences = new Map<string, number>();
    return (
        <form method="get" action={path} className="relative">
            {[...others].map(([name, value]) => {
                const identity = JSON.stringify([name, value]);
                const occurrence = occurrences.get(identity) ?? 0;
                occurrences.set(identity, occurrence + 1);
                return (
                    <input key={JSON.stringify([name, value, occurrence])} type="hidden" name={name} value={value} />
                );
            })}
            <div className="relative">
                <input
                    id={id}
                    type="text"
                    name="q"
                    defaultValue={search.get('q') ?? ''}
                    placeholder={placeholder}
                    autoComplete="off"
                    className="peer w-full rounded-2xl bg-surface-elevated px-4 py-2.5 pr-10 text-content ring-1 ring-line/60 transition-all placeholder:text-content-hint focus:ring-2 focus:ring-line-strong/70 focus:outline-none"
                />
                <a
                    href={withQuery(path, others)}
                    aria-label={ui('Clear search')}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-content-hint transition-colors hover:text-content-secondary peer-placeholder-shown:hidden"
                >
                    <SiteIcon name="x" />
                </a>
                <button
                    type="submit"
                    aria-label={ui('Search')}
                    className="absolute top-1/2 right-3 hidden -translate-y-1/2 text-content-hint peer-placeholder-shown:block"
                >
                    <SiteIcon name="search" />
                </button>
            </div>
        </form>
    );
}

export function DropdownFilter({
    path,
    search,
    param,
    options,
    current
}: {
    path: string;
    search: URLSearchParams;
    param: string;
    options: Array<{ value: string; label: string }>;
    current: string;
}): ReactNode {
    return (
        <details className="group relative w-full" data-account-menu="">
            <summary
                aria-haspopup="listbox"
                className={
                    'flex w-full cursor-pointer list-none items-center justify-between rounded-2xl bg-surface-elevated px-4 py-2.5 text-sm font-medium text-content-secondary ring-1 ring-line/60 hover:bg-surface-subtle focus:ring-2 focus:ring-line-strong/70 focus:outline-none [&::-webkit-details-marker]:hidden'
                }
            >
                <span className="truncate">{options.find((option) => option.value === current)?.label ?? ''}</span>
                <SiteIcon
                    name="chevron-down"
                    className="ml-2 text-xs transition-transform duration-150 group-open:rotate-180"
                />
            </summary>
            <div
                role="listbox"
                className="absolute left-0 z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-lg bg-surface-elevated py-1 shadow-lg ring-1 ring-line/60 sm:right-0"
            >
                {options.map((option) => {
                    const next = withoutParams(search, param, 'page');
                    if (option.value) next.set(param, option.value);
                    const selected = option.value === current;
                    return (
                        <a
                            key={option.value}
                            href={withQuery(path, next)}
                            role="option"
                            aria-selected={selected || undefined}
                            className={`block px-4 py-3 text-sm text-content-secondary transition-colors duration-150 hover:bg-surface-subtle ${selected ? 'bg-surface-subtle font-semibold text-content' : ''}`}
                        >
                            {option.label}
                        </a>
                    );
                })}
            </div>
        </details>
    );
}

export function searchForm(query: string, username: string): ReactNode {
    return (
        <form action="/search" method="get">
            {username ? <input type="hidden" name="username" value={username} /> : null}
            <div className="flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 shadow-sm transition-all duration-150 focus-within:ring-2 focus-within:ring-line">
                <SiteIcon name="search" className="text-sm text-content-hint" />
                <input
                    id="search-query"
                    name="q"
                    type="search"
                    defaultValue={query}
                    placeholder={ui('Enter a search term')}
                    aria-label={ui('Search posts')}
                    autoComplete="off"
                    maxLength={100}
                    className="min-w-0 flex-1 bg-transparent text-sm text-content placeholder:text-content-hint focus:outline-none"
                />
                <button
                    type="submit"
                    className="inline-flex size-11 items-center justify-center rounded-full text-content-hint transition-all duration-150 hover:bg-surface-subtle hover:text-content active:scale-95"
                    aria-label={ui('Search')}
                >
                    <SiteIcon name="arrow-right" className="text-xs" />
                </button>
            </div>
            {username ? (
                <p className="mt-2 text-xs text-content-secondary">
                    {ui('Author filter:')}
                    <a
                        className="font-semibold text-content"
                        href={`/@${encodeURIComponent(username)}`}
                    >{`@${username}`}</a>
                    <span>{' · '}</span>
                    <a href={`/search${query ? `?q=${encodeURIComponent(query)}` : ''}`} className="hover:text-content">
                        {ui('Clear filters')}
                    </a>
                </p>
            ) : null}
        </form>
    );
}

function highlightText(text: string, query: string): ReactNode {
    const words = query.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return text;
    const expression = new RegExp(
        `(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
        'ig'
    );
    const parts = text.split(expression);
    let offset = 0;
    return parts.map((part, index) => {
        const start = offset;
        offset += part.length;
        return index % 2 ? (
            <mark key={`match:${start}`} className="rounded bg-warning-surface px-0.5 text-content">
                {part}
            </mark>
        ) : (
            <span key={`text:${start}`}>{part}</span>
        );
    });
}

export function SearchResultCard({ post, query }: { post: PostRow; query: string }): ReactNode {
    const matched = [
        (post.titleScore ?? 0) > 0 ? ui('Title') : null,
        (post.descriptionScore ?? 0) > 0 ? ui('Description') : null,
        (post.tagScore ?? 0) > 0 ? ui('Tag') : null,
        (post.contentScore ?? 0) > 0 ? ui('Content') : null
    ].filter((value): value is string => value !== null);
    const hasImage = Boolean(post.image && post.image !== 'None' && post.image !== 'null');
    return (
        <article
            className="overflow-hidden rounded-2xl border border-line-light bg-surface transition-all duration-150 hover:border-line hover:shadow-subtle"
            key={`${post.authorUsername}-${post.slug}`}
        >
            <a href={postPath(post)} className="block p-4 transition-all duration-150 active:scale-[0.99] sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="w-full shrink-0 sm:w-44">
                        <div className="h-36 overflow-hidden rounded-xl border border-line bg-surface-subtle sm:h-28">
                            {hasImage ? (
                                <img
                                    src={mediaUrl(post.image) ?? undefined}
                                    alt={post.title}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-content-hint">
                                    <SiteIcon name="photo" className="text-xl" />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-content-secondary">
                            <img
                                src={avatarUrl(post.authorAvatar)}
                                alt={post.authorUsername}
                                className="size-6 rounded-full border border-line-light object-cover"
                                loading="lazy"
                            />
                            <span className="font-medium text-content">{post.authorUsername}</span>
                            <span aria-hidden={true}>·</span>
                            {post.publishedDate ? (
                                <time dateTime={dateValue(post.publishedDate) ?? undefined}>
                                    {dateLabel(post.publishedDate)}
                                </time>
                            ) : null}
                            {post.readTime > 0 ? (
                                <ReactFragment>
                                    <span aria-hidden={true}>·</span>
                                    <span>{ui('{value0} min read', { value0: post.readTime })}</span>
                                </ReactFragment>
                            ) : null}
                        </div>
                        <h2 className="mb-2 text-lg font-bold leading-snug text-content sm:text-xl">
                            {highlightText(post.title, query)}
                        </h2>
                        {post.description ? (
                            <p className="line-clamp-2 text-sm leading-relaxed text-content-secondary">
                                {highlightText(post.description, query)}
                            </p>
                        ) : null}
                        {matched.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {matched.map((field) => (
                                    <span
                                        key={field}
                                        className="inline-flex items-center rounded-md bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-content-secondary"
                                    >
                                        {field}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </a>
        </article>
    );
}

export function SearchPagination({
    page,
    pages,
    query,
    username
}: {
    page: number;
    pages: number;
    query: string;
    username: string;
}): ReactNode {
    if (pages <= 1) return null;
    const start = pages <= 5 ? 1 : page <= 3 ? 1 : page >= pages - 2 ? pages - 4 : page - 2;
    const numbers = Array.from({ length: Math.min(5, pages) }, (_, index) => start + index);
    const href = (next: number) =>
        `/search?${new URLSearchParams({
            q: query,
            ...(username ? { username } : {}),
            ...(next > 1 ? { page: String(next) } : {})
        })}`;
    return (
        <nav className="flex items-center justify-center gap-2 pt-2" aria-label={ui('Search results pages')}>
            <a
                href={page > 1 ? href(page - 1) : undefined}
                aria-disabled={page === 1}
                className="inline-flex h-11 min-h-11 items-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-content transition-all duration-150 hover:bg-surface-subtle active:scale-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                {...(page === 1 ? { tabIndex: -1 } : { rel: 'prev' })}
            >
                {ui('Previous')}
            </a>
            <div className="flex items-center gap-1">
                {numbers.map((number) => (
                    <a
                        href={href(number)}
                        key={number}
                        aria-current={number === page ? 'page' : undefined}
                        aria-label={ui('Page {value0}', { value0: number })}
                        className={`inline-flex size-11 items-center justify-center rounded-lg text-sm font-semibold transition-all duration-150 active:scale-95 ${number === page ? 'bg-action text-content-inverted hover:bg-action-hover' : 'border border-line bg-surface text-content-secondary hover:bg-surface-subtle'}`}
                    >
                        {String(number)}
                    </a>
                ))}
            </div>
            <a
                href={page < pages ? href(page + 1) : undefined}
                aria-disabled={page === pages}
                className="inline-flex h-11 min-h-11 items-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-content transition-all duration-150 hover:bg-surface-subtle active:scale-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                {...(page === pages ? { tabIndex: -1 } : { rel: 'next' })}
            >
                {ui('Next')}
            </a>
        </nav>
    );
}
