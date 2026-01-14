import { Suspense } from 'react';
import { Button } from '~/components/shared';
import { SettingsHeader } from '../../components';
import { usePostsFilterState } from './hooks/usePostsData';
import { PostsFilter, PostListContent } from './components';

const PostsSetting = () => {
    const {
        filters,
        tags,
        series,
        isFilterExpanded,
        setIsFilterExpanded,
        handleFilterChange,
        handleSearchChange,
        clearFilters
    } = usePostsFilterState();

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

            <Suspense fallback={<div className="h-32 bg-gray-50 animate-pulse rounded-lg mb-6" />}>
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
            </Suspense>

            <Suspense fallback={
                <div className="space-y-3 mt-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-40 bg-gray-50 animate-pulse rounded-lg border border-gray-100" />
                    ))}
                </div>
            }>
                <div className="mt-6">
                    <PostListContent
                        filters={filters}
                        series={series}
                        onPageChange={(page) => handleFilterChange('page', page)}
                    />
                </div>
            </Suspense>
        </div>
    );
};

export default PostsSetting;
