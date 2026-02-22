
import { toast } from '~/utils/toast';
import { useSuspenseQuery } from '@tanstack/react-query';
import { SettingsEmptyState, SettingsHeader, SettingsListItem } from '../../components';
import { Button, Dropdown } from '~/components/shared';
import {
    getIconClass,
    TITLE,
    SUBTITLE
} from '~/components/shared';
import { useConfirm } from '~/hooks/useConfirm';
import { getDraftPosts } from '~/lib/api/settings';
import { deleteDraft } from '~/lib/api/posts';

const DraftsSetting = () => {
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

    return (
        <div>
            <SettingsHeader
                title="임시 포스트"
                description={`총 ${draftPosts?.length || 0}개의 임시 포스트가 있습니다.`}
                actionPosition="right"
                action={
                    <Button
                        variant="primary"
                        size="md"
                        className="w-full sm:w-auto"
                        onClick={() => window.location.assign('/write')}>
                        새 포스트 작성
                    </Button>
                }
            />

            {draftPosts && draftPosts.length > 0 ? (
                <div className="space-y-3">
                    {[...draftPosts].reverse().map((draftPost) => (
                        <SettingsListItem
                            key={draftPost.url}
                            left={
                                <div className={getIconClass('default')}>
                                    <i className="fas fa-file-alt text-sm" />
                                </div>
                            }
                            actions={
                                <Dropdown
                                    items={[
                                        {
                                            label: '이어서 작성',
                                            icon: 'fas fa-pen',
                                            onClick: () => handleContinueDraft(draftPost.url)
                                        },
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
                            <div className={`${SUBTITLE} flex items-center gap-3`}>
                                <span className="flex items-center">
                                    <i className="fas fa-clock mr-1.5" />
                                    {draftPost.createdDate}
                                </span>
                                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md text-xs font-medium">
                                    임시 포스트
                                </span>
                            </div>
                        </SettingsListItem>
                    ))}
                </div>
            ) : (
                <SettingsEmptyState
                    iconClassName="fas fa-file-alt"
                    title="임시 포스트가 없습니다"
                    description="새 포스트를 작성해보세요."
                />
            )}
        </div>
    );
};

export default DraftsSetting;
