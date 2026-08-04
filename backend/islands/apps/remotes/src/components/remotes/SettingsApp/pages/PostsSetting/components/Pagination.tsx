import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from '@blex/ui/icons';
import { useLingui } from '@lingui/react/macro';

interface PaginationProps {
    page: string;
    lastPage: number;
    onPageChange: (page: string) => void;
}

const Pagination = ({ page, lastPage, onPageChange }: PaginationProps) => {
    const { t } = useLingui();
    const currentPage = Number.parseInt(page, 10) || 1;

    if (lastPage <= 1) return null;

    const getVisiblePages = () => {
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

    const visiblePages = getVisiblePages();

    const handlePageMove = (targetPage: number) => {
        if (targetPage < 1 || targetPage > lastPage || targetPage === currentPage) return;
        onPageChange(String(targetPage));
    };

    return (
        <nav
            className="pagination-nav [&_.pagination-link]:min-h-11 [&_.pagination-link]:min-w-11 [@media(pointer:fine)]:[&_.pagination-link]:min-h-9 [@media(pointer:fine)]:[&_.pagination-link]:min-w-9"
            aria-label={t({
                id: 'settings.posts.pagination.aria',
                message: 'Post pages'
            })}>
            <div className="pagination-action prev">
                {currentPage > 1 ? (
                    <>
                        <div className="pagination-item">
                            <button
                                type="button"
                                className="pagination-link"
                                onClick={() => handlePageMove(1)}
                                aria-label={t({
                                    id: 'common.pagination.first',
                                    message: 'First page'
                                })}>
                                <ChevronsLeft aria-hidden className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="pagination-item">
                            <button
                                type="button"
                                className="pagination-link"
                                onClick={() => handlePageMove(currentPage - 1)}
                                aria-label={t({
                                    id: 'common.pagination.previous',
                                    message: 'Previous page'
                                })}>
                                <ChevronLeft aria-hidden className="h-4 w-4" />
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="pagination-item pagination-disabled">
                            <span className="pagination-link">
                                <ChevronsLeft aria-hidden className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="pagination-item pagination-disabled">
                            <span className="pagination-link">
                                <ChevronLeft aria-hidden className="h-4 w-4" />
                            </span>
                        </div>
                    </>
                )}
            </div>

            <div className="pagination-pages">
                {visiblePages.map((pageNumber) => (
                    pageNumber === currentPage ? (
                        <div key={pageNumber} className="pagination-item pagination-active">
                            <span className="pagination-link" aria-current="page">{pageNumber}</span>
                        </div>
                    ) : (
                        <div key={pageNumber} className="pagination-item">
                            <button
                                type="button"
                                className="pagination-link"
                                onClick={() => handlePageMove(pageNumber)}>
                                {pageNumber}
                            </button>
                        </div>
                    )
                ))}
            </div>

            <div className="pagination-action next">
                {currentPage < lastPage ? (
                    <>
                        <div className="pagination-item">
                            <button
                                type="button"
                                className="pagination-link"
                                onClick={() => handlePageMove(currentPage + 1)}
                                aria-label={t({
                                    id: 'common.pagination.next',
                                    message: 'Next page'
                                })}>
                                <ChevronRight aria-hidden className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="pagination-item">
                            <button
                                type="button"
                                className="pagination-link"
                                onClick={() => handlePageMove(lastPage)}
                                aria-label={t({
                                    id: 'common.pagination.last',
                                    message: 'Last page'
                                })}>
                                <ChevronsRight aria-hidden className="h-4 w-4" />
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="pagination-item pagination-disabled">
                            <span className="pagination-link">
                                <ChevronRight aria-hidden className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="pagination-item pagination-disabled">
                            <span className="pagination-link">
                                <ChevronsRight aria-hidden className="h-4 w-4" />
                            </span>
                        </div>
                    </>
                )}
            </div>
        </nav>
    );
};

export default Pagination;
