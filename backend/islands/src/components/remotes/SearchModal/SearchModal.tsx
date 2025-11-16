import React, { useState, useEffect, useCallback } from 'react';
import { getMediaPath } from '~/modules/static.module';
import Modal from '~/components/shared/Modal';

interface SearchResult {
    url: string;
    title: string;
    image: string;
    description: string;
    readTime: number;
    createdDate: string;
    authorImage: string;
    author: string;
    positions: string[];
}

interface SearchResponse {
    elapsedTime: number;
    totalSize: number;
    lastPage: number;
    query: string;
    results: SearchResult[];
}

interface SearchModalProps {
    isOpen?: boolean;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen: initialIsOpen = false }) => {
    const [isOpen, setIsOpen] = useState(initialIsOpen);
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasSearched, setHasSearched] = useState(false);

    // 전역 이벤트로 모달 열기
    useEffect(() => {
        const handleOpenSearch = () => {
            setIsOpen(true);
        };

        window.addEventListener('openSearchModal', handleOpenSearch);
        return () => {
            window.removeEventListener('openSearchModal', handleOpenSearch);
        };
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        setQuery('');
        setSearchResults(null);
        setHasSearched(false);
        setPage(1);
    };

    const handleSearch = useCallback(async (searchQuery: string, pageNum: number = 1) => {
        if (!searchQuery.trim()) {
            return;
        }

        setIsLoading(true);
        setHasSearched(true);

        try {
            const response = await fetch(`/v1/search?q=${encodeURIComponent(searchQuery)}&page=${pageNum}`);
            const data = await response.json();

            if (data.status === 'DONE') {
                setSearchResults(data.body);
                setPage(pageNum);
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSearch(query, 1);
    };

    const handlePageChange = (newPage: number) => {
        handleSearch(query, newPage);
        // 모달 내 검색 결과 영역으로 스크롤
        document.getElementById('search-results-top')?.scrollIntoView({ behavior: 'smooth' });
    };

    const getPositionColor = (position: string) => {
        switch (position) {
            case '제목': return 'bg-gray-100 text-gray-800';
            case '설명': return 'bg-gray-100 text-gray-800';
            case '태그': return 'bg-gray-100 text-gray-800';
            case '내용': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getPositionEmoji = (position: string) => {
        switch (position) {
            case '제목': return '📝';
            case '설명': return '💬';
            case '태그': return '🏷️';
            case '내용': return '📄';
            default: return '';
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            maxWidth="3xl"
            showCloseButton={false}>
            {/* 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 rounded-t-2xl z-10">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-900">
                        <i className="fas fa-search text-lg" />
                        <h2 className="text-lg font-semibold">포스트 검색</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <i className="fas fa-times text-lg" />
                    </button>
                </div>

                {/* 검색 폼 */}
                <div className="px-6 pb-4">
                    <form onSubmit={handleSubmit} className="relative">
                        <div className="relative">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="검색어를 입력하세요..."
                                maxLength={20}
                                className="w-full px-4 py-3 pr-24 border border-solid border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-all text-gray-900 placeholder-gray-500"
                                autoComplete="off"
                                autoFocus
                            />
                            <div className="absolute right-2 top-1/2 flex align-center gap-2">
                                {query && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setQuery('');
                                            setSearchResults(null);
                                            setHasSearched(false);
                                        }}
                                        className="-translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                        <i className="fas fa-times" />
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={!query.trim() || isLoading}
                                    className="-translate-y-1/2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-1.5 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                                    {isLoading ? '검색 중...' : '검색'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {/* 검색 결과 */}
            <div className="px-6 py-6">
                <div id="search-results-top" />

                {isLoading && (
                    <div className="flex items-center justify-center py-16">
                        <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-gray-900" />
                            <span className="text-sm text-gray-600">검색 중...</span>
                        </div>
                    </div>
                )}

                {!isLoading && searchResults && (
                    <>
                        {/* 검색 결과 정보 */}
                        <div className="mb-6">
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                                            <i className="fas fa-check text-white text-sm" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">
                                                <strong className="text-gray-900">{searchResults.totalSize}</strong>개의 포스트를 찾았습니다
                                            </h3>
                                            <p className="text-sm text-gray-600">"{searchResults.query}" 검색 결과</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl">⚡</div>
                                        <div className="text-xs text-gray-500">{searchResults.elapsedTime}초</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 포스트 목록 */}
                        {searchResults.results.length > 0 ? (
                            <div className="space-y-3">
                                {searchResults.results.map((result, index) => (
                                    <article key={index} className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200 overflow-hidden">
                                        <div className="p-5">
                                            {/* 작성자 정보 */}
                                            <div className="flex items-start justify-between mb-3 gap-4">
                                                <a href={`/@${result.author}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0">
                                                    <img
                                                        src={getMediaPath(result.authorImage)}
                                                        alt={result.author}
                                                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-gray-900 hover:text-black transition-colors truncate text-sm">
                                                            {result.author}
                                                        </div>
                                                    </div>
                                                </a>
                                                <div className="text-right flex-shrink-0">
                                                    <div className="text-xs text-gray-500">{result.createdDate}</div>
                                                    {result.readTime > 0 && (
                                                        <div className="text-xs text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                                                            <i className="far fa-clock text-xs" />
                                                            <span>{result.readTime}분</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 포스트 제목 */}
                                            <h3 className="text-base font-semibold text-gray-900 mb-2 hover:text-black transition-colors leading-tight">
                                                <a href={`/@${result.author}/${result.url}`} className="hover:underline decoration-1 underline-offset-2">
                                                    {result.title}
                                                </a>
                                            </h3>

                                            {/* 포스트 설명 */}
                                            {result.description && (
                                                <p className="text-sm text-gray-600 leading-relaxed mb-3 line-clamp-2">
                                                    {result.description}
                                                </p>
                                            )}

                                            {/* 검색 위치 태그 */}
                                            {result.positions.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-gray-100">
                                                    {result.positions.map((position, idx) => (
                                                        <span
                                                            key={idx}
                                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${getPositionColor(position)}`}>
                                                            <span className="text-xs">{getPositionEmoji(position)}</span>
                                                            <span>{position}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <i className="fas fa-search text-2xl text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">검색 결과가 없습니다</h3>
                                <p className="text-sm text-gray-600">다른 검색어로 다시 시도해보세요.</p>
                            </div>
                        )}

                        {/* 페이지네이션 */}
                        {searchResults.lastPage > 1 && (
                            <div className="mt-6 flex justify-center">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handlePageChange(page - 1)}
                                        disabled={page === 1}
                                        className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium">
                                        이전
                                    </button>

                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, searchResults.lastPage) }, (_, i) => {
                                            let pageNum: number;
                                            if (searchResults.lastPage <= 5) {
                                                pageNum = i + 1;
                                            } else if (page <= 3) {
                                                pageNum = i + 1;
                                            } else if (page >= searchResults.lastPage - 2) {
                                                pageNum = searchResults.lastPage - 4 + i;
                                            } else {
                                                pageNum = page - 2 + i;
                                            }

                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => handlePageChange(pageNum)}
                                                    className={`px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${pageNum === page
                                                            ? 'bg-gray-900 text-white'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        }`}>
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        onClick={() => handlePageChange(page + 1)}
                                        disabled={page === searchResults.lastPage}
                                        className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium">
                                        다음
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* 검색 전 안내 */}
                {!isLoading && !hasSearched && (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="fas fa-search text-3xl text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">포스트를 검색해보세요</h3>
                        <p className="text-sm text-gray-600">제목, 내용, 태그로 원하는 포스트를 찾을 수 있습니다</p>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default SearchModal;
