
import { toast } from '~/utils/toast';
import { useSuspenseQuery } from '@tanstack/react-query';
import { SettingsHeader } from '../../components';
import { Button, Dropdown } from '~/components/shared';
import {
    getCardClass,
    getIconClass,
    CARD_PADDING,
    FLEX_ROW,
    TITLE,
    SUBTITLE,
    ACTIONS_CONTAINER
} from '~/components/shared';
import { useConfirm } from '~/hooks/useConfirm';
import { getTempPosts, deleteTempPost } from '~/lib/api/settings';

const TempPostsSetting = () => {
    const { confirm } = useConfirm();
    const { data: tempPosts, refetch } = useSuspenseQuery({
        queryKey: ['temp-posts'],
        queryFn: async () => {
            const { data } = await getTempPosts();
            if (data.status === 'DONE') {
                return data.body.temps;
            }
            throw new Error('임시저장 포스트 목록을 불러오는데 실패했습니다.');
        }
    });

    const handleTempPostDelete = async (token: string) => {
        const confirmed = await confirm({
            title: '임시글 삭제',
            message: '정말 이 임시저장 포스트를 삭제할까요?',
            confirmText: '삭제',
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deleteTempPost(token);

            if (data.status === 'DONE') {
                toast.success('임시저장 포스트가 삭제되었습니다.');
                refetch();
            } else {
                throw new Error('Failed to delete temp post');
            }
        } catch {
            toast.error('임시저장 포스트 삭제에 실패했습니다.');
        }
    };

    return (
        <div>
            <SettingsHeader
                title="임시저장"
                description={`총 ${tempPosts?.length || 0}개의 임시저장 포스트가 있습니다.`}
                action={
                    <Button
                        variant="primary"
                        size="md"
                        fullWidth
                        leftIcon={<i className="fas fa-plus" />}
                        onClick={() => window.location.assign('/write')}>
                        새 포스트 작성
                    </Button>
                }
            />

            {tempPosts && tempPosts.length > 0 && (
                <div className="space-y-3">
                    {[...tempPosts].reverse().map((tempPost) => (
                        <div
                            key={tempPost.token}
                            className={getCardClass('cursor-pointer')}
                            onClick={() => window.location.assign(`/write?tempToken=${tempPost.token}`)}>
                            <div className={CARD_PADDING}>
                                <div className={FLEX_ROW}>
                                    {/* Icon */}
                                    <div className={getIconClass('default')}>
                                        <i className="fas fa-file-alt text-sm" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`${TITLE} mb-0.5`}>
                                            {tempPost.title || '제목 없음'}
                                        </h3>
                                        <div className={`${SUBTITLE} flex items-center gap-3`}>
                                            <span className="flex items-center">
                                                <i className="fas fa-clock mr-1.5" />
                                                {tempPost.createdDate}
                                            </span>
                                            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md text-xs font-medium">
                                                임시저장
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className={ACTIONS_CONTAINER} onClick={(e) => e.stopPropagation()}>
                                        <Dropdown
                                            items={[
                                                {
                                                    label: '삭제',
                                                    icon: 'fas fa-trash',
                                                    onClick: () => handleTempPostDelete(tempPost.token),
                                                    variant: 'danger'
                                                }
                                            ]}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TempPostsSetting;
