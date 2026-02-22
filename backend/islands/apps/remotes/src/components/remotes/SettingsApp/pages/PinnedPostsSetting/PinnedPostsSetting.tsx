import { useState, useEffect } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { SettingsHeader } from '../../components';
import { Button } from '~/components/shared';
import { toast } from '~/utils/toast';
import {
    getPinnedPosts,
    getPinnablePosts,
    addPinnedPost,
    removePinnedPost,
    updatePinnedPostsOrder,
    type PinnedPostData,
    type PinnablePostData
} from '~/lib/api/settings';
import { PinnedPostList } from './components/PinnedPostList';
import { AddPinnedPostModal } from './components/AddPinnedPostModal';

const PinnedPostsSetting = () => {
    const queryClient = useQueryClient();
    const [pinnedPosts, setPinnedPosts] = useState<PinnedPostData[]>([]);
    const [pinnablePosts, setPinnablePosts] = useState<PinnablePostData[]>([]);
    const [username, setUsername] = useState<string>('');
    const [maxCount, setMaxCount] = useState<number>(6);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAddingPost, setIsAddingPost] = useState(false);

    const { data: pinnedPostsData } = useSuspenseQuery({
        queryKey: ['pinned-posts-setting'],
        queryFn: async () => {
            const { data } = await getPinnedPosts();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('고정 글 목록을 불러오는데 실패했습니다.');
        }
    });

    useEffect(() => {
        if (pinnedPostsData) {
            setPinnedPosts(pinnedPostsData.pinnedPosts);
            setUsername(pinnedPostsData.username);
            setMaxCount(pinnedPostsData.maxCount);
        }
    }, [pinnedPostsData]);

    const fetchPinnablePosts = async () => {
        try {
            const { data } = await getPinnablePosts();
            if (data.status === 'DONE') {
                setPinnablePosts(data.body.posts);
            }
        } catch {
            toast.error('글 목록을 불러오는데 실패했습니다.');
        }
    };

    const handleOpenModal = async () => {
        await fetchPinnablePosts();
        setIsModalOpen(true);
    };

    const handleReorder = async (newPinnedPosts: PinnedPostData[]) => {
        setPinnedPosts(newPinnedPosts);

        try {
            const postUrls = newPinnedPosts.map((item) => item.post.url);
            const { data } = await updatePinnedPostsOrder(postUrls);

            if (data.status !== 'DONE') {
                throw new Error('Order update failed');
            }

            toast.success('순서가 변경되었습니다.');
        } catch {
            setPinnedPosts(pinnedPosts);
            toast.error('순서 변경에 실패했습니다.');
        }
    };

    const handleAddPinnedPost = async (postUrl: string) => {
        setIsAddingPost(true);
        try {
            const { data } = await addPinnedPost(postUrl);

            if (data.status === 'DONE') {
                // Refresh the data
                queryClient.invalidateQueries({ queryKey: ['pinned-posts-setting'] });
                setIsModalOpen(false);
                toast.success('글이 고정되었습니다.');
            } else {
                throw new Error(data.errorMessage || '글 고정에 실패했습니다.');
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '글 고정에 실패했습니다.');
        } finally {
            setIsAddingPost(false);
        }
    };

    const handleRemovePinnedPost = async (postUrl: string) => {
        try {
            const { data } = await removePinnedPost(postUrl);

            if (data.status === 'DONE') {
                setPinnedPosts(pinnedPosts.filter(p => p.post.url !== postUrl));
                toast.success('고정이 해제되었습니다.');
            } else {
                throw new Error('고정 해제에 실패했습니다.');
            }
        } catch {
            toast.error('고정 해제에 실패했습니다.');
        }
    };

    const canAddMore = pinnedPosts.length < maxCount;

    return (
        <div>
            <SettingsHeader
                title={`고정 글 (${pinnedPosts.length}/${maxCount})`}
                description="프로필에 표시할 대표 글을 선택하세요. 드래그하여 순서를 조정할 수 있습니다."
                actionPosition="right"
                action={
                    <Button
                        variant="primary"
                        size="md"
                        className="w-full sm:w-auto"
                        onClick={handleOpenModal}
                        disabled={!canAddMore}>
                        {canAddMore ? '글 고정하기' : '최대 개수 도달'}
                    </Button>
                }
            />

            <PinnedPostList
                pinnedPosts={pinnedPosts}
                username={username}
                onReorder={handleReorder}
                onRemove={handleRemovePinnedPost}
                maxCount={maxCount}
            />

            <AddPinnedPostModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                pinnablePosts={pinnablePosts}
                onAdd={handleAddPinnedPost}
                isLoading={isAddingPost}
            />
        </div>
    );
};

export default PinnedPostsSetting;
