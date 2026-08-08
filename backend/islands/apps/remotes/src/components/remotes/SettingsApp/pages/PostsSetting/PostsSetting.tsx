import { Suspense, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import {
    CalendarDays,
    FileText,
    Save,
    Trash2,
    type LucideIcon
} from '@blex/ui/icons';
import { Button, LoadingState, Tabs } from '~/components/shared';
import { SettingsHeader } from '../../components';
import { usePostsFilterState } from './hooks/usePostsData';
import {
    DraftPostListContent,
    PostsFilter,
    PostListContent,
    TrashPostListContent
} from './components';

type PostStatusTab = 'published' | 'scheduled' | 'drafts' | 'trash';

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
    const { i18n, t } = useLingui();
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

    const postStatusTabs: {
        value: PostStatusTab;
        label: string;
        icon: LucideIcon;
    }[] = [
        {
            value: 'published',
            label: t({
                id: 'settings.posts.tabs.published',
                message: 'Published'
            }),
            icon: FileText
        },
        {
            value: 'scheduled',
            label: t({
                id: 'settings.posts.tabs.scheduled',
                message: 'Scheduled'
            }),
            icon: CalendarDays
        },
        {
            value: 'drafts',
            label: t({
                id: 'settings.posts.tabs.drafts',
                message: 'Drafts'
            }),
            icon: Save
        },
        {
            value: 'trash',
            label: t({
                id: 'settings.posts.tabs.trash',
                message: 'Trash'
            }),
            icon: Trash2
        }
    ];
    const activeCount = postCounts[activeTab];
    const title = activeCount === undefined
        ? t({
            id: 'settings.posts.title',
            message: 'Posts'
        })
        : i18n._({
            id: 'settings.posts.title_count',
            message: 'Posts ({count})',
            values: { count: activeCount }
        });
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
            <Trans id="settings.posts.create">Write a new post</Trans>
        </Button>
    );
    const emptyPostAction = hasContentFilters ? (
        <Button
            density="compact"
            variant="secondary"
            size="md"
            className="min-h-11! [@media(pointer:fine)]:min-h-10!"
            onClick={clearFilters}>
            <Trans id="settings.posts.filters.clear">Clear filters</Trans>
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
                    ariaLabel={t({
                        id: 'settings.posts.tabs.aria',
                        message: 'Post status'
                    })}
                    className="mb-6 grid grid-cols-4 gap-0 border-line-light sm:flex sm:gap-1">
                    {postStatusTabs.map((tab) => {
                        const TabIcon = tab.icon;
                        return (
                            <Tabs.Trigger
                                key={tab.value}
                                value={tab.value}
                                className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1 px-1 py-2.5 text-xs [@media(pointer:fine)]:min-h-10 sm:flex-shrink-0 sm:gap-2 sm:px-3 sm:text-sm">
                                <TabIcon aria-hidden className="hidden h-3.5 w-3.5 sm:block" />
                                <span className="truncate">{tab.label}</span>
                            </Tabs.Trigger>
                        );
                    })}
                </Tabs.List>

                <Tabs.Content value={activeTab}>
                    {(activeTab === 'published' || activeTab === 'scheduled') && (
                        <Suspense
                            fallback={(
                                <div className="mb-6">
                                    <LoadingState
                                        type="spinner"
                                        ariaLabel={t({
                                            id: 'settings.posts.filters.loading',
                                            message: 'Loading post filters...'
                                        })}
                                    />
                                </div>
                            )}>
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
                            <div className="mt-6">
                                <LoadingState
                                    type="list"
                                    ariaLabel={t({
                                        id: 'settings.posts.list.loading',
                                        message: 'Loading posts...'
                                    })}
                                />
                            </div>
                        }>
                        <div className="mt-6">
                            {activeTab === 'published' && (
                                <PostListContent
                                    filters={filters}
                                    series={series}
                                    onPageChange={(page) => handleFilterChange('page', page)}
                                    onCountChange={(count) => handleCountChange('published', count)}
                                    emptyMessage={t({
                                        id: 'settings.posts.empty.published',
                                        message: 'No published posts'
                                    })}
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
                                    emptyMessage={t({
                                        id: 'settings.posts.empty.scheduled',
                                        message: 'No scheduled posts'
                                    })}
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
