import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { formatPublishedDate } from '~/i18n/formatters';
import { normalizeLocale } from '~/i18n/locale';
import { searchPosts, type SearchMatchedField, type SearchResult } from '~/lib/api';
import { getMediaPath, userResource } from '~/modules/static.module';
import { logger } from '~/utils/logger';

interface SearchPageProps {
    username?: string;
}

interface SearchResultsData {
    results: SearchResult[];
    lastPage: number;
    query?: string;
    totalSize?: number;
    elapsedTime?: number;
}

const RECENT_SEARCHES_KEY = 'blex_recent_searches';
const MAX_RECENT_SEARCHES = 8;
const LEGACY_MATCH_FIELDS: Record<string, SearchMatchedField> = {
    '제목': 'title',
    '설명': 'description',
    '태그': 'tag',
    '내용': 'content'
};

const getRecentSearches = (): string[] => {
    try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const saveRecentSearch = (query: string) => {
    const searches = getRecentSearches().filter((item) => item !== query);
    searches.unshift(query);
    localStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES))
    );
};

const removeRecentSearch = (query: string) => {
    const searches = getRecentSearches().filter((item) => item !== query);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
};

const parsePage = (value: string | null): number => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 1) {
        return 1;
    }

    return Math.floor(parsed);
};

const buildSearchUrl = (query: string, page: number, username?: string): string => {
    const params = new URLSearchParams();

    if (query.trim()) {
        params.set('q', query.trim());
        if (page > 1) {
            params.set('page', String(page));
        }
    }

    if (username?.trim()) {
        params.set('username', username.trim());
    }

    const serialized = params.toString();
    return serialized ? `/search?${serialized}` : '/search';
};

const parseSearchParams = () => {
    const params = new URLSearchParams(window.location.search);

    return {
        query: (params.get('q') ?? '').trim(),
        page: parsePage(params.get('page')),
        username: (params.get('username') ?? '').trim()
    };
};

const hasThumbnail = (image: string | undefined) => {
    if (!image) {
        return false;
    }

    return image !== 'None' && image !== 'null';
};

const escapeRegExp = (value: string) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const highlightText = (text: string, query: string): ReactNode => {
    const keywords = query
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(escapeRegExp);

    if (keywords.length === 0) {
        return text;
    }

    const matcher = new RegExp(`(${keywords.join('|')})`, 'ig');
    const parts = text.split(matcher);

    if (parts.length <= 1) {
        return text;
    }

    return parts.map((part, index) => {
        if (index % 2 === 1) {
            return (
                <mark key={`${part}-${index}`} className="bg-warning-surface text-content rounded px-0.5">
                    {part}
                </mark>
            );
        }

        return <span key={`${part}-${index}`}>{part}</span>;
    });
};

const getVisiblePages = (currentPage: number, lastPage: number) => {
    if (lastPage <= 5) {
        return Array.from({ length: lastPage }, (_, index) => index + 1);
    }

    if (currentPage <= 3) {
        return [1, 2, 3, 4, 5];
    }

    if (currentPage >= lastPage - 2) {
        return [lastPage - 4, lastPage - 3, lastPage - 2, lastPage - 1, lastPage];
    }

    return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
};

const SearchPage = ({ username }: SearchPageProps) => {
    const { i18n, t } = useLingui();
    const locale = normalizeLocale(i18n.locale);
    const [queryInput, setQueryInput] = useState('');
    const [activeQuery, setActiveQuery] = useState('');
    const [usernameFilter, setUsernameFilter] = useState((username ?? '').trim());
    const [searchResults, setSearchResults] = useState<SearchResultsData | null>(null);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [page, setPage] = useState(1);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const runSearch = useCallback(async (
        searchQuery: string,
        pageNumber: number,
        authorUsername?: string,
        saveRecent: boolean = false
    ) => {
        const trimmedQuery = searchQuery.trim();
        if (!trimmedQuery) {
            return;
        }

        setIsLoading(true);
        setHasSearched(true);
        setErrorMessage(null);

        try {
            const { data } = await searchPosts(trimmedQuery, {
                page: pageNumber,
                username: authorUsername?.trim() || undefined
            });

            if (data.status === 'DONE') {
                setSearchResults({
                    results: data.body.results || [],
                    lastPage: data.body.lastPage || 1,
                    query: data.body.query || trimmedQuery,
                    totalSize: data.body.totalSize,
                    elapsedTime: data.body.elapsedTime
                });
                setActiveQuery(data.body.query || trimmedQuery);
                setPage(pageNumber);

                if (saveRecent) {
                    saveRecentSearch(trimmedQuery);
                    setRecentSearches(getRecentSearches());
                }
            } else {
                setSearchResults(null);
                if (data.errorMessage) {
                    setErrorMessage(data.errorMessage);
                } else if (data.messageKey === 'search.validation.query_required') {
                    setErrorMessage(t({
                        id: 'search.validation.query_required',
                        message: 'Enter a search term.'
                    }));
                } else if (data.messageKey === 'search.validation.invalid_page') {
                    setErrorMessage(t({
                        id: 'search.validation.invalid_page',
                        message: 'Invalid page number.'
                    }));
                } else {
                    setErrorMessage(data.errorMessage || t({
                        id: 'search.error.generic',
                        message: 'Something went wrong while searching.'
                    }));
                }
            }
        } catch (error) {
            logger.error('Search page error:', error);
            setSearchResults(null);
            setErrorMessage(t({
                id: 'search.error.network',
                message: 'Search is temporarily unavailable. Please try again shortly.'
            }));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        const syncFromUrl = () => {
            const params = parseSearchParams();
            const resolvedUsername = params.username || (username ?? '').trim();

            setQueryInput(params.query);
            setUsernameFilter(resolvedUsername);
            setRecentSearches(getRecentSearches());

            if (!params.query) {
                setActiveQuery('');
                setPage(1);
                setSearchResults(null);
                setErrorMessage(null);
                setHasSearched(false);
                return;
            }

            void runSearch(params.query, params.page, resolvedUsername, false);
        };

        syncFromUrl();
        window.addEventListener('popstate', syncFromUrl);

        return () => {
            window.removeEventListener('popstate', syncFromUrl);
        };
    }, [runSearch, username]);

    const pushSearchUrl = (searchQuery: string, pageNumber: number, authorUsername?: string) => {
        const nextUrl = buildSearchUrl(searchQuery, pageNumber, authorUsername);
        window.history.pushState({}, '', nextUrl);
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        const searchQuery = queryInput.trim();
        if (!searchQuery) {
            setSearchResults(null);
            setHasSearched(true);
            setErrorMessage(t({
                id: 'search.validation.query_required',
                message: 'Enter a search term.'
            }));
            pushSearchUrl('', 1, usernameFilter);
            return;
        }

        pushSearchUrl(searchQuery, 1, usernameFilter);
        void runSearch(searchQuery, 1, usernameFilter, true);
    };

    const handleClear = () => {
        setQueryInput('');
        setActiveQuery('');
        setPage(1);
        setSearchResults(null);
        setErrorMessage(null);
        setHasSearched(false);
        pushSearchUrl('', 1, usernameFilter);
    };

    const handlePageChange = (nextPage: number) => {
        if (!searchResults) {
            return;
        }

        if (nextPage < 1 || nextPage > searchResults.lastPage || nextPage === page) {
            return;
        }

        pushSearchUrl(activeQuery, nextPage, usernameFilter);
        void runSearch(activeQuery, nextPage, usernameFilter, false);

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    const handleRecentSearchClick = (searchQuery: string) => {
        setQueryInput(searchQuery);
        pushSearchUrl(searchQuery, 1, usernameFilter);
        void runSearch(searchQuery, 1, usernameFilter, true);
    };

    const handleRecentSearchRemove = (searchQuery: string) => {
        removeRecentSearch(searchQuery);
        setRecentSearches(getRecentSearches());
    };

    const visiblePages = searchResults
        ? getVisiblePages(page, searchResults.lastPage)
        : [];
    const displayedQuery = searchResults?.query || activeQuery;

    const matchFieldLabels: Record<SearchMatchedField, string> = {
        title: t({
            id: 'search.match.title',
            message: 'Title'
        }),
        description: t({
            id: 'search.match.description',
            message: 'Description'
        }),
        tag: t({
            id: 'search.match.tag',
            message: 'Tag'
        }),
        content: t({
            id: 'search.match.content',
            message: 'Content'
        })
    };

    const getMatchedFieldLabels = (result: SearchResult): string[] => {
        const fields = result.matchedFields ?? result.positions
            ?.map((position) => LEGACY_MATCH_FIELDS[position])
            .filter((field): field is SearchMatchedField => Boolean(field))
            ?? [];

        return fields.map((field) => matchFieldLabels[field]);
    };

    return (
        <div className="space-y-6">
            <section>
                <h1 className="text-2xl sm:text-3xl font-bold text-content tracking-tight mb-4">
                    <Trans id="search.title">Search posts</Trans>
                </h1>

                <form onSubmit={handleSubmit}>
                    <div className="h-12 px-4 rounded-full border border-line bg-surface shadow-sm flex items-center gap-2 transition-all duration-150 focus-within:ring-2 focus-within:ring-line">
                        {isLoading ? (
                            <div
                                role="status"
                                aria-label={t({
                                    id: 'search.loading',
                                    message: 'Searching'
                                })}
                                className="animate-spin rounded-full h-4 w-4 border-2 border-line border-t-content-secondary"
                            />
                        ) : (
                            <i className="fas fa-search text-sm text-content-hint" aria-hidden="true" />
                        )}
                        <input
                            type="text"
                            value={queryInput}
                            onChange={(event) => setQueryInput(event.target.value)}
                            placeholder={t({
                                id: 'search.input.placeholder',
                                message: 'Enter a search term'
                            })}
                            aria-label={t({
                                id: 'search.input.label',
                                message: 'Search posts'
                            })}
                            className="flex-1 bg-transparent text-sm text-content placeholder-content-hint focus:outline-none"
                            autoComplete="off"
                            autoFocus={!parseSearchParams().query}
                        />
                        {queryInput && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="w-11 h-11 min-w-11 min-h-11 rounded-full text-content-hint hover:text-content hover:bg-surface-subtle active:bg-surface-subtle active:scale-95 transition-all duration-150"
                                aria-label={t({
                                    id: 'search.input.clear',
                                    message: 'Clear search term'
                                })}>
                                <i className="fas fa-times text-xs" aria-hidden="true" />
                            </button>
                        )}
                    </div>

                    {usernameFilter && (
                        <p className="text-xs text-content-secondary mt-2">
                            <Trans id="search.author_filter">
                                Filtering by author: <span className="font-semibold text-content">@{usernameFilter}</span>
                            </Trans>
                        </p>
                    )}
                </form>

                {recentSearches.length > 0 && !hasSearched && (
                    <div className="mt-4">
                        <p className="text-xs font-semibold text-content-secondary uppercase tracking-wider mb-2">
                            <Trans id="search.recent.title">Recent searches</Trans>
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {recentSearches.map((recentSearch) => (
                                <div
                                    key={recentSearch}
                                    className="inline-flex items-center gap-1 pl-3 pr-1 h-11 rounded-full bg-surface-subtle border border-line">
                                    <button
                                        type="button"
                                        onClick={() => handleRecentSearchClick(recentSearch)}
                                        className="h-11 inline-flex items-center text-sm text-content hover:text-content max-w-[180px] truncate active:scale-[0.98] transition-all duration-150">
                                        {recentSearch}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleRecentSearchRemove(recentSearch)}
                                        className="w-11 h-11 min-w-11 min-h-11 rounded-full text-content-hint hover:text-content hover:bg-line active:bg-line active:scale-95 transition-all duration-150"
                                        aria-label={t({
                                            id: 'search.recent.remove',
                                            message: `Remove “${{ query: recentSearch }}” from recent searches`
                                        })}>
                                        <i className="fas fa-times text-[10px]" aria-hidden="true" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {!isLoading && errorMessage && (
                <section className="bg-danger-surface border border-danger-line rounded-2xl p-5 animate-in fade-in-0 slide-in-from-top-2 duration-150">
                    <div className="flex items-start gap-3">
                        <i className="fas fa-circle-exclamation text-danger mt-0.5" aria-hidden="true" />
                        <div>
                            <h2 className="text-sm font-semibold text-danger">
                                <Trans id="search.error.heading">Unable to complete search</Trans>
                            </h2>
                            <p className="text-sm text-danger mt-1">{errorMessage}</p>
                        </div>
                    </div>
                </section>
            )}

            {!isLoading && !errorMessage && searchResults && (
                <section className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-150">
                    <div className="bg-surface-subtle rounded-2xl border border-line px-4 py-3">
                        <h2 className="text-lg font-semibold text-content">
                            <strong className="text-content">
                                <Plural
                                    id="search.results.count"
                                    value={searchResults.totalSize ?? 0}
                                    one="# post"
                                    other="# posts"
                                />
                            </strong>
                        </h2>
                        <p className="text-sm text-content-secondary">
                            <Trans id="search.results.for">Results for “{displayedQuery}”</Trans>
                        </p>
                    </div>

                    {searchResults.results.length > 0 ? (
                        <div className="space-y-3">
                            {searchResults.results.map((result) => (
                                <article
                                    key={`${result.author}-${result.url}`}
                                    className="bg-surface border border-line-light rounded-2xl overflow-hidden hover:border-line hover:shadow-subtle transition-all duration-150">
                                    <a
                                        href={`/@${result.author}/${result.url}`}
                                        className="block p-4 sm:p-5 transition-all duration-150 active:scale-[0.99]">
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <div className="w-full sm:w-44 sm:flex-shrink-0">
                                                <div className="h-36 sm:h-28 rounded-xl bg-surface-subtle border border-line overflow-hidden">
                                                    {hasThumbnail(result.image) ? (
                                                        <img
                                                            src={getMediaPath(result.image)}
                                                            alt={result.title}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-content-hint">
                                                            <i className="fas fa-image text-xl" aria-hidden="true" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2 text-xs text-content-secondary">
                                                    <img
                                                        src={getMediaPath(userResource(result.authorImage))}
                                                        alt={result.author}
                                                        className="w-6 h-6 rounded-full border border-line-light"
                                                        loading="lazy"
                                                    />
                                                    <span className="font-medium text-content">{result.author}</span>
                                                    <span aria-hidden="true">·</span>
                                                    <span>{formatPublishedDate(
                                                        result.publishedDate,
                                                        result.createdDate,
                                                        locale
                                                    )}</span>
                                                    {result.readTime && result.readTime > 0 && (
                                                        <>
                                                            <span aria-hidden="true">·</span>
                                                            <span>
                                                                <Plural
                                                                    id="search.read_time"
                                                                    value={result.readTime}
                                                                    one="# min read"
                                                                    other="# mins read"
                                                                />
                                                            </span>
                                                        </>
                                                    )}
                                                </div>

                                                <h3 className="text-lg sm:text-xl font-bold text-content leading-snug mb-2">
                                                    {highlightText(result.title, activeQuery)}
                                                </h3>

                                                {result.description && (
                                                    <p className="text-sm text-content-secondary leading-relaxed line-clamp-2">
                                                        {highlightText(result.description, activeQuery)}
                                                    </p>
                                                )}

                                                {getMatchedFieldLabels(result).length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {getMatchedFieldLabels(result).map((position) => (
                                                            <span
                                                                key={`${result.url}-${position}`}
                                                                className="inline-flex items-center px-2.5 py-1 rounded-md bg-surface-subtle text-content-secondary text-xs font-semibold">
                                                                {position}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </a>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-surface border border-line-light rounded-2xl p-8 text-center">
                            <div className="w-12 h-12 bg-surface-subtle rounded-xl flex items-center justify-center mx-auto mb-3">
                                <i className="fas fa-search text-lg text-content-hint" aria-hidden="true" />
                            </div>
                            <h3 className="text-base font-semibold text-content mb-1">
                                <Trans id="search.empty.title">No results found</Trans>
                            </h3>
                            <p className="text-sm text-content-secondary">
                                <Trans id="search.empty.body">Try a different search term.</Trans>
                            </p>
                        </div>
                    )}

                    {searchResults.lastPage > 1 && (
                        <div className="pt-2 flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1}
                                className="h-11 min-h-11 px-4 rounded-lg border border-line bg-surface text-sm font-medium text-content disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-subtle active:bg-surface-subtle active:scale-95 transition-all duration-150">
                                <Trans id="search.pagination.previous">Previous</Trans>
                            </button>

                            <div className="flex items-center gap-1">
                                {visiblePages.map((pageNumber) => (
                                    <button
                                        key={pageNumber}
                                        type="button"
                                        onClick={() => handlePageChange(pageNumber)}
                                        aria-label={t({
                                            id: 'search.pagination.page',
                                            message: `Go to page ${{ page: pageNumber }}`
                                        })}
                                        aria-current={pageNumber === page ? 'page' : undefined}
                                        className={`w-11 h-11 min-w-11 min-h-11 rounded-lg text-sm font-semibold transition-all duration-150 active:scale-95 ${pageNumber === page
                                            ? 'bg-action text-content-inverted hover:bg-action-hover'
                                            : 'bg-surface border border-line text-content-secondary hover:bg-surface-subtle active:bg-surface-subtle'
                                            }`}>
                                        {pageNumber}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === searchResults.lastPage}
                                className="h-11 min-h-11 px-4 rounded-lg border border-line bg-surface text-sm font-medium text-content disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-subtle active:bg-surface-subtle active:scale-95 transition-all duration-150">
                                <Trans id="search.pagination.next">Next</Trans>
                            </button>
                        </div>
                    )}
                </section>
            )}

        </div>
    );
};

export default SearchPage;
