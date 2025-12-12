import React, { useState, useEffect, useCallback } from 'react';
import { getMediaPath } from '~/modules/static.module';
import Modal from '~/components/shared/Modal';
import { searchPosts, type SearchResult } from '~/lib/api';

interface SearchModalProps {
    isOpen?: boolean;
}

interface SearchResultsData {
    results: SearchResult[];
    lastPage: number;
    query?: string;
    totalSize?: number;
    elapsedTime?: number;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen: initialIsOpen = false }) => {
    const [isOpen, setIsOpen] = useState(initialIsOpen);
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResultsData | null>(null);
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
            const { data } = await searchPosts(searchQuery, pageNum);

            if (data.status === 'DONE') {
                setSearchResults({
                    results: data.body.results || [],
                    lastPage: data.body.lastPage || 1,
                    query: searchQuery,
                    totalSize: data.body.totalSize,
                    elapsedTime: data.body.elapsedTime
                });
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
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 rounded-t-3xl z-10">
                <div className="flex items-center justify-between px-6 py-5">
                    <div className="flex items-center gap-3 text-gray-900">
                        <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                            <i className="fas fa-search text-white text-sm" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight">포스트 검색</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200">
                        <i className="fas fa-times text-lg" />
                    </button>
                </div>

                {/* 검색 폼 */}
                <div className="px-6 pb-6">
                    <form onSubmit={handleSubmit} className="relative">
                        <div className="relative group">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="검색어를 입력하세요..."
                                maxLength={20}
                                className="w-full px-5 py-4 pr-24 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black transition-all text-gray-900 placeholder-gray-400 text-base bg-gray-50/50 focus:bg-white"
                                autoComplete="off"
                                autoFocus
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                {query && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setQuery('');
                                            setSearchResults(null);
                                            setHasSearched(false);
                                        }}
                                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100">
                                        <i className="fas fa-times text-xs" />
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={!query.trim() || isLoading}
                                    className="bg-black hover:bg-gray-800 text-white px-5 py-2 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95">
                                    {isLoading ? '검색 중...' : '검색'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {/* 검색 결과 */}
            <div className="px-6 py-6 min-h-[400px]">
                <div id="search-results-top" />

                {isLoading && (
                    <div className="flex items-center justify-center h-64">
                        <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100 border-t-black" />
                            <span className="text-sm font-medium text-gray-500">열심히 찾는 중...</span>
                        </div>
                    </div>
                )}

                {!isLoading && searchResults && (
                    <>
                        {/* 검색 결과 정보 */}
                        <div className="mb-8">
                            <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100">
                                            <span className="text-lg">🔍</span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-lg">
                                                <strong className="text-black">{searchResults.totalSize}</strong>개의 포스트
                                            </h3>
                                            <p className="text-sm text-gray-500 font-medium">"{searchResults.query}" 검색 결과</p>
                                        </div>
                                    </div>
                                    <div className="text-right bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Time</div>
                                        <div className="text-sm font-semibold text-gray-900">{searchResults.elapsedTime}s</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 포스트 목록 */}
                        {searchResults.results && searchResults.results.length > 0 ? (
                            <div className="space-y-4">
                                {searchResults.results.map((result: SearchResult, index: number) => (
                                    <article key={index} className="group bg-white rounded-2xl border border-gray-100 hover:border-gray-300 hover:shadow-lg transition-all duration-300 overflow-hidden hover:-translate-y-0.5">
                                        <div className="p-6">
                                            {/* 작성자 정보 */}
                                            <div className="flex items-start justify-between mb-4 gap-4">
                                                <a href={`/@${result.author}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0">
                                                    <img
                                                        src={getMediaPath(result.authorImage)}
                                                        alt={result.author}
                                                        className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-50"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-gray-900 hover:text-black transition-colors truncate text-sm">
                                                            {result.author}
                                                        </div>
                                                        <div className="text-xs text-gray-400 font-medium">{result.createdDate}</div>
                                                    </div>
                                                </a>
                                                {result.readTime && result.readTime > 0 && (
                                                    <div className="text-xs font-medium text-gray-400 flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                                                        <i className="far fa-clock" />
                                                        <span>{result.readTime}분</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 포스트 제목 */}
                                            <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-black transition-colors leading-snug">
                                                <a href={`/@${result.author}/${result.url}`} className="block">
                                                    {result.title}
                                                </a>
                                            </h3>

                                            {/* 포스트 설명 */}
                                            {result.description && (
                                                <p className="text-sm text-gray-500 leading-relaxed mb-4 line-clamp-2 font-medium">
                                                    {result.description}
                                                </p>
                                            )}

                                            {/* 검색 위치 태그 */}
                                            {result.positions && result.positions.length > 0 && (
                                                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
                                                    {result.positions.map((position: string, idx: number) => (
                                                        <span
                                                            key={idx}
                                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                                                position === '제목' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            <span>{getPositionEmoji(position)}</span>
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
                            <div className="text-center py-20">
                                <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                                    <i className="fas fa-search text-3xl text-gray-300" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">검색 결과가 없습니다</h3>
                                <p className="text-gray-500">다른 검색어로 다시 시도해보세요.</p>
                            </div>
                        )}

                        {/* 페이지네이션 */}
                        {searchResults.lastPage > 1 && (
                            <div className="mt-8 flex justify-center pb-4">
                                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                                    <button
                                        onClick={() => handlePageChange(page - 1)}
                                        disabled={page === 1}
                                        className="px-4 py-2 rounded-lg bg-white text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:shadow-none disabled:bg-transparent disabled:text-gray-400 transition-all text-sm font-medium">
                                        이전
                                    </button>

                                    <div className="flex items-center gap-1 px-2">
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
                                                    className={`w-8 h-8 rounded-lg transition-all text-sm font-bold ${pageNum === page
                                                        ? 'bg-black text-white shadow-md transform scale-110'
                                                        : 'text-gray-500 hover:bg-gray-200/50'
                                                        }`}>
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        onClick={() => handlePageChange(page + 1)}
                                        disabled={page === searchResults.lastPage}
                                        className="px-4 py-2 rounded-lg bg-white text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:shadow-none disabled:bg-transparent disabled:text-gray-400 transition-all text-sm font-medium">
                                        다음
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* 검색 전 안내 */}
                {!isLoading && !hasSearched && (
                    <div className="text-center py-24">
                        <div className="w-24 h-24 bg-gradient-to-br from-gray-50 to-gray-100 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                            <i className="fas fa-search text-4xl text-gray-300" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">무엇을 찾고 계신가요?</h3>
                        <p className="text-gray-500 font-medium">제목, 내용, 태그로 원하는 포스트를 검색해보세요</p>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default SearchModal;
