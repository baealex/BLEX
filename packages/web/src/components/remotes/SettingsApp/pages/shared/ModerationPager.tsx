import { useEffect, useRef } from 'react';
import { useLingui } from '@lingui/react/macro';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight
} from '@blex/ui/icons';
import { Button } from '~/components/shared';
import type { ManagedUsersPagination } from '~/lib/api/settings';

interface ModerationPagerProps {
    pagination: ManagedUsersPagination;
    onPageChange: (page: number) => void;
}

/** Returns to the top of the list once the requested page has actually rendered. */
export const usePageScroll = (isSettled: boolean, rows: unknown) => {
    const listRef = useRef<HTMLDivElement>(null);
    const isPendingRef = useRef(false);

    useEffect(() => {
        if (!isPendingRef.current || !isSettled) return;
        isPendingRef.current = false;
        listRef.current?.scrollIntoView({ block: 'start' });
    }, [isSettled, rows]);

    return {
        listRef,
        markPageChange: () => {
            isPendingRef.current = true;
        }
    };
};

const visiblePages = (page: number, lastPage: number) => {
    const start = Math.max(1, Math.min(page - 2, lastPage - 4));
    const end = Math.min(lastPage, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export const ModerationPager = ({ pagination, onPageChange }: ModerationPagerProps) => {
    const { i18n, t } = useLingui();

    if (pagination.totalPages <= 1) return null;

    return (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-content-secondary">
                {i18n._({
                    id: 'settings.moderation.pagination',
                    message: 'Showing {start}–{end} of {total}',
                    values: {
                        start: (pagination.page - 1) * pagination.pageSize + 1,
                        end: Math.min(pagination.page * pagination.pageSize, pagination.total),
                        total: pagination.total
                    }
                })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    density="compact"
                    size="sm"
                    variant="secondary"
                    disabled={!pagination.hasPrevious}
                    onClick={() => onPageChange(1)}
                    aria-label={t({
                        id: 'common.pagination.first',
                        message: 'First page'
                    })}>
                    <ChevronsLeft aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button
                    density="compact"
                    size="sm"
                    variant="secondary"
                    disabled={!pagination.hasPrevious}
                    onClick={() => onPageChange(pagination.page - 1)}
                    aria-label={t({
                        id: 'common.pagination.previous',
                        message: 'Previous page'
                    })}>
                    <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                </Button>
                {visiblePages(pagination.page, pagination.totalPages).map(pageNumber => (
                    <Button
                        key={pageNumber}
                        density="compact"
                        size="sm"
                        variant={pageNumber === pagination.page ? 'primary' : 'secondary'}
                        aria-current={pageNumber === pagination.page ? 'page' : undefined}
                        onClick={() => onPageChange(pageNumber)}>
                        {pageNumber}
                    </Button>
                ))}
                <Button
                    density="compact"
                    size="sm"
                    variant="secondary"
                    disabled={!pagination.hasNext}
                    onClick={() => onPageChange(pagination.page + 1)}
                    aria-label={t({
                        id: 'common.pagination.next',
                        message: 'Next page'
                    })}>
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button
                    density="compact"
                    size="sm"
                    variant="secondary"
                    disabled={!pagination.hasNext}
                    onClick={() => onPageChange(pagination.totalPages)}
                    aria-label={t({
                        id: 'common.pagination.last',
                        message: 'Last page'
                    })}>
                    <ChevronsRight aria-hidden="true" className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};
