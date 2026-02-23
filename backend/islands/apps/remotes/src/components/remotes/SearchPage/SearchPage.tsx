import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { searchPosts, type SearchResult } from '~/lib/api';
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
                setErrorMessage(data.errorMessage || '검색 중 오류가 발생했습니다.');
            }
        } catch (error) {
            logger.error('Search page error:', error);
            setSearchResults(null);
            setErrorMessage('검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setIsLoading(false);
        }
    }, []);

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
            setErrorMessage('검색어를 입력하세요.');
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

    return (
        <div className="space-y-6">
            <section>
                <h1 className="text-2xl sm:text-3xl font-bold text-content tracking-tight mb-4">포스트 검색</h1>

                <form onSubmit={handleSubmit}>
                    <div className="h-12 px-4 rounded-full border border-line bg-surface shadow-sm flex items-center gap-2 transition-all focus-within:ring-2 focus-within:ring-line">
                        {isLoading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-line border-t-content-secondary" />
                        ) : (
                            <i className="fas fa-search text-sm text-content-hint" />
                        )}
                        <input
                            type="text"
                            value={queryInput}
                            onChange={(event) => setQueryInput(event.target.value)}
                            placeholder="검색어를 입력하세요"
                            className="flex-1 bg-transparent text-sm text-content placeholder-content-hint focus:outline-none"
                            autoComplete="off"
                            autoFocus={!parseSearchParams().query}
                        />
                        {queryInput && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="w-10 h-10 rounded-full text-content-hint hover:text-content hover:bg-surface-subtle transition-colors"
                                aria-label="검색어 초기화">
                                <i className="fas fa-times text-xs" />
                            </button>
                        )}
                    </div>

                    {usernameFilter && (
                        <p className="text-xs text-content-secondary mt-2">
                            작성자 필터 적용 중: <span className="font-semibold text-content">@{usernameFilter}</span>
                        </p>
                    )}
                </form>

                {recentSearches.length > 0 && !hasSearched && (
                    <div className="mt-4">
                        <p className="text-xs font-semibold text-content-secondary uppercase tracking-wider mb-2">최근 검색어</p>
                        <div className="flex flex-wrap gap-2">
                            {recentSearches.map((recentSearch) => (
                                <div
                                    key={recentSearch}
                                    className="inline-flex items-center gap-1 pl-3 pr-1 h-10 rounded-full bg-surface-subtle border border-line">
                                    <button
                                        type="button"
                                        onClick={() => handleRecentSearchClick(recentSearch)}
                                        className="text-sm text-content hover:text-content max-w-[180px] truncate">
                                        {recentSearch}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleRecentSearchRemove(recentSearch)}
                                        className="w-8 h-8 rounded-full text-content-hint hover:text-content hover:bg-line transition-colors"
                                        aria-label={`${recentSearch} 검색어 삭제`}>
                                        <i className="fas fa-times text-[10px]" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {!isLoading && errorMessage && (
                <section className="bg-danger-surface border border-danger-line rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                        <i className="fas fa-circle-exclamation text-danger mt-0.5" />
                        <div>
                            <h2 className="text-sm font-semibold text-danger">검색을 완료하지 못했습니다</h2>
                            <p className="text-sm text-danger mt-1">{errorMessage}</p>
                        </div>
                    </div>
                </section>
            )}

            {!isLoading && !errorMessage && searchResults && (
                <section className="space-y-4">
                    <div className="bg-surface-subtle rounded-2xl border border-line px-4 py-3">
                        <h2 className="text-lg font-semibold text-content">
                            <strong className="text-content">{searchResults.totalSize ?? 0}</strong>개의 포스트
                        </h2>
                        <p className="text-sm text-content-secondary">
                            "{searchResults.query || activeQuery}" 검색 결과
                        </p>
                    </div>

                    {searchResults.results.length > 0 ? (
                        <div className="space-y-3">
                            {searchResults.results.map((result) => (
                                <article
                                    key={`${result.author}-${result.url}`}
                                    className="bg-surface border border-line-light rounded-2xl overflow-hidden hover:border-line hover:shadow-md transition-all">
                                    <a href={`/@${result.author}/${result.url}`} className="block p-4 sm:p-5">
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
                                                            <i className="fas fa-image text-xl" />
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
                                                    <span>·</span>
                                                    <span>{result.createdDate}</span>
                                                    {result.readTime && result.readTime > 0 && (
                                                        <>
                                                            <span>·</span>
                                                            <span>{result.readTime}분 읽기</span>
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

                                                {result.positions && result.positions.length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {result.positions.map((position) => (
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
                        <div className="bg-surface border border-line-light rounded-2xl p-12 text-center">
                            <div className="w-16 h-16 bg-surface-subtle rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <i className="fas fa-search text-2xl text-content-hint" />
                            </div>
                            <h3 className="text-lg font-semibold text-content mb-1">검색 결과가 없습니다</h3>
                            <p className="text-sm text-content-secondary">다른 검색어를 시도해보세요.</p>
                        </div>
                    )}

                    {searchResults.lastPage > 1 && (
                        <div className="pt-2 flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1}
                                className="h-10 px-4 rounded-lg border border-line bg-surface text-sm font-medium text-content disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-subtle transition-colors">
                                이전
                            </button>

                            <div className="flex items-center gap-1">
                                {visiblePages.map((pageNumber) => (
                                    <button
                                        key={pageNumber}
                                        type="button"
                                        onClick={() => handlePageChange(pageNumber)}
                                        className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors ${pageNumber === page
                                            ? 'bg-action text-content-inverted'
                                            : 'bg-surface border border-line text-content-secondary hover:bg-surface-subtle'
                                            }`}>
                                        {pageNumber}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === searchResults.lastPage}
                                className="h-10 px-4 rounded-lg border border-line bg-surface text-sm font-medium text-content disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-subtle transition-colors">
                                다음
                            </button>
                        </div>
                    )}
                </section>
            )}

        </div>
    );
};

export default SearchPage;
