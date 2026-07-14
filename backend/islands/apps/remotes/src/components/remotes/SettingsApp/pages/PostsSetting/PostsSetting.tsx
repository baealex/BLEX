import { Suspense, useState } from 'react';
import { CalendarDays, FileText, Save, type LucideIcon } from '@blex/ui/icons';
import { Button } from '~/components/shared';
import { SettingsHeader } from '../../components';
import { usePostsFilterState } from './hooks/usePostsData';
import { DraftPostListContent, PostsFilter, PostListContent } from './components';

type PostStatusTab = 'published' | 'scheduled' | 'drafts';

const POST_STATUS_TABS: {
    value: PostStatusTab;
    label: string;
    icon: LucideIcon;
}[] = [
    {
        value: 'published',
        label: '발행 포스트',
        icon: FileText
    },
    {
        value: 'scheduled',
        label: '예약 포스트',
        icon: CalendarDays
    },
    {
        value: 'drafts',
        label: '임시 포스트',
        icon: Save
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
    const [postCounts, setPostCounts] = useState<Partial<Record<PostStatusTab, number>>>({});
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

    const handleCountChange = (tab: PostStatusTab, count: number) => {
        setPostCounts(prev => {
            if (prev[tab] === count) return prev;
            return {
                ...prev,
                [tab]: count
            };
        });
    };

    const activeCount = postCounts[activeTab];
    const title = activeCount === undefined ? '포스트' : `포스트 (${activeCount})`;
    const hasContentFilters = Boolean(
        filters.tag || filters.series || filters.visibility || filters.search
    );
    const createPostAction = (
        <Button
            variant="primary"
            size="md"
            className="min-h-11! w-full sm:w-auto"
            onClick={() => window.location.assign('/write')}>
            새 포스트 작성
        </Button>
    );
    const emptyPostAction = hasContentFilters ? (
        <Button
            variant="secondary"
            size="md"
            className="min-h-11!"
            onClick={clearFilters}>
            필터 초기화
        </Button>
    ) : createPostAction;

    return (
        <div>
            <SettingsHeader
                title={title}
                actionPosition="right"
                action={activeCount !== undefined && activeCount > 0 ? createPostAction : undefined}
            />

            <div className="mb-6 border-b border-line-light">
                <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="포스트 상태">
                    {POST_STATUS_TABS.map((tab) => {
                        const isActive = activeTab === tab.value;
                        const TabIcon = tab.icon;
                        return (
                            <button
                                key={tab.value}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => handleTabChange(tab.value)}
                                className={`inline-flex min-h-11 flex-shrink-0 items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'border-b-2 border-action text-content'
                                        : 'border-b-2 border-transparent text-content-secondary hover:text-content'
                                }`}>
                                <TabIcon aria-hidden className="h-3.5 w-3.5" />
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
                        showClearAction={activeCount !== undefined && activeCount > 0}
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
                            onCountChange={(count) => handleCountChange('published', count)}
                            emptyMessage="발행 포스트가 없습니다."
                            emptyAction={emptyPostAction}
                        />
                    )}
                    {activeTab === 'scheduled' && (
                        <PostListContent
                            filters={filters}
                            series={series}
                            onPageChange={(page) => handleFilterChange('page', page)}
                            onCountChange={(count) => handleCountChange('scheduled', count)}
                            source="scheduled"
                            emptyMessage="예약 포스트가 없습니다."
                            emptyAction={emptyPostAction}
                        />
                    )}
                    {activeTab === 'drafts' && (
                        <DraftPostListContent
                            onCountChange={(count) => handleCountChange('drafts', count)}
                            emptyAction={createPostAction}
                        />
                    )}
                </div>
            </Suspense>
        </div>
    );
};

export default PostsSetting;
