import { useSuspenseQuery } from '@tanstack/react-query';
import { SettingsEmptyState, SettingsListItem } from '../../../components';
import { Dropdown, getIconClass, SUBTITLE, TITLE } from '~/components/shared';
import { useConfirm } from '~/hooks/useConfirm';
import { getDraftPosts } from '~/lib/api/settings';
import { deleteDraft } from '~/lib/api/posts';
import { getMediaPath } from '~/modules/static.module';
import { toast } from '~/utils/toast';

export const DraftPostListContent = () => {
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

    const handleDraftDelete = async (url: string) => {
        const confirmed = await confirm({
            title: '임시 포스트 삭제',
            message: '정말 이 임시 포스트를 삭제할까요?',
            confirmText: '삭제',
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deleteDraft(url);

            if (data.status === 'DONE') {
                toast.success('임시 포스트가 삭제되었습니다.');
                refetch();
            } else {
                throw new Error('Failed to delete draft post');
            }
        } catch {
            toast.error('임시 포스트 삭제에 실패했습니다.');
        }
    };

    const handleContinueDraft = (url: string) => {
        window.location.assign(`/write?draft=${url}`);
    };

    if (!draftPosts || draftPosts.length === 0) {
        return (
            <SettingsEmptyState
                iconClassName="fas fa-file-alt"
                title="임시 포스트가 없습니다"
                description="새 포스트를 작성해보세요."
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
                            <div className={`${getIconClass('default')} overflow-hidden`}>
                                <img
                                    src={getMediaPath(draftPost.image)}
                                    alt={draftPost.title || '제목 없음'}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        ) : (
                            <div className={getIconClass('default')}>
                                <i className="fas fa-file-alt text-sm" />
                            </div>
                        )
                    }
                    actions={
                        <Dropdown
                            items={[
                                {
                                    label: '삭제',
                                    icon: 'fas fa-trash',
                                    onClick: () => handleDraftDelete(draftPost.url),
                                    variant: 'danger'
                                }
                            ]}
                        />
                    }>
                    <h3 className={`${TITLE} mb-0.5`}>
                        {draftPost.title || '제목 없음'}
                    </h3>
                    <div className={`${SUBTITLE} flex flex-wrap items-center gap-3`}>
                        <span className="flex items-center">
                            <i className="fas fa-clock mr-1.5" />
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
