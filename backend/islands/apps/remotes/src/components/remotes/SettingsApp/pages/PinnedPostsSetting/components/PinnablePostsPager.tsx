import { Button } from '~/components/shared';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from '@blex/ui/icons';
import type { PinnablePostsPaginationData } from '~/lib/api/settings';

interface PinnablePostsPagerProps {
    pagination: PinnablePostsPaginationData;
    onPageChange: (page: number) => void;
    isLoading?: boolean;
}

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

export const PinnablePostsPager = ({
    pagination,
    onPageChange,
    isLoading = false
}: PinnablePostsPagerProps) => {
    if (pagination.totalCount === 0) {
        return null;
    }

    const currentPage = pagination.page;
    const start = (currentPage - 1) * pagination.limit + 1;
    const end = Math.min(currentPage * pagination.limit, pagination.totalCount);
    const visiblePages = getVisiblePages(currentPage, pagination.lastPage);

    const handlePageMove = (page: number) => {
        if (page < 1 || page > pagination.lastPage || page === currentPage || isLoading) return;
        onPageChange(page);
    };

    return (
        <nav
            className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between"
            aria-label="고정 가능한 포스트 페이지">
            <p className="text-xs text-content-secondary">
                총 {pagination.totalCount}개 중 {start}-{end}개 표시
            </p>
            {pagination.lastPage > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                        density="compact"
                        variant="secondary"
                        size="sm"
                        className="min-h-11! min-w-11 [@media(pointer:fine)]:min-h-9! [@media(pointer:fine)]:min-w-9"
                        disabled={!pagination.hasPrevious || isLoading}
                        onClick={() => handlePageMove(1)}
                        aria-label="첫 페이지">
                        <ChevronsLeft aria-hidden className="h-4 w-4" />
                    </Button>
                    <Button
                        density="compact"
                        variant="secondary"
                        size="sm"
                        className="min-h-11! min-w-11 [@media(pointer:fine)]:min-h-9! [@media(pointer:fine)]:min-w-9"
                        disabled={!pagination.hasPrevious || isLoading}
                        onClick={() => handlePageMove(currentPage - 1)}
                        aria-label="이전 페이지">
                        <ChevronLeft aria-hidden className="h-4 w-4" />
                    </Button>
                    {visiblePages.map(page => (
                        <Button
                            density="compact"
                            key={page}
                            variant={page === currentPage ? 'primary' : 'secondary'}
                            size="sm"
                            className="min-h-11! min-w-11 [@media(pointer:fine)]:min-h-9! [@media(pointer:fine)]:min-w-9"
                            disabled={isLoading}
                            onClick={() => handlePageMove(page)}
                            aria-current={page === currentPage ? 'page' : undefined}>
                            {page}
                        </Button>
                    ))}
                    <Button
                        density="compact"
                        variant="secondary"
                        size="sm"
                        className="min-h-11! min-w-11 [@media(pointer:fine)]:min-h-9! [@media(pointer:fine)]:min-w-9"
                        disabled={!pagination.hasNext || isLoading}
                        onClick={() => handlePageMove(currentPage + 1)}
                        aria-label="다음 페이지">
                        <ChevronRight aria-hidden className="h-4 w-4" />
                    </Button>
                    <Button
                        density="compact"
                        variant="secondary"
                        size="sm"
                        className="min-h-11! min-w-11 [@media(pointer:fine)]:min-h-9! [@media(pointer:fine)]:min-w-9"
                        disabled={!pagination.hasNext || isLoading}
                        onClick={() => handlePageMove(pagination.lastPage)}
                        aria-label="마지막 페이지">
                        <ChevronsRight aria-hidden className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </nav>
    );
};
