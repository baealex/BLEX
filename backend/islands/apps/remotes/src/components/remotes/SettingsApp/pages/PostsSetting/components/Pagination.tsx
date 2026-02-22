interface PaginationProps {
    page: string;
    lastPage: number;
    onPageChange: (page: string) => void;
}

const Pagination = ({ page, lastPage, onPageChange }: PaginationProps) => {
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
        <nav className="pagination-nav" aria-label="Page navigation">
            <div className="pagination-action prev">
                {currentPage > 1 ? (
                    <>
                        <div className="pagination-item">
                            <button
                                type="button"
                                className="pagination-link"
                                onClick={() => handlePageMove(1)}
                                aria-label="First page">
                                <i className="fas fa-angle-double-left" />
                            </button>
                        </div>
                        <div className="pagination-item">
                            <button
                                type="button"
                                className="pagination-link"
                                onClick={() => handlePageMove(currentPage - 1)}
                                aria-label="Previous page">
                                <i className="fas fa-angle-left" />
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="pagination-item pagination-disabled">
                            <span className="pagination-link">
                                <i className="fas fa-angle-double-left" />
                            </span>
                        </div>
                        <div className="pagination-item pagination-disabled">
                            <span className="pagination-link">
                                <i className="fas fa-angle-left" />
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
                                aria-label="Next page">
                                <i className="fas fa-angle-right" />
                            </button>
                        </div>
                        <div className="pagination-item">
                            <button
                                type="button"
                                className="pagination-link"
                                onClick={() => handlePageMove(lastPage)}
                                aria-label="Last page">
                                <i className="fas fa-angle-double-right" />
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="pagination-item pagination-disabled">
                            <span className="pagination-link">
                                <i className="fas fa-angle-right" />
                            </span>
                        </div>
                        <div className="pagination-item pagination-disabled">
                            <span className="pagination-link">
                                <i className="fas fa-angle-double-right" />
                            </span>
                        </div>
                    </>
                )}
            </div>
        </nav>
    );
};

export default Pagination;
