import { Button } from '~/components/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { Calendar, FileText, Search } from '@blex/ui/icons';
import {
    getSettingsIconClass,
    SETTINGS_LIST_META,
    SETTINGS_LIST_TITLE
} from '~/styles/settingsStyles';
import SettingsListItem from '../../../components/SettingsListItem';
import { getMediaPath } from '~/modules/static.module';
import type { PinnablePostData, PinnablePostsPaginationData } from '~/lib/api/settings';
import { PinnablePostsPager } from './PinnablePostsPager';
import { formatPublishedDate } from '~/i18n/formatters';
import { normalizeLocale } from '~/i18n/locale';

interface PinnablePostInlineListProps {
    posts: PinnablePostData[];
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    pagination: PinnablePostsPaginationData;
    onPageChange: (page: number) => void;
    onAdd: (postUrl: string) => void;
    canAddMore: boolean;
    isLoading?: boolean;
    isAdding?: boolean;
    loadingPostUrl?: string | null;
}

export const PinnablePostInlineList = ({
    posts,
    searchQuery,
    onSearchQueryChange,
    pagination,
    onPageChange,
    onAdd,
    canAddMore,
    isLoading = false,
    isAdding = false,
    loadingPostUrl = null
}: PinnablePostInlineListProps) => {
    const { i18n, t } = useLingui();
    const locale = normalizeLocale(i18n.locale);
    const isActionDisabled = !canAddMore || isAdding || isLoading;

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-content">
                        <Trans id="settings.pinned_posts.available.title">Available posts</Trans>
                    </h4>
                    <p className="text-xs text-content-secondary">
                        <Trans id="settings.pinned_posts.available.description">Select Pin to add a post to your profile.</Trans>
                    </p>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search aria-hidden className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-hint" />
                    <input
                        type="text"
                        aria-label={t({
                            id: 'settings.pinned_posts.available.search_label',
                            message: 'Search available posts'
                        })}
                        placeholder={t({
                            id: 'settings.pinned_posts.available.search_placeholder',
                            message: 'Search posts'
                        })}
                        value={searchQuery}
                        onChange={(event) => onSearchQueryChange(event.target.value)}
                        className="h-11 w-full rounded-lg border border-line bg-surface-subtle pl-9 pr-3 text-sm text-content transition-colors duration-150 placeholder:text-content-hint focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-line/50"
                    />
                </div>
            </div>

            {!canAddMore && (
                <div className="rounded-xl border border-line bg-surface-subtle px-4 py-3 text-sm text-content-secondary">
                    <Trans id="settings.pinned_posts.available.limit_reached">You've reached the pin limit. Unpin a post before adding another.</Trans>
                </div>
            )}

            {isLoading && posts.length === 0 ? (
                <div
                    className="space-y-3"
                    aria-label={t({
                        id: 'settings.pinned_posts.available.loading',
                        message: 'Loading available posts'
                    })}>
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div
                            key={index}
                            className="animate-pulse rounded-xl border border-line bg-surface px-4 py-3">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-lg bg-surface-subtle" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="h-4 w-2/3 rounded bg-surface-subtle" />
                                    <div className="h-3 w-1/3 rounded bg-surface-subtle" />
                                </div>
                                <div className="h-9 w-14 rounded-lg bg-surface-subtle" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : posts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line bg-surface-subtle px-4 py-8 text-center text-sm text-content-secondary">
                    {searchQuery.trim()
                        ? t({
                            id: 'settings.pinned_posts.available.no_results',
                            message: 'No search results.'
                        })
                        : t({
                            id: 'settings.pinned_posts.available.none_left',
                            message: 'There are no more posts available to pin.'
                        })}
                </div>
            ) : (
                <div className="space-y-3" aria-busy={isLoading}>
                    {posts.map((post) => {
                        const isLoading = loadingPostUrl === post.url;

                        return (
                            <SettingsListItem
                                key={post.url}
                                left={
                                    post.image ? (
                                        <div className={`${getSettingsIconClass('default')} overflow-hidden`}>
                                            <img
                                                src={getMediaPath(post.image)}
                                                alt={post.title}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className={getSettingsIconClass('default')}>
                                            <FileText aria-hidden className="h-4 w-4" />
                                        </div>
                                    )
                                }
                                actions={
                                    <Button
                                        density="compact"
                                        variant="secondary"
                                        size="sm"
                                        className="min-h-11! [@media(pointer:fine)]:min-h-9!"
                                        onClick={() => onAdd(post.url)}
                                        disabled={isActionDisabled || isLoading}
                                        isLoading={isLoading}>
                                        <Trans id="settings.pinned_posts.pin">Pin</Trans>
                                    </Button>
                                }>
                                <h3 className={`${SETTINGS_LIST_TITLE} mb-1 truncate text-content`}>{post.title}</h3>
                                <div className={`${SETTINGS_LIST_META} flex items-center gap-2 text-xs`}>
                                    <span className="flex items-center gap-1">
                                        <Calendar aria-hidden className="h-3.5 w-3.5 text-content-hint" />
                                        {formatPublishedDate(post.createdDate, post.createdDate, locale)}
                                    </span>
                                </div>
                            </SettingsListItem>
                        );
                    })}
                    <PinnablePostsPager
                        pagination={pagination}
                        onPageChange={onPageChange}
                        isLoading={isLoading}
                    />
                </div>
            )}
        </div>
    );
};
