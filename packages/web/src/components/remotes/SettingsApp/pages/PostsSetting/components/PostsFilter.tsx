import {
    BookOpen,
    ChevronDown,
    Eye,
    EyeOff,
    Search,
    SlidersHorizontal,
    Tag as TagIcon,
    X
} from '@blex/ui/icons';
import { useLingui } from '@lingui/react/macro';
import { Button, Input, Dropdown } from '~/components/shared';
import { settingsCompactSelectTriggerStyles } from '~/styles/settingsStyles';
import type { FilterOptions, PostsSource } from '../hooks';
import { POSTS_ORDER } from '../hooks';
import type { Tag, Series } from '~/lib/api/settings';

interface PostsFilterProps {
    filters: FilterOptions;
    searchValue: string;
    isExpanded: boolean;
    source?: PostsSource;
    onExpandToggle: () => void;
    onFilterChange: (key: keyof FilterOptions, value: string) => void;
    onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClearFilters: () => void;
    tags?: Tag[];
    series?: Series[];
}

const hasDetailFilters = (filters: FilterOptions) => {
    return filters.tag || filters.series || filters.visibility;
};

const COMPACT_DROPDOWN_ITEM_CLASS = 'min-h-11 py-2! [@media(pointer:fine)]:min-h-9';

const PostsFilter = ({
    filters,
    searchValue,
    isExpanded,
    source = 'published',
    onExpandToggle,
    onFilterChange,
    onSearchChange,
    onClearFilters,
    tags,
    series
}: PostsFilterProps) => {
    const { i18n, t } = useLingui();
    const isScheduled = source === 'scheduled';
    const VisibilityIcon = filters.visibility === 'public' ? Eye : EyeOff;
    const activeDetailFilterCount = [
        filters.tag,
        filters.series,
        filters.visibility
    ].filter(Boolean).length;
    const validTags = tags?.filter(
        tag => typeof tag.name === 'string' && tag.name.trim().length > 0
    );
    const getOrderLabel = (order: string) => {
        if (isScheduled && order === '-published_date') {
            return t({
                id: 'settings.posts.order.scheduled_farthest',
                message: 'Latest scheduled time'
            });
        }
        if (isScheduled && order === 'published_date') {
            return t({
                id: 'settings.posts.order.scheduled_soonest',
                message: 'Soonest scheduled time'
            });
        }
        const option = POSTS_ORDER.find(item => item.order === order);
        return option
            ? i18n._(option.label)
            : t({
                id: 'settings.posts.order.label',
                message: 'Sort order'
            });
    };
    const publicLabel = isScheduled
        ? t({
            id: 'settings.posts.visibility.public_after_publish',
            message: 'Public after publishing'
        })
        : t({
            id: 'settings.posts.visibility.public',
            message: 'Public'
        });
    const hiddenLabel = isScheduled
        ? t({
            id: 'settings.posts.visibility.private_after_publish',
            message: 'Private after publishing'
        })
        : t({
            id: 'settings.posts.visibility.private',
            message: 'Private'
        });
    const orderLabel = getOrderLabel(filters.order);
    const allLabel = t({
        id: 'common.all',
        message: 'All'
    });
    const selectedTagLabel = filters.tag || allLabel;
    const selectedSeriesLabel = filters.series
        ? series?.find((item) => item.url === filters.series)?.title || filters.series
        : allLabel;
    const selectedVisibilityLabel = filters.visibility === 'public'
        ? publicLabel
        : filters.visibility === 'hidden' ? hiddenLabel : allLabel;

    return (
        <div className="mb-6 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,0.55fr)_auto]">
                <div className="relative">
                    <Input
                        type="search"
                        density="compact"
                        aria-label={t({
                            id: 'settings.posts.filters.search_aria',
                            message: 'Search post titles'
                        })}
                        placeholder={isScheduled
                            ? t({
                                id: 'settings.posts.filters.search_scheduled_placeholder',
                                message: 'Search scheduled post titles...'
                            })
                            : t({
                                id: 'settings.posts.filters.search_placeholder',
                                message: 'Search post titles...'
                            })}
                        value={searchValue}
                        onChange={onSearchChange}
                        leftIcon={<Search aria-hidden className="h-4 w-4" />}
                        rightIcon={searchValue ? <span aria-hidden /> : undefined}
                    />
                    {searchValue && (
                        <button
                            type="button"
                            aria-label={t({
                                id: 'common.search.clear',
                                message: 'Clear search'
                            })}
                            onClick={() => onFilterChange('search', '')}
                            className="absolute inset-y-0 right-0 inline-flex min-w-11 items-center justify-center rounded-lg text-content-secondary transition-colors hover:bg-surface-subtle hover:text-content [@media(pointer:fine)]:min-w-9">
                            <X aria-hidden className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                <Dropdown
                    density="compact"
                    align="left"
                    trigger={
                        <button
                            type="button"
                            aria-label={i18n._({
                                id: 'settings.posts.filters.order_aria',
                                message: 'Select post sort order. Current: {order}',
                                values: { order: orderLabel }
                            })}
                            className={`${settingsCompactSelectTriggerStyles} flex items-center justify-between text-left`}>
                            <span className="text-content font-medium">
                                {orderLabel}
                            </span>
                            <ChevronDown aria-hidden className="h-4 w-4 text-content-hint" />
                        </button>
                    }
                    items={POSTS_ORDER.map((orderOption) => ({
                        label: getOrderLabel(orderOption.order),
                        onClick: () => onFilterChange('order', orderOption.order),
                        checked: filters.order === orderOption.order,
                        className: COMPACT_DROPDOWN_ITEM_CLASS
                    }))}
                />

                <Button
                    density="compact"
                    variant="ghost"
                    size="sm"
                    className="min-h-11! self-center justify-self-end sm:col-span-2 [@media(pointer:fine)]:min-h-9! lg:col-span-1"
                    aria-expanded={isExpanded}
                    aria-controls="posts-filter-controls"
                    leftIcon={<SlidersHorizontal aria-hidden className="h-4 w-4" />}
                    rightIcon={
                        <ChevronDown
                            aria-hidden
                            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                    }
                    onClick={onExpandToggle}>
                    <span>
                        {isExpanded
                            ? t({
                                id: 'settings.posts.filters.collapse',
                                message: 'Fewer filters'
                            })
                            : t({
                                id: 'settings.posts.filters.expand',
                                message: 'More filters'
                            })}
                    </span>
                    {activeDetailFilterCount > 0 && (
                        <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs text-content-secondary">
                            {i18n._({
                                id: 'settings.posts.filters.applied_count',
                                message: '{count, plural, one {# applied} other {# applied}}',
                                values: { count: activeDetailFilterCount }
                            })}
                        </span>
                    )}
                </Button>
            </div>

            {/* Active filter badges */}
            {hasDetailFilters(filters) && (
                <div className="flex flex-wrap items-center gap-2">
                    {filters.tag && (
                        <div className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-subtle pl-3 text-sm text-content [@media(pointer:fine)]:min-h-9">
                            <TagIcon aria-hidden className="h-3.5 w-3.5" />
                            <span>{filters.tag}</span>
                            <button
                                type="button"
                                aria-label={i18n._({
                                    id: 'settings.posts.filters.remove_tag',
                                    message: 'Remove tag filter: {tag}',
                                    values: { tag: filters.tag }
                                })}
                                onClick={() => onFilterChange('tag', '')}
                                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-content-secondary hover:bg-surface hover:text-content [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9">
                                <X aria-hidden className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                    {filters.series && (
                        <div className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-subtle pl-3 text-sm text-content [@media(pointer:fine)]:min-h-9">
                            <BookOpen aria-hidden className="h-3.5 w-3.5" />
                            <span>{series?.find((s) => s.url === filters.series)?.title || filters.series}</span>
                            <button
                                type="button"
                                aria-label={t({
                                    id: 'settings.posts.filters.remove_series',
                                    message: 'Remove series filter'
                                })}
                                onClick={() => onFilterChange('series', '')}
                                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-content-secondary hover:bg-surface hover:text-content [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9">
                                <X aria-hidden className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                    {filters.visibility && (
                        <div className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-subtle pl-3 text-sm text-content [@media(pointer:fine)]:min-h-9">
                            <VisibilityIcon aria-hidden className="h-3.5 w-3.5" />
                            <span>{filters.visibility === 'public' ? publicLabel : hiddenLabel}</span>
                            <button
                                type="button"
                                aria-label={t({
                                    id: 'settings.posts.filters.remove_visibility',
                                    message: 'Remove visibility filter'
                                })}
                                onClick={() => onFilterChange('visibility', '')}
                                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-content-secondary hover:bg-surface hover:text-content [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9">
                                <X aria-hidden className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                    <Button
                        density="compact"
                        variant="ghost"
                        size="sm"
                        className="min-h-11! [@media(pointer:fine)]:min-h-9!"
                        leftIcon={<X aria-hidden className="h-4 w-4" />}
                        onClick={onClearFilters}>
                        {t({
                            id: 'settings.posts.filters.clear',
                            message: 'Clear filters'
                        })}
                    </Button>
                </div>
            )}

            {/* Filter controls */}
            <div
                id="posts-filter-controls"
                hidden={!isExpanded}
                className="rounded-2xl border border-line bg-surface-subtle p-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Tag filter */}
                    <Dropdown
                        density="compact"
                        align="left"
                        trigger={
                            <button
                                type="button"
                                aria-label={i18n._({
                                    id: 'settings.posts.filters.tag_aria',
                                    message: 'Select tag filter. Current: {tag}',
                                    values: { tag: selectedTagLabel }
                                })}
                                className={`${settingsCompactSelectTriggerStyles} flex items-center justify-between text-left`}>
                                <span className={filters.tag ? 'text-content font-medium' : 'text-content-hint'}>
                                    {filters.tag || t({
                                        id: 'settings.posts.filters.tag',
                                        message: 'Tag'
                                    })}
                                </span>
                                <ChevronDown aria-hidden className="h-4 w-4 text-content-hint" />
                            </button>
                            }
                        items={[
                                {
                                    label: allLabel,
                                    onClick: () => onFilterChange('tag', ''),
                                    checked: filters.tag === '',
                                    className: COMPACT_DROPDOWN_ITEM_CLASS
                                },
                                ...(validTags?.map((tag) => ({
                                    label: tag.name,
                                    onClick: () => onFilterChange('tag', tag.name),
                                    checked: filters.tag === tag.name,
                                    className: COMPACT_DROPDOWN_ITEM_CLASS
                                })) || [])
                            ]}
                    />

                    {/* Series filter */}
                    <Dropdown
                        density="compact"
                        align="left"
                        trigger={
                            <button
                                type="button"
                                aria-label={i18n._({
                                    id: 'settings.posts.filters.series_aria',
                                    message: 'Select series filter. Current: {series}',
                                    values: { series: selectedSeriesLabel }
                                })}
                                className={`${settingsCompactSelectTriggerStyles} flex items-center justify-between text-left`}>
                                <span className={filters.series ? 'text-content font-medium' : 'text-content-hint'}>
                                    {filters.series
                                        ? selectedSeriesLabel
                                        : t({
                                            id: 'settings.posts.filters.series',
                                            message: 'Series'
                                        })}
                                </span>
                                <ChevronDown aria-hidden className="h-4 w-4 text-content-hint" />
                            </button>
                            }
                        items={[
                                {
                                    label: allLabel,
                                    onClick: () => onFilterChange('series', ''),
                                    checked: filters.series === '',
                                    className: COMPACT_DROPDOWN_ITEM_CLASS
                                },
                                ...(series?.map((item) => ({
                                    label: item.title,
                                    onClick: () => onFilterChange('series', item.url),
                                    checked: filters.series === item.url,
                                    className: COMPACT_DROPDOWN_ITEM_CLASS
                                })) || [])
                            ]}
                    />

                    {/* Visibility filter */}
                    <Dropdown
                        density="compact"
                        align="left"
                        trigger={
                            <button
                                type="button"
                                aria-label={i18n._({
                                    id: 'settings.posts.filters.visibility_aria',
                                    message: 'Select visibility filter. Current: {visibility}',
                                    values: { visibility: selectedVisibilityLabel }
                                })}
                                className={`${settingsCompactSelectTriggerStyles} flex items-center justify-between text-left`}>
                                <span className={filters.visibility ? 'text-content font-medium' : 'text-content-hint'}>
                                    {filters.visibility === 'public'
                                            ? publicLabel
                                            : filters.visibility === 'hidden'
                                                ? hiddenLabel
                                                : isScheduled
                                                    ? t({
                                                        id: 'settings.posts.filters.visibility_after_publish',
                                                        message: 'Visibility after publishing'
                                                    })
                                                    : t({
                                                        id: 'settings.posts.filters.visibility',
                                                        message: 'Visibility'
                                                    })}
                                </span>
                                <ChevronDown aria-hidden className="h-4 w-4 text-content-hint" />
                            </button>
                            }
                        items={[
                                {
                                    label: allLabel,
                                    onClick: () => onFilterChange('visibility', ''),
                                    checked: filters.visibility === '',
                                    className: COMPACT_DROPDOWN_ITEM_CLASS
                                },
                                {
                                    label: publicLabel,
                                    onClick: () => onFilterChange('visibility', 'public'),
                                    checked: filters.visibility === 'public',
                                    className: COMPACT_DROPDOWN_ITEM_CLASS
                                },
                                {
                                    label: hiddenLabel,
                                    onClick: () => onFilterChange('visibility', 'hidden'),
                                    checked: filters.visibility === 'hidden',
                                    className: COMPACT_DROPDOWN_ITEM_CLASS
                                }
                            ]}
                    />
                </div>
            </div>
        </div>
    );
};

export default PostsFilter;
