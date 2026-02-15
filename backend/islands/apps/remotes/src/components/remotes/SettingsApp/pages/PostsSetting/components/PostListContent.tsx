import { usePostsQuery, type FilterOptions } from '../hooks/usePostsData';
import { usePostsActions } from '../hooks';
import PostCard from './PostCard';
import Pagination from './Pagination';
import type { Series } from '~/lib/api/settings';

interface PostListContentProps {
    filters: FilterOptions;
    series: Series[] | undefined;
    onPageChange: (page: string) => void;
}

export const PostListContent = ({
    filters,
    series,
    onPageChange
}: PostListContentProps) => {
    const {
        posts,
        setPosts,
        postsData,
        refetch
    } = usePostsQuery(filters);

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

    if (!postsData) return null;

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
                        />
                    ))}
                </div>
            ) : (
                <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-100 border-dashed">
                    포스트가 없습니다.
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
