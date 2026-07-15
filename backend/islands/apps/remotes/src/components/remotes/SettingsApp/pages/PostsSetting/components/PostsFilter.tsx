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
        if (isScheduled && order === '-published_date') return '예약 먼 순';
        if (isScheduled && order === 'published_date') return '예약 임박순';
        return POSTS_ORDER.find(option => option.order === order)?.name || '정렬 방식';
    };
    const publicLabel = isScheduled ? '발행 후 공개' : '공개';
    const hiddenLabel = isScheduled ? '발행 후 비공개' : '숨김';
    const orderLabel = getOrderLabel(filters.order);
    const selectedTagLabel = filters.tag || '전체';
    const selectedSeriesLabel = filters.series
        ? series?.find((item) => item.url === filters.series)?.title || filters.series
        : '전체';
    const selectedVisibilityLabel = filters.visibility === 'public'
        ? publicLabel
        : filters.visibility === 'hidden' ? hiddenLabel : '전체';

    return (
        <div className="mb-6 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,0.55fr)_auto]">
                <div className="relative">
                    <Input
                        type="search"
                        density="compact"
                        aria-label="포스트 제목 검색"
                        placeholder={isScheduled ? '예약 포스트 제목 검색...' : '포스트 제목 검색...'}
                        value={searchValue}
                        onChange={onSearchChange}
                        leftIcon={<Search aria-hidden className="h-4 w-4" />}
                        rightIcon={searchValue ? <span aria-hidden /> : undefined}
                    />
                    {searchValue && (
                        <button
                            type="button"
                            aria-label="검색어 지우기"
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
                            aria-label={`포스트 정렬 방식 선택, 현재 ${orderLabel}`}
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
                    <span>{isExpanded ? '필터 접기' : '필터 더보기'}</span>
                    {activeDetailFilterCount > 0 && (
                        <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs text-content-secondary">
                            {activeDetailFilterCount}개 적용
                        </span>
                    )}
                </Button>
            </div>

            {/* 활성 필터 뱃지 */}
            {hasDetailFilters(filters) && (
                <div className="flex flex-wrap items-center gap-2">
                    {filters.tag && (
                        <div className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-subtle pl-3 text-sm text-content [@media(pointer:fine)]:min-h-9">
                            <TagIcon aria-hidden className="h-3.5 w-3.5" />
                            <span>{filters.tag}</span>
                            <button
                                type="button"
                                aria-label={`${filters.tag} 태그 필터 제거`}
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
                                aria-label="시리즈 필터 제거"
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
                                aria-label="공개 상태 필터 제거"
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
                        필터 초기화
                    </Button>
                </div>
            )}

            {/* 필터 컨트롤 */}
            <div
                id="posts-filter-controls"
                hidden={!isExpanded}
                className="rounded-2xl border border-line bg-surface-subtle p-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {/* 태그 필터 */}
                    <Dropdown
                        density="compact"
                        align="left"
                        trigger={
                            <button
                                type="button"
                                aria-label={`태그 필터 선택, 현재 ${selectedTagLabel}`}
                                className={`${settingsCompactSelectTriggerStyles} flex items-center justify-between text-left`}>
                                <span className={filters.tag ? 'text-content font-medium' : 'text-content-hint'}>
                                    {filters.tag || '태그'}
                                </span>
                                <ChevronDown aria-hidden className="h-4 w-4 text-content-hint" />
                            </button>
                            }
                        items={[
                                {
                                    label: '전체',
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

                    {/* 시리즈 필터 */}
                    <Dropdown
                        density="compact"
                        align="left"
                        trigger={
                            <button
                                type="button"
                                aria-label={`시리즈 필터 선택, 현재 ${selectedSeriesLabel}`}
                                className={`${settingsCompactSelectTriggerStyles} flex items-center justify-between text-left`}>
                                <span className={filters.series ? 'text-content font-medium' : 'text-content-hint'}>
                                    {filters.series ? selectedSeriesLabel : '시리즈'}
                                </span>
                                <ChevronDown aria-hidden className="h-4 w-4 text-content-hint" />
                            </button>
                            }
                        items={[
                                {
                                    label: '전체',
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

                    {/* 공개 상태 필터 */}
                    <Dropdown
                        density="compact"
                        align="left"
                        trigger={
                            <button
                                type="button"
                                aria-label={`공개 상태 필터 선택, 현재 ${selectedVisibilityLabel}`}
                                className={`${settingsCompactSelectTriggerStyles} flex items-center justify-between text-left`}>
                                <span className={filters.visibility ? 'text-content font-medium' : 'text-content-hint'}>
                                    {filters.visibility === 'public'
                                            ? publicLabel
                                            : filters.visibility === 'hidden'
                                                ? hiddenLabel
                                                : isScheduled ? '발행 후 공개 상태' : '공개 상태'}
                                </span>
                                <ChevronDown aria-hidden className="h-4 w-4 text-content-hint" />
                            </button>
                            }
                        items={[
                                {
                                    label: '전체',
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
