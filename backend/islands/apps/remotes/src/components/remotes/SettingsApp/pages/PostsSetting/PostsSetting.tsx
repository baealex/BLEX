import { Button } from '~/components/shared';
import { SettingsHeader } from '../../components';
import { usePostsData, usePostsActions } from './hooks';
import { PostsFilter, PostCard, Pagination } from './components';

const PostsSetting = () => {
    const {
        posts,
        setPosts,
        postsData,
        tags,
        series,
        filters,
        isFilterExpanded,
        setIsFilterExpanded,
        handleFilterChange,
        handleSearchChange,
        clearFilters,
        refetch
    } = usePostsData();

    const {
        handleVisibilityToggle,
        handleNoticeToggle,
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

    return (
        <div>
            <SettingsHeader
                title="포스트"
                description="포스트를 관리하고 태그, 시리즈를 편집하세요."
                action={
                    <Button
                        variant="primary"
                        size="md"
                        fullWidth
                        leftIcon={<i className="fas fa-plus" />}
                        onClick={() => window.location.href = '/write'}>
                        새 포스트 작성
                    </Button>
                }
            />

            <PostsFilter
                filters={filters}
                isExpanded={isFilterExpanded}
                onExpandToggle={() => setIsFilterExpanded(!isFilterExpanded)}
                onFilterChange={handleFilterChange}
                onSearchChange={handleSearchChange}
                onClearFilters={clearFilters}
                tags={tags}
                series={series}
            />

            {/* 포스트 리스트 */}
            {postsData?.posts && posts.length >= 1 && (
                <div className="space-y-3">
                    {posts.map((post) => (
                        <PostCard
                            key={post.url}
                            post={post}
                            username={postsData.username}
                            series={series}
                            onVisibilityToggle={handleVisibilityToggle}
                            onNoticeToggle={handleNoticeToggle}
                            onDelete={handleDelete}
                            onTagChange={handleTagChange}
                            onTagSubmit={handleTagSubmit}
                            onSeriesChange={handleSeriesChange}
                            onSeriesSubmit={handleSeriesSubmit}
                        />
                    ))}
                </div>
            )}

            <Pagination
                page={filters.page}
                lastPage={postsData?.lastPage || 1}
                onPageChange={(page) => handleFilterChange('page', page)}
            />
        </div>
    );
};

export default PostsSetting;
