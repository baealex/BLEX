import { useEffect } from 'react';
import { notification } from '@baejino/ui';
import { useQuery } from '@tanstack/react-query';
import { Button, Dropdown } from '~/components/shared';
import {
    getCardClass,
    getIconClass,
    CARD_PADDING,
    FLEX_ROW,
    TITLE,
    SUBTITLE,
    ACTIONS_CONTAINER
} from '~/components/shared/settingsStyles';
import { useConfirm } from '~/contexts/ConfirmContext';
import { getTempPosts, deleteTempPost } from '~/lib/api/settings';

const TempPostsSetting = () => {
    const { confirm } = useConfirm();
    const { data: tempPosts, isLoading, isError, refetch } = useQuery({
        queryKey: ['temp-posts'],
        queryFn: async () => {
            const { data } = await getTempPosts();
            if (data.status === 'DONE') {
                return data.body.temps;
            }
            throw new Error('임시저장 포스트 목록을 불러오는데 실패했습니다.');
        }
    });

    useEffect(() => {
        if (isError) {
            notification('임시저장 포스트 목록을 불러오는데 실패했습니다.', { type: 'error' });
        }
    }, [isError]);

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
                notification('임시저장 포스트가 삭제되었습니다.', { type: 'success' });
                refetch();
            } else {
                throw new Error('Failed to delete temp post');
            }
        } catch {
            notification('임시저장 포스트 삭제에 실패했습니다.', { type: 'error' });
        }
    };

    if (isLoading) {
        return null;
    }

    return (
        <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
            {/* 헤더 섹션 */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">임시저장</h2>
                <p className="text-gray-600">총 {tempPosts?.length || 0}개의 임시저장 포스트가 있습니다.</p>
            </div>

            <div>
                {(!tempPosts || tempPosts.length === 0) ? (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                            <i className="fas fa-save text-gray-400 text-3xl" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">임시저장 포스트가 없습니다</h3>
                        <p className="text-gray-500 mb-6">포스트 작성 중 임시저장하면 여기에 표시됩니다.</p>
                        <Button
                            variant="primary"
                            size="md"
                            leftIcon={<i className="fas fa-plus" />}
                            onClick={() => window.location.href = '/write'}>
                            첫 포스트 작성하기
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {[...tempPosts].reverse().map((tempPost) => (
                            <div
                                key={tempPost.token}
                                className={getCardClass('cursor-pointer')}
                                onClick={() => window.location.href = `/write?tempToken=${tempPost.token}`}>
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
        </div>
    );
};

export default TempPostsSetting;
