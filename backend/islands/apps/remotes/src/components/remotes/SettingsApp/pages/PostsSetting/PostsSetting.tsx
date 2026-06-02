import { Suspense, useState } from 'react';
import { Button } from '~/components/shared';
import { SettingsHeader } from '../../components';
import { usePostsFilterState } from './hooks/usePostsData';
import { DraftPostListContent, PostsFilter, PostListContent } from './components';

type PostStatusTab = 'published' | 'scheduled' | 'drafts';

const POST_STATUS_TABS: {
    value: PostStatusTab;
    label: string;
    icon: string;
}[] = [
    {
        value: 'published',
        label: '발행 포스트',
        icon: 'fa-file-alt'
    },
    {
        value: 'scheduled',
        label: '예약 포스트',
        icon: 'fa-calendar-day'
    },
    {
        value: 'drafts',
        label: '임시 포스트',
        icon: 'fa-save'
    }
];

const isPostStatusTab = (value: string | null): value is PostStatusTab => {
    return value === 'published' || value === 'scheduled' || value === 'drafts';
};

const getInitialTab = (): PostStatusTab => {
    if (typeof window === 'undefined') return 'published';

    const tab = new URLSearchParams(window.location.search).get('tab');
    return isPostStatusTab(tab) ? tab : 'published';
};

const syncTabToURL = (tab: PostStatusTab) => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (tab === 'published') {
        params.delete('tab');
    } else {
        params.set('tab', tab);
    }
    params.delete('section');

    const queryString = params.toString();
    const newURL = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', newURL);
};

const PostsSetting = () => {
    const [activeTab, setActiveTab] = useState<PostStatusTab>(getInitialTab);
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

    const handleTabChange = (tab: PostStatusTab) => {
        setActiveTab(tab);
        handleFilterChange('page', '1');
        syncTabToURL(tab);
    };

    return (
        <div>
            <SettingsHeader
                title="포스트"
                description="발행, 예약, 임시 포스트를 관리하세요."
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

            <div className="mb-6 border-b border-line-light">
                <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="포스트 상태">
                    {POST_STATUS_TABS.map((tab) => {
                        const isActive = activeTab === tab.value;
                        return (
                            <button
                                key={tab.value}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => handleTabChange(tab.value)}
                                className={`inline-flex flex-shrink-0 items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'border-b-2 border-action text-content'
                                        : 'border-b-2 border-transparent text-content-secondary hover:text-content'
                                }`}>
                                <i className={`fas ${tab.icon} text-xs`} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {activeTab !== 'drafts' && (
                <Suspense fallback={<div className="h-32 bg-surface-subtle animate-pulse rounded-lg mb-6" />}>
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
            )}

            <Suspense
                fallback={
                    <div className="space-y-3 mt-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-40 bg-surface-subtle animate-pulse rounded-lg border border-line-light" />
                        ))}
                    </div>
                }>
                <div className="mt-6">
                    {activeTab === 'published' && (
                        <PostListContent
                            filters={filters}
                            series={series}
                            onPageChange={(page) => handleFilterChange('page', page)}
                            emptyMessage="발행 포스트가 없습니다."
                        />
                    )}
                    {activeTab === 'scheduled' && (
                        <PostListContent
                            filters={filters}
                            series={series}
                            onPageChange={(page) => handleFilterChange('page', page)}
                            source="scheduled"
                            emptyMessage="예약 포스트가 없습니다."
                        />
                    )}
                    {activeTab === 'drafts' && (
                        <DraftPostListContent />
                    )}
                </div>
            </Suspense>
        </div>
    );
};

export default PostsSetting;
