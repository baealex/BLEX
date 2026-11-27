import { SiteIcon } from '../../appearance/icons.js';
import { SiteFooter } from '../../appearance/shell.js';
import { ui } from '../../i18n/public-ui.js';
import type { ReactNode } from 'react';
import type { SearchPageData, SearchResultView } from './discovery-page-data';
import { EmptyState } from './post-list';
import { ReactFragment } from './search-ui';

function searchForm(query: string, username: string): ReactNode {
    return (
        <form action="/search" method="get">
            {username ? <input type="hidden" name="username" value={username} /> : null}
            <div className="flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 shadow-sm transition-all duration-150 focus-within:ring-2 focus-within:ring-content-hint">
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
                    className="min-w-0 flex-1 bg-transparent text-sm text-content placeholder:text-content-hint focus:outline-hidden"
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

const matchedLabels = {
    title: () => ui('Title'),
    description: () => ui('Description'),
    tag: () => ui('Tag'),
    content: () => ui('Content')
};

function SearchResultCard({ result, query }: { result: SearchResultView; query: string }): ReactNode {
    return (
        <article className="overflow-hidden rounded-2xl border border-line-light bg-surface transition-all duration-150 hover:border-line hover:shadow-subtle">
            <a href={result.href} className="block p-4 transition-all duration-150 active:scale-[0.99] sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="w-full shrink-0 sm:w-44">
                        <div className="h-36 overflow-hidden rounded-xl border border-line bg-surface-subtle sm:h-28">
                            {result.image ? (
                                <img
                                    src={result.image}
                                    alt={result.title}
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
                                src={result.author.avatar}
                                alt={result.author.username}
                                className="size-6 rounded-full border border-line-light object-cover"
                                loading="lazy"
                            />
                            <span className="font-medium text-content">{result.author.username}</span>
                            <span aria-hidden={true}>·</span>
                            {result.date ? (
                                <time dateTime={result.date.iso ?? undefined}>{result.date.text}</time>
                            ) : null}
                            {result.readTime > 0 ? (
                                <ReactFragment>
                                    <span aria-hidden={true}>·</span>
                                    <span>{ui('{value0} min read', { value0: result.readTime })}</span>
                                </ReactFragment>
                            ) : null}
                        </div>
                        <h2 className="mb-2 text-lg font-bold leading-snug text-content sm:text-xl">
                            {highlightText(result.title, query)}
                        </h2>
                        {result.description ? (
                            <p className="line-clamp-2 text-sm leading-relaxed text-content-secondary">
                                {highlightText(result.description, query)}
                            </p>
                        ) : null}
                        {result.matched.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {result.matched.map((field) => (
                                    <span
                                        key={field}
                                        className="inline-flex items-center rounded-md bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-content-secondary"
                                    >
                                        {matchedLabels[field]()}
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

function SearchPagination({
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

/** The search page the server renders when the search screen is not installed. */
export function SearchPage({ data }: { data: SearchPageData }) {
    const { searchText, username, count, results } = data;
    return (
        <>
            <main>
                <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
                    <section>
                        <h1 className="mb-4 text-2xl font-bold tracking-tight text-content sm:text-3xl">
                            {ui('Search posts')}
                        </h1>
                        {searchForm(searchText, username)}
                    </section>
                    {searchText ? (
                        results.length ? (
                            <section className="space-y-4">
                                <div className="rounded-2xl border border-line bg-surface-subtle px-4 py-3">
                                    <h2 className="text-lg font-semibold text-content">
                                        <strong className="text-content">
                                            {ui('{count, plural, one{# result} other{# results}}', { count })}
                                        </strong>
                                        <span className="ml-2 text-xs font-normal text-content-hint">
                                            {ui('Search for “{value0}”', { value0: searchText })}
                                        </span>
                                    </h2>
                                </div>
                                <div className="space-y-4">
                                    {results.map((result) => (
                                        <SearchResultCard key={result.href} result={result} query={searchText} />
                                    ))}
                                </div>
                                <SearchPagination
                                    page={data.pagination.page}
                                    pages={data.pagination.pages}
                                    query={searchText}
                                    username={username}
                                />
                            </section>
                        ) : (
                            <EmptyState
                                title={ui('No results')}
                                message={ui('Try a different search query or author name.')}
                                icon="search"
                                framed={true}
                            />
                        )
                    ) : (
                        <EmptyState
                            title={ui('What are you looking for?')}
                            message={ui('Search public posts by title, description, tags, or content.')}
                            icon="search"
                            framed={true}
                        />
                    )}
                </div>
            </main>
            <SiteFooter brand={data.brand} year={data.copyrightYear} />
        </>
    );
}
