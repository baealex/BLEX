import { useEffect } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Clock, FileText, RotateCcw, Trash2 } from '@blex/ui/icons';
import { Dropdown } from '~/components/shared';
import { useConfirm } from '~/hooks/useConfirm';
import {
    getTrashedPosts,
    permanentlyDeleteTrashedPost,
    restoreTrashedPost,
    type TrashedPost
} from '~/lib/api/posts';
import { getMediaPath } from '~/modules/static.module';
import {
    getSettingsIconClass,
    SETTINGS_LIST_META,
    SETTINGS_LIST_TITLE
} from '~/styles/settingsStyles';
import { toast } from '~/utils/toast';
import { SettingsEmptyState, SettingsListItem } from '../../../components';
import Pagination from './Pagination';

interface TrashPostListContentProps {
    page: string;
    onPageChange: (page: string) => void;
    onCountChange?: (count: number) => void;
}

const sourceStatusLabels = {
    draft: '임시 포스트',
    scheduled: '예약 포스트',
    published: '발행 포스트'
} as const;

const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
};

const getRestoreMessage = (post: TrashedPost) => {
    if (post.scheduleElapsed) {
        return '예약 시각이 지나 복원하면 발행 상태가 됩니다. 기존 비공개 설정은 그대로 유지됩니다.';
    }
    return `${sourceStatusLabels[post.sourceStatus]}로 복원합니다. URL과 발행·비공개 설정은 삭제 전 상태를 유지합니다.`;
};

export const TrashPostListContent = ({
    page,
    onPageChange,
    onCountChange
}: TrashPostListContentProps) => {
    const { confirm } = useConfirm();
    const normalizedPage = Number.parseInt(page, 10) || 1;
    const { data: trashData, refetch } = useSuspenseQuery({
        queryKey: ['trash-posts', normalizedPage],
        queryFn: async () => {
            const { data } = await getTrashedPosts(normalizedPage);
            if (data.status === 'DONE') return data.body;
            throw new Error(data.errorMessage || '휴지통을 불러오지 못했습니다.');
        }
    });

    useEffect(() => {
        onCountChange?.(trashData.pagination.totalCount);
    }, [onCountChange, trashData.pagination.totalCount]);

    const refreshAfterRemoval = () => {
        if (trashData.posts.length === 1 && normalizedPage > 1) {
            onPageChange(String(normalizedPage - 1));
            return;
        }
        void refetch();
    };

    const handleRestore = async (post: TrashedPost) => {
        const confirmed = await confirm({
            title: '포스트 복원',
            message: getRestoreMessage(post),
            confirmText: '복원'
        });
        if (!confirmed) return;

        try {
            const { data } = await restoreTrashedPost(post.url, post.deletedDate);
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || '포스트를 복원하지 못했습니다.');
                return;
            }
            toast.success(`${sourceStatusLabels[data.body.status]}로 복원했습니다.`);
            refreshAfterRemoval();
        } catch {
            toast.error('포스트를 복원하지 못했습니다.');
        }
    };

    const handlePermanentDelete = async (post: TrashedPost) => {
        const confirmed = await confirm({
            title: '포스트 영구 삭제',
            message: `‘${post.title || '제목 없음'}’ 포스트와 관련 데이터를 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다.`,
            confirmText: '영구 삭제',
            variant: 'danger'
        });
        if (!confirmed) return;

        try {
            const { data } = await permanentlyDeleteTrashedPost(
                post.url,
                post.deletedDate
            );
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || '포스트를 영구 삭제하지 못했습니다.');
                return;
            }
            toast.success('포스트를 영구 삭제했습니다.');
            refreshAfterRemoval();
        } catch {
            toast.error('포스트를 영구 삭제하지 못했습니다.');
        }
    };

    if (trashData.posts.length === 0) {
        return (
            <SettingsEmptyState
                icon={<Trash2 aria-hidden className="h-5 w-5" />}
                title="휴지통이 비어 있습니다"
            />
        );
    }

    return (
        <>
            <p className="mb-4 text-sm text-content-secondary">
                휴지통의 포스트는 자동 삭제되지 않습니다.
            </p>
            <div className="space-y-3">
                {trashData.posts.map(post => (
                    <SettingsListItem
                        key={`${post.url}-${post.deletedDate}`}
                        left={post.image ? (
                            <div className={`${getSettingsIconClass('default')} overflow-hidden`}>
                                <img
                                    src={getMediaPath(post.image)}
                                    alt={post.title || '제목 없음'}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        ) : (
                            <div className={getSettingsIconClass('default')}>
                                <FileText aria-hidden className="h-4 w-4" />
                            </div>
                        )}
                        actions={(
                            <Dropdown
                                density="compact"
                                triggerAriaLabel={`${post.title || '제목 없음'} 휴지통 메뉴 열기`}
                                triggerClassName="min-h-11 min-w-11 [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
                                items={[
                                    {
                                        label: '복원',
                                        icon: <RotateCcw aria-hidden className="h-4 w-4" />,
                                        onClick: () => void handleRestore(post)
                                    },
                                    {
                                        label: '영구 삭제',
                                        icon: <Trash2 aria-hidden className="h-4 w-4" />,
                                        onClick: () => void handlePermanentDelete(post),
                                        variant: 'danger'
                                    }
                                ]}
                            />
                        )}>
                        <h3 className={`${SETTINGS_LIST_TITLE} mb-0.5`}>
                            {post.title || '제목 없음'}
                        </h3>
                        <div className={`${SETTINGS_LIST_META} flex flex-wrap items-center gap-3`}>
                            <span className="flex items-center">
                                <Clock aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                                {formatDateTime(post.deletedDate)} 이동
                            </span>
                            <span className="rounded-md bg-surface-subtle px-2 py-0.5 text-xs font-medium text-content">
                                {sourceStatusLabels[post.sourceStatus]}
                            </span>
                            {post.isHide && (
                                <span className="rounded-md bg-surface-subtle px-2 py-0.5 text-xs font-medium text-content">
                                    비공개
                                </span>
                            )}
                            {post.scheduleElapsed && (
                                <span className="text-warning">예약 시각 경과</span>
                            )}
                        </div>
                    </SettingsListItem>
                ))}
            </div>
            <Pagination
                page={String(trashData.pagination.page)}
                lastPage={trashData.pagination.lastPage}
                onPageChange={onPageChange}
            />
        </>
    );
};
