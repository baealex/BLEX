import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Clock, FileText, Trash2 } from '@blex/ui/icons';
import { SettingsEmptyState, SettingsListItem } from '../../../components';
import { Dropdown } from '~/components/shared';
import {
    getSettingsIconClass,
    SETTINGS_LIST_META,
    SETTINGS_LIST_TITLE
} from '~/styles/settingsStyles';
import { useConfirm } from '~/hooks/useConfirm';
import { getDraftPosts } from '~/lib/api/settings';
import { deleteDraft } from '~/lib/api/posts';
import { getMediaPath } from '~/modules/static.module';
import { toast } from '~/utils/toast';

interface DraftPostListContentProps {
    onCountChange?: (count: number) => void;
    emptyAction?: ReactNode;
}

export const DraftPostListContent = ({
    onCountChange,
    emptyAction
}: DraftPostListContentProps) => {
    const { confirm } = useConfirm();
    const { data: draftPosts, refetch } = useSuspenseQuery({
        queryKey: ['draft-posts'],
        queryFn: async () => {
            const { data } = await getDraftPosts();
            if (data.status === 'DONE') {
                return data.body.drafts;
            }
            throw new Error('임시 포스트 목록을 불러오는데 실패했습니다.');
        }
    });

    useEffect(() => {
        onCountChange?.(draftPosts?.length ?? 0);
    }, [draftPosts?.length, onCountChange]);

    const handleDraftDelete = async (url: string) => {
        const confirmed = await confirm({
            title: '임시 포스트를 휴지통으로 이동',
            message: '이 임시 포스트를 휴지통으로 옮길까요? 나중에 복원할 수 있습니다.',
            confirmText: '휴지통으로 이동',
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deleteDraft(url);

            if (data.status === 'DONE') {
                toast.success('임시 포스트를 휴지통으로 옮겼습니다.');
                refetch();
            } else {
                throw new Error('Failed to delete draft post');
            }
        } catch {
            toast.error('임시 포스트를 휴지통으로 옮기지 못했습니다.');
        }
    };

    const handleContinueDraft = (url: string) => {
        window.location.assign(`/write?draft=${url}`);
    };

    if (!draftPosts || draftPosts.length === 0) {
        return (
            <SettingsEmptyState
                icon={<FileText aria-hidden className="h-5 w-5" />}
                title="임시 포스트가 없습니다"
                action={emptyAction}
            />
        );
    }

    return (
        <div className="space-y-3">
            {draftPosts.map((draftPost) => (
                <SettingsListItem
                    key={draftPost.url}
                    onClick={() => handleContinueDraft(draftPost.url)}
                    left={
                        draftPost.image ? (
                            <div className={`${getSettingsIconClass('default')} overflow-hidden`}>
                                <img
                                    src={getMediaPath(draftPost.image)}
                                    alt={draftPost.title || '제목 없음'}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        ) : (
                            <div className={getSettingsIconClass('default')}>
                                <FileText aria-hidden className="h-4 w-4" />
                            </div>
                        )
                    }
                    actions={
                        <Dropdown
                            triggerAriaLabel={`${draftPost.title || '제목 없음'} 임시 포스트 메뉴 열기`}
                            triggerClassName="min-h-11 min-w-11"
                            items={[
                                {
                                    label: '휴지통으로 이동',
                                    icon: <Trash2 aria-hidden className="h-4 w-4" />,
                                    onClick: () => handleDraftDelete(draftPost.url),
                                    variant: 'danger'
                                }
                            ]}
                        />
                    }>
                    <h3 className={`${SETTINGS_LIST_TITLE} mb-0.5`}>
                        {draftPost.title || '제목 없음'}
                    </h3>
                    <div className={`${SETTINGS_LIST_META} flex flex-wrap items-center gap-3`}>
                        <span className="flex items-center">
                            <Clock aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                            마지막 수정 {draftPost.updatedDate}
                        </span>
                        <span className="bg-surface-subtle text-content px-2 py-0.5 rounded-md text-xs font-medium">
                            임시 포스트
                        </span>
                    </div>
                </SettingsListItem>
            ))}
        </div>
    );
};
