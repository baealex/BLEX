import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Checkbox, Input } from '~/components/shared';
import { FileText, Search } from '@blex/ui/icons';
import { SettingsEmptyState } from '../../../components';
import type { AvailableSeriesPost } from '~/lib/api/settings';
import { formatDateOnly } from '~/i18n/formatters';
import { normalizeLocale } from '~/i18n/locale';

interface PostSelectorProps {
    posts: AvailableSeriesPost[];
    selectedPostIds: number[];
    onChange: (postIds: number[]) => void;
}

const PostSelector = ({ posts, selectedPostIds, onChange }: PostSelectorProps) => {
    const { i18n, t } = useLingui();
    const [query, setQuery] = useState('');

    const safePosts = Array.isArray(posts) ? posts : [];
    const selectedPostIdSet = new Set(selectedPostIds);

    let filteredPosts = safePosts;

    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
        filteredPosts = filteredPosts.filter((post) => post.title.toLowerCase().includes(normalizedQuery));
    }

    const togglePost = (postId: number) => {
        if (selectedPostIdSet.has(postId)) {
            onChange(selectedPostIds.filter((id) => id !== postId));
            return;
        }
        onChange([...selectedPostIds, postId]);
    };

    const isSearchActive = normalizedQuery.length > 0;
    const isAllSelected = safePosts.length > 0 && selectedPostIds.length === safePosts.length;

    const handleToggleAll = () => {
        if (isAllSelected) {
            onChange([]);
            return;
        }

        onChange(safePosts.map((post) => post.id));
    };

    return (
        <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
                <h2 className="text-base font-semibold text-content">
                    <Trans id="settings.series.posts.title">
                        Select posts to include
                    </Trans>
                </h2>
                <div className="rounded-full bg-surface-subtle px-3 py-1 text-xs font-medium text-content-secondary">
                    {i18n._({
                        id: 'settings.series.posts.selected_count',
                        message: '{count, plural, one {# selected} other {# selected}}',
                        values: { count: selectedPostIds.length }
                    })}
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="space-y-3 border-b border-line-light p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                            <Input
                                density="compact"
                                type="text"
                                aria-label={t({
                                    id: 'settings.series.posts.search_aria',
                                    message: 'Search posts to include'
                                })}
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={t({
                                    id: 'settings.series.posts.search_placeholder',
                                    message: 'Search post titles'
                                })}
                                leftIcon={<Search aria-hidden className="h-4 w-4" />}
                            />
                        </div>
                        <div className="flex min-h-11 items-center justify-between gap-2 sm:justify-end">
                            <button
                                type="button"
                                onClick={handleToggleAll}
                                disabled={safePosts.length === 0}
                                className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-content-secondary transition-colors duration-150 hover:text-content active:text-content disabled:cursor-not-allowed disabled:opacity-40 [@media(pointer:fine)]:min-h-9">
                                {isAllSelected
                                    ? t({
                                        id: 'settings.series.posts.deselect_all',
                                        message: 'Deselect all'
                                    })
                                    : t({
                                        id: 'settings.series.posts.select_all',
                                        message: 'Select all'
                                    })}
                            </button>
                            {isSearchActive && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-content-secondary transition-colors duration-150 hover:text-content active:text-content [@media(pointer:fine)]:min-h-9">
                                    <Trans id="settings.series.posts.clear_search">
                                        Clear search
                                    </Trans>
                                </button>
                            )}
                        </div>
                    </div>

                    {isSearchActive && (
                        <p className="text-xs text-content-secondary">
                            {i18n._({
                                id: 'settings.series.posts.result_count',
                                message: '{count, plural, one {# result} other {# results}}',
                                values: { count: filteredPosts.length }
                            })}
                        </p>
                    )}
                </div>

                {safePosts.length === 0 ? (
                    <SettingsEmptyState
                        icon={<FileText aria-hidden className="h-5 w-5" />}
                        title={t({
                            id: 'settings.series.posts.empty.title',
                            message: 'No posts available'
                        })}
                        description={t({
                            id: 'settings.series.posts.empty.description',
                            message: 'Unpublished posts and posts already assigned to another series are excluded.'
                        })}
                        className="py-12"
                    />
                ) : filteredPosts.length === 0 ? (
                    <SettingsEmptyState
                        icon={<Search aria-hidden className="h-5 w-5" />}
                        title={t({
                            id: 'settings.series.posts.no_results.title',
                            message: 'No results'
                        })}
                        description={t({
                            id: 'settings.series.posts.no_results.description',
                            message: 'Try a different search term.'
                        })}
                        className="py-12"
                    />
                ) : (
                    <div className="max-h-96 divide-y divide-line-light overflow-y-auto overflow-x-hidden">
                        {filteredPosts.map((post) => {
                            const isSelected = selectedPostIdSet.has(post.id);
                            return (
                                <div
                                    key={post.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => togglePost(post.id)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            togglePost(post.id);
                                        }
                                    }}
                                    className={`flex w-full cursor-pointer items-center px-4 py-3.5 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-line-strong/70 ${
                                        isSelected
                                            ? 'bg-surface-subtle'
                                            : 'bg-surface hover:bg-surface-subtle/60'
                                    }`}>
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            checked={isSelected}
                                            aria-label={i18n._({
                                                id: 'settings.series.posts.select_post',
                                                message: 'Select post: {title}',
                                                values: { title: post.title }
                                            })}
                                            onCheckedChange={() => togglePost(post.id)}
                                        />
                                    </div>
                                    <div className="ml-3 min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-content">
                                            {post.title}
                                        </span>
                                        {post.publishedDate && (
                                            <span className="mt-0.5 block text-xs text-content-hint">
                                                {formatDateOnly(
                                                    post.publishedDate,
                                                    normalizeLocale(i18n.locale),
                                                    post.publishedDate
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
};

export default PostSelector;
