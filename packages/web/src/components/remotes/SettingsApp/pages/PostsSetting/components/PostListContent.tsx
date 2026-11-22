import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useLingui } from '@lingui/react/macro';
import { CalendarDays, FileText } from '@blex/ui/icons';
import { usePostsQuery, type FilterOptions, type PostsSource } from '../hooks/usePostsData';
import { usePostsActions } from '../hooks';
import PostCard from './PostCard';
import Pagination from './Pagination';
import type { Series } from '~/lib/api/settings';
import { SettingsEmptyState } from '../../../components';
import { formatLocalDateTime } from '~/i18n/formatters';
import { normalizeLocale } from '~/i18n/locale';

interface PostListContentProps {
    filters: FilterOptions;
    series: Series[] | undefined;
    onPageChange: (page: string) => void;
    onCountChange?: (count: number) => void;
    source?: PostsSource;
    emptyMessage?: string;
    emptyAction?: ReactNode;
}

export const PostListContent = ({
    filters,
    series,
    onPageChange,
    onCountChange,
    source = 'published',
    emptyMessage,
    emptyAction
}: PostListContentProps) => {
    const { i18n, t } = useLingui();
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
        handleSeriesSubmit,
        savingTagPostUrls,
        savingSeriesPostUrls
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
    const resolvedEmptyMessage = emptyMessage || t({
        id: 'settings.posts.empty.default',
        message: 'No posts'
    });

    return (
        <>
            {/* Post list */}
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
                            isTagSaving={savingTagPostUrls.has(post.url)}
                            onSeriesChange={handleSeriesChange}
                            onSeriesSubmit={handleSeriesSubmit}
                            isSeriesSaving={savingSeriesPostUrls.has(post.url)}
                            dateDisplay={isScheduled
                                ? i18n._({
                                    id: 'settings.posts.scheduled_for',
                                    message: 'Scheduled for {date}',
                                    values: {
                                        date: formatLocalDateTime(
                                            post.createdDate,
                                            normalizeLocale(i18n.locale),
                                            post.createdDate
                                        )
                                    }
                                })
                                : undefined}
                            dateIcon={isScheduled
                                ? <CalendarDays aria-hidden className="h-3.5 w-3.5 text-content-hint" />
                                : undefined}
                            statusLabel={isScheduled
                                ? t({
                                    id: 'settings.posts.status.scheduled',
                                    message: 'Scheduled'
                                })
                                : undefined}
                            showUpdatedBadge={!isScheduled}
                            isScheduled={isScheduled}
                        />
                    ))}
                </div>
            ) : (
                <SettingsEmptyState
                    icon={isScheduled
                        ? <CalendarDays aria-hidden className="h-5 w-5" />
                        : <FileText aria-hidden className="h-5 w-5" />}
                    title={resolvedEmptyMessage}
                    action={emptyAction}
                />
            )}

            <Pagination
                page={filters.page}
                lastPage={postsData.lastPage || 1}
                onPageChange={onPageChange}
            />
        </>
    );
};
