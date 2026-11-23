import { Trans, useLingui } from '@lingui/react/macro';
import { ChevronLeft, ChevronRight } from '@blex/ui/icons';
import { Button } from '~/components/shared';
import type { ManagedUsersPagination } from '~/lib/api/settings';

interface ModerationPagerProps {
    pagination: ManagedUsersPagination;
    onPageChange: (page: number) => void;
}

export const ModerationPager = ({ pagination, onPageChange }: ModerationPagerProps) => {
    const { t } = useLingui();

    if (pagination.totalPages <= 1) return null;

    return (
        <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-sm text-content-secondary">
                <Trans id="settings.moderation.pagination">
                    Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
                </Trans>
            </p>
            <div className="flex gap-2">
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
            </div>
        </div>
    );
};
