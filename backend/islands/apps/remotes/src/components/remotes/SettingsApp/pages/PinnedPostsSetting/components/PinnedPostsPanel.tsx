import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Trash2 } from '@blex/ui/icons';
import { SettingsHeader, SettingsHeaderAction } from '../../../components';
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
    const { i18n, t } = useLingui();
    const queryClient = useQueryClient();
    const { data: pinnedPostsData } = useSuspenseQuery({
        queryKey: ['pinned-posts-setting'],
        queryFn: async () => {
            const { data } = await getPinnedPosts();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(t({
                id: 'settings.pinned_posts.error.load',
                message: 'Could not load pinned posts.'
            }));
        }
    });

    const [pinnedPosts, setPinnedPosts] = useState<PinnedPostData[]>(
        pinnedPostsData.pinnedPosts
    );
    const [pinnablePosts, setPinnablePosts] = useState<PinnablePostData[]>([]);
    const [username, setUsername] = useState<string>(pinnedPostsData.username);
    const [maxCount, setMaxCount] = useState<number>(pinnedPostsData.maxCount);
    const [reservedCount, setReservedCount] = useState<number>(
        pinnedPostsData.reservedCount ?? 0
    );
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
            setReservedCount(pinnedPostsData.reservedCount ?? 0);
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
                toast.error(t({
                    id: 'settings.pinned_posts.error.load_available',
                    message: 'Could not load available posts.'
                }));
            }
        } finally {
            if (requestSeq === pinnableRequestSeq.current) {
                setIsPinnableLoading(false);
            }
        }
    }, [t]);

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

            toast.success(t({
                id: 'settings.pinned_posts.success.reordered',
                message: 'Pinned posts reordered.'
            }));
            await queryClient.invalidateQueries({ queryKey: ['pinned-posts-setting'] });
            onPinnedPostsChange?.();
        } catch {
            setPinnedPosts(previousPinnedPosts);
            toast.error(t({
                id: 'settings.pinned_posts.error.reorder',
                message: 'Could not reorder pinned posts.'
            }));
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
                toast.success(t({
                    id: 'settings.pinned_posts.success.pinned',
                    message: 'Post pinned.'
                }));
                onPinnedPostsChange?.();
            } else {
                throw new Error(data.errorMessage || t({
                    id: 'settings.pinned_posts.error.pin',
                    message: 'Could not pin this post.'
                }));
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t({
                id: 'settings.pinned_posts.error.pin',
                message: 'Could not pin this post.'
            }));
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
                toast.success(t({
                    id: 'settings.pinned_posts.success.unpinned',
                    message: 'Post unpinned.'
                }));
                onPinnedPostsChange?.();
            } else {
                throw new Error(t({
                    id: 'settings.pinned_posts.error.unpin',
                    message: 'Could not unpin this post.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'settings.pinned_posts.error.unpin',
                message: 'Could not unpin this post.'
            }));
        }
    };

    const occupiedCount = pinnedPosts.length + reservedCount;
    const canAddMore = occupiedCount < maxCount;
    const action = (
        <SettingsHeaderAction
            variant="primary"
            onClick={handleOpenModal}
            disabled={!canAddMore}>
            {canAddMore
                ? t({
                    id: 'settings.pinned_posts.action.pin_post',
                    message: 'Pin a post'
                })
                : t({
                    id: 'settings.pinned_posts.action.limit_reached',
                    message: 'Pin limit reached'
                })}
        </SettingsHeaderAction>
    );
    const list = (
        <>
            {reservedCount > 0 && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-line bg-surface-subtle px-4 py-3 text-sm text-content-secondary">
                    <Trash2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                        <Plural
                            id="settings.pinned_posts.trash_reservation"
                            value={reservedCount}
                            one="# pinned post in the trash still counts toward your limit. It will reappear when restored."
                            other="# pinned posts in the trash still count toward your limit. They will reappear when restored."
                        />{' '}
                        <a
                            href="/settings/posts?tab=trash"
                            className="font-medium text-content underline underline-offset-2">
                            <Trans id="settings.pinned_posts.view_trash">View trash</Trans>
                        </a>
                    </p>
                </div>
            )}
            <PinnedPostList
                pinnedPosts={pinnedPosts}
                username={username}
                onReorder={handleReorder}
                onRemove={handleRemovePinnedPost}
                maxCount={maxCount}
                emptyAction={!embedded ? action : undefined}
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
                    title={i18n._({
                        id: 'settings.pinned_posts.title_count',
                        message: 'Pinned posts ({current}/{max})',
                        values: {
                            current: occupiedCount,
                            max: maxCount
                        }
                    })}
                    description={t({
                        id: 'settings.pinned_posts.description',
                        message: 'Drag posts to change the order shown on your profile.'
                    })}
                    actionPosition="right"
                    action={occupiedCount > 0 ? action : undefined}
                />
                {list}
            </div>
        );
    }

    return (
        <section id="pinned-posts" className="space-y-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                    <h3 className="text-base font-semibold text-content">
                        <Trans id="settings.pinned_posts.title">Pinned posts</Trans>
                        <span className="ml-2 text-sm font-medium text-content-secondary">
                            {occupiedCount}/{maxCount}
                        </span>
                    </h3>
                    <p className="text-sm leading-relaxed text-content-secondary">
                        <Trans id="settings.pinned_posts.description">Drag posts to change the order shown on your profile.</Trans>
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
