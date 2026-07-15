import { Suspense, useState } from 'react';
import {
    CalendarDays,
    FileText,
    Save,
    Trash2,
    type LucideIcon
} from '@blex/ui/icons';
import { Button, Tabs } from '~/components/shared';
import { SettingsHeader } from '../../components';
import { usePostsFilterState } from './hooks/usePostsData';
import {
    DraftPostListContent,
    PostsFilter,
    PostListContent,
    TrashPostListContent
} from './components';

type PostStatusTab = 'published' | 'scheduled' | 'drafts' | 'trash';

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
    },
    {
        value: 'trash',
        label: '휴지통',
        icon: Trash2
    }
];

const isPostStatusTab = (value: string | null): value is PostStatusTab => {
    return value === 'published'
        || value === 'scheduled'
        || value === 'drafts'
        || value === 'trash';
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
        searchValue,
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
            density="compact"
            variant="primary"
            size="md"
            className="min-h-11! w-full [@media(pointer:fine)]:min-h-10! sm:w-auto"
            onClick={() => window.location.assign('/write')}>
            새 포스트 작성
        </Button>
    );
    const emptyPostAction = hasContentFilters ? (
        <Button
            density="compact"
            variant="secondary"
            size="md"
            className="min-h-11! [@media(pointer:fine)]:min-h-10!"
            onClick={clearFilters}>
            필터 초기화
        </Button>
    ) : createPostAction;

    return (
        <div>
            <SettingsHeader
                title={title}
            />

            <Tabs.Root
                value={activeTab}
                onValueChange={(value) => {
                    if (isPostStatusTab(value)) handleTabChange(value);
                }}>
                <Tabs.List
                    ariaLabel="포스트 상태"
                    className="mb-6 gap-1 overflow-x-auto border-line-light">
                    {POST_STATUS_TABS.map((tab) => {
                        const TabIcon = tab.icon;
                        return (
                            <Tabs.Trigger
                                key={tab.value}
                                value={tab.value}
                                className="inline-flex min-h-11 flex-shrink-0 items-center gap-2 px-3 py-2.5 [@media(pointer:fine)]:min-h-10">
                                <TabIcon aria-hidden className="h-3.5 w-3.5" />
                                {tab.label}
                            </Tabs.Trigger>
                        );
                    })}
                </Tabs.List>

                <Tabs.Content value={activeTab}>
                    {(activeTab === 'published' || activeTab === 'scheduled') && (
                        <Suspense fallback={<div className="mb-6 h-32 animate-pulse rounded-lg bg-surface-subtle" />}>
                            <PostsFilter
                                filters={filters}
                                searchValue={searchValue}
                                isExpanded={isFilterExpanded}
                                source={activeTab}
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
                            <div className="mt-6 space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-40 animate-pulse rounded-lg border border-line-light bg-surface-subtle" />
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
                            {activeTab === 'trash' && (
                                <TrashPostListContent
                                    page={filters.page}
                                    onPageChange={(page) => handleFilterChange('page', page)}
                                    onCountChange={(count) => handleCountChange('trash', count)}
                                />
                            )}
                        </div>
                    </Suspense>
                </Tabs.Content>
            </Tabs.Root>
        </div>
    );
};

export default PostsSetting;
