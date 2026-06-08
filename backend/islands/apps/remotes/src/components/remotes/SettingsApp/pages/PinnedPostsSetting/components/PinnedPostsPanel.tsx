import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { SettingsHeader } from '../../../components';
import { Button } from '~/components/shared';
import { toast } from '~/utils/toast';
import {
    addPinnedPost,
    getPinnablePosts,
    getPinnedPosts,
    removePinnedPost,
    updatePinnedPostsOrder,
    type PinnablePostData,
    type PinnablePostsPaginationData,
    type PinnedPostData
} from '~/lib/api/settings';
import { AddPinnedPostModal } from './AddPinnedPostModal';
import { PinnablePostInlineList } from './PinnablePostInlineList';
import { PinnedPostList } from './PinnedPostList';

interface PinnedPostsPanelProps {
    embedded?: boolean;
    onPinnedPostsChange?: () => void;
}

const PINNABLE_POSTS_PAGE_SIZE = 30;

const DEFAULT_PINNABLE_POSTS_PAGINATION: PinnablePostsPaginationData = {
    page: 1,
    limit: PINNABLE_POSTS_PAGE_SIZE,
    lastPage: 1,
    totalCount: 0,
    hasNext: false,
    hasPrevious: false
};

export const PinnedPostsPanel = ({
    embedded = false,
    onPinnedPostsChange
}: PinnedPostsPanelProps) => {
    const queryClient = useQueryClient();
    const { data: pinnedPostsData } = useSuspenseQuery({
        queryKey: ['pinned-posts-setting'],
        queryFn: async () => {
            const { data } = await getPinnedPosts();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('고정 포스트 목록을 불러오는데 실패했습니다.');
        }
    });

    const [pinnedPosts, setPinnedPosts] = useState<PinnedPostData[]>(
        pinnedPostsData.pinnedPosts
    );
    const [pinnablePosts, setPinnablePosts] = useState<PinnablePostData[]>([]);
    const [username, setUsername] = useState<string>(pinnedPostsData.username);
    const [maxCount, setMaxCount] = useState<number>(pinnedPostsData.maxCount);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAddingPost, setIsAddingPost] = useState(false);
    const [addingPostUrl, setAddingPostUrl] = useState<string | null>(null);
    const [pinnableSearchQuery, setPinnableSearchQuery] = useState('');
    const [pinnablePage, setPinnablePage] = useState(1);
    const [pinnablePagination, setPinnablePagination] =
        useState<PinnablePostsPaginationData>(DEFAULT_PINNABLE_POSTS_PAGINATION);
    const [isPinnableLoading, setIsPinnableLoading] = useState(embedded);
    const pinnableRequestSeq = useRef(0);

    useEffect(() => {
        if (pinnedPostsData) {
            setPinnedPosts(pinnedPostsData.pinnedPosts);
            setUsername(pinnedPostsData.username);
            setMaxCount(pinnedPostsData.maxCount);
        }
    }, [pinnedPostsData]);

    const fetchPinnablePosts = useCallback(async (query = '', page = 1) => {
        const requestSeq = pinnableRequestSeq.current + 1;
        pinnableRequestSeq.current = requestSeq;
        setIsPinnableLoading(true);
        try {
            const { data } = await getPinnablePosts({
                query,
                limit: PINNABLE_POSTS_PAGE_SIZE,
                page
            });

            if (requestSeq !== pinnableRequestSeq.current) {
                return;
            }

            if (data.status === 'DONE') {
                setPinnablePosts(data.body.posts);
                setPinnablePagination({
                    page: data.body.page,
                    limit: data.body.limit,
                    lastPage: data.body.lastPage,
                    totalCount: data.body.totalCount,
                    hasNext: data.body.hasNext,
                    hasPrevious: data.body.hasPrevious
                });
                setPinnablePage(data.body.page);
            }
        } catch {
            if (requestSeq === pinnableRequestSeq.current) {
                toast.error('포스트 목록을 불러오는데 실패했습니다.');
            }
        } finally {
            if (requestSeq === pinnableRequestSeq.current) {
                setIsPinnableLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (!embedded && !isModalOpen) return;

        const timeoutId = window.setTimeout(
            () => {
                fetchPinnablePosts(pinnableSearchQuery, pinnablePage);
            },
            pinnableSearchQuery ? 250 : 0
        );

        return () => window.clearTimeout(timeoutId);
    }, [embedded, fetchPinnablePosts, isModalOpen, pinnablePage, pinnableSearchQuery]);

    const handlePinnableSearchQueryChange = (query: string) => {
        setPinnableSearchQuery(query);
        setPinnablePage(1);
        setIsPinnableLoading(true);
    };

    const handlePinnablePageChange = (page: number) => {
        setPinnablePage(page);
        setIsPinnableLoading(true);
    };

    const handleOpenModal = () => {
        setPinnableSearchQuery('');
        setPinnablePage(1);
        setPinnablePagination(DEFAULT_PINNABLE_POSTS_PAGINATION);
        setPinnablePosts([]);
        setIsPinnableLoading(true);
        setIsModalOpen(true);
    };

    const handleReorder = async (newPinnedPosts: PinnedPostData[]) => {
        const previousPinnedPosts = pinnedPosts;
        setPinnedPosts(newPinnedPosts);

        try {
            const postUrls = newPinnedPosts.map((item) => item.post.url);
            const { data } = await updatePinnedPostsOrder(postUrls);

            if (data.status !== 'DONE') {
                throw new Error('Order update failed');
            }

            toast.success('순서가 변경되었습니다.');
            await queryClient.invalidateQueries({ queryKey: ['pinned-posts-setting'] });
            onPinnedPostsChange?.();
        } catch {
            setPinnedPosts(previousPinnedPosts);
            toast.error('순서 변경에 실패했습니다.');
        }
    };

    const handleAddPinnedPost = async (postUrl: string) => {
        setIsAddingPost(true);
        setAddingPostUrl(postUrl);
        try {
            const { data } = await addPinnedPost(postUrl);

            if (data.status === 'DONE') {
                await queryClient.invalidateQueries({ queryKey: ['pinned-posts-setting'] });
                pinnableRequestSeq.current += 1;
                setIsModalOpen(false);
                setPinnablePosts((posts) => posts.filter((post) => post.url !== postUrl));
                fetchPinnablePosts(pinnableSearchQuery, pinnablePage);
                toast.success('포스트가 고정되었습니다.');
                onPinnedPostsChange?.();
            } else {
                throw new Error(data.errorMessage || '포스트 고정에 실패했습니다.');
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '포스트 고정에 실패했습니다.');
        } finally {
            setIsAddingPost(false);
            setAddingPostUrl(null);
        }
    };

    const handleRemovePinnedPost = async (postUrl: string) => {
        try {
            const { data } = await removePinnedPost(postUrl);

            if (data.status === 'DONE') {
                setPinnedPosts((posts) => posts.filter(p => p.post.url !== postUrl));
                await queryClient.invalidateQueries({ queryKey: ['pinned-posts-setting'] });
                fetchPinnablePosts(pinnableSearchQuery, pinnablePage);
                toast.success('고정이 해제되었습니다.');
                onPinnedPostsChange?.();
            } else {
                throw new Error('고정 해제에 실패했습니다.');
            }
        } catch {
            toast.error('고정 해제에 실패했습니다.');
        }
    };

    const canAddMore = pinnedPosts.length < maxCount;
    const action = (
        <Button
            variant="primary"
            size="md"
            className="w-full sm:w-auto"
            onClick={handleOpenModal}
            disabled={!canAddMore}>
            {canAddMore ? '포스트 고정하기' : '최대 개수 도달'}
        </Button>
    );
    const list = (
        <>
            <PinnedPostList
                pinnedPosts={pinnedPosts}
                username={username}
                onReorder={handleReorder}
                onRemove={handleRemovePinnedPost}
                maxCount={maxCount}
            />

            {!embedded && (
                <AddPinnedPostModal
                    open={isModalOpen}
                    onOpenChange={setIsModalOpen}
                    pinnablePosts={pinnablePosts}
                    searchQuery={pinnableSearchQuery}
                    onSearchQueryChange={handlePinnableSearchQueryChange}
                    pagination={pinnablePagination}
                    onPageChange={handlePinnablePageChange}
                    onAdd={handleAddPinnedPost}
                    isLoading={isAddingPost}
                    isFetchingPosts={isPinnableLoading}
                />
            )}
        </>
    );

    if (!embedded) {
        return (
            <div>
                <SettingsHeader
                    title={`고정 포스트 (${pinnedPosts.length}/${maxCount})`}
                    description="프로필에 표시할 고정 포스트를 선택하세요. 드래그하여 순서를 조정할 수 있습니다."
                    actionPosition="right"
                    action={action}
                />
                {list}
            </div>
        );
    }

    return (
        <section id="pinned-posts" className="space-y-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                    <h3 className="text-lg font-semibold tracking-tight text-content">
                        고정 포스트
                        <span className="ml-2 text-sm font-medium text-content-secondary">
                            {pinnedPosts.length}/{maxCount}
                        </span>
                    </h3>
                    <p className="text-sm leading-relaxed text-content-secondary">
                        프로필에 표시할 포스트를 선택하고 순서를 조정하세요.
                    </p>
                </div>
                <div className="flex-shrink-0">
                    {!embedded && action}
                </div>
            </div>
            {list}
            <div className="border-t border-line pt-4">
                <PinnablePostInlineList
                    posts={pinnablePosts}
                    searchQuery={pinnableSearchQuery}
                    onSearchQueryChange={handlePinnableSearchQueryChange}
                    pagination={pinnablePagination}
                    onPageChange={handlePinnablePageChange}
                    onAdd={handleAddPinnedPost}
                    canAddMore={canAddMore}
                    isLoading={isPinnableLoading}
                    isAdding={isAddingPost}
                    loadingPostUrl={addingPostUrl}
                />
            </div>
        </section>
    );
};
