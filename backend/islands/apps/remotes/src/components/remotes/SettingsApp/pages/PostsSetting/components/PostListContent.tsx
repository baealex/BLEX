import { useEffect } from 'react';
import { usePostsQuery, type FilterOptions, type PostsSource } from '../hooks/usePostsData';
import { usePostsActions } from '../hooks';
import PostCard from './PostCard';
import Pagination from './Pagination';
import type { Series } from '~/lib/api/settings';

interface PostListContentProps {
    filters: FilterOptions;
    series: Series[] | undefined;
    onPageChange: (page: string) => void;
    onCountChange?: (count: number) => void;
    source?: PostsSource;
    emptyMessage?: string;
}

export const PostListContent = ({
    filters,
    series,
    onPageChange,
    onCountChange,
    source = 'published',
    emptyMessage = '포스트가 없습니다.'
}: PostListContentProps) => {
    const {
        posts,
        setPosts,
        postsData,
        refetch
    } = usePostsQuery(filters, source);

    const {
        handleVisibilityToggle,
        handleDelete,
        handleTagChange,
        handleTagSubmit,
        handleSeriesChange,
        handleSeriesSubmit
    } = usePostsActions({
        username: postsData?.username || '',
        posts,
        setPosts,
        refetch
    });

    const totalCount = postsData?.totalCount ?? posts.length;

    useEffect(() => {
        onCountChange?.(totalCount);
    }, [onCountChange, totalCount]);

    if (!postsData) return null;

    const isScheduled = source === 'scheduled';

    return (
        <>
            {/* 포스트 리스트 */}
            {posts.length >= 1 ? (
                <div className="space-y-3">
                    {posts.map((post) => (
                        <PostCard
                            key={post.url}
                            post={post}
                            username={postsData.username}
                            series={series}
                            onVisibilityToggle={handleVisibilityToggle}
                            onDelete={handleDelete}
                            onTagChange={handleTagChange}
                            onTagSubmit={handleTagSubmit}
                            onSeriesChange={handleSeriesChange}
                            onSeriesSubmit={handleSeriesSubmit}
                            dateDisplay={isScheduled ? `예약 ${post.createdDate}` : undefined}
                            dateIconClass={isScheduled ? 'fas fa-calendar-day' : undefined}
                            statusLabel={isScheduled ? '예약 발행' : undefined}
                            showUpdatedBadge={!isScheduled}
                        />
                    ))}
                </div>
            ) : (
                <div className="py-12 text-center text-content-secondary bg-surface-subtle rounded-lg border border-line-light border-dashed">
                    {emptyMessage}
                </div>
            )}

            <Pagination
                page={filters.page}
                lastPage={postsData.lastPage || 1}
                onPageChange={onPageChange}
            />
        </>
    );
};
