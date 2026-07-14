import {
    BookOpen,
    ChevronDown,
    ChevronRight,
    Eye,
    EyeOff,
    Search,
    SlidersHorizontal,
    Tag as TagIcon,
    X
} from '@blex/ui/icons';
import { Button, Input, Dropdown } from '~/components/shared';
import { settingsSelectTriggerStyles } from '~/styles/settingsStyles';
import type { FilterOptions } from '../hooks';
import { POSTS_ORDER } from '../hooks';
import type { Tag, Series } from '~/lib/api/settings';

interface PostsFilterProps {
    filters: FilterOptions;
    isExpanded: boolean;
    showClearAction?: boolean;
    onExpandToggle: () => void;
    onFilterChange: (key: keyof FilterOptions, value: string) => void;
    onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClearFilters: () => void;
    tags?: Tag[];
    series?: Series[];
}

const hasActiveFilters = (filters: FilterOptions) => {
    return filters.tag || filters.series || filters.visibility || filters.search;
};

const PostsFilter = ({
    filters,
    isExpanded,
    showClearAction = true,
    onExpandToggle,
    onFilterChange,
    onSearchChange,
    onClearFilters,
    tags,
    series
}: PostsFilterProps) => {
    const ExpandIcon = isExpanded ? ChevronDown : ChevronRight;
    const VisibilityIcon = filters.visibility === 'public' ? Eye : EyeOff;

    return (
        <div className="mb-6">
            {/* 필터 헤더 */}
            <div className="flex items-center justify-between gap-3 mb-4">
                <button
                    type="button"
                    onClick={onExpandToggle}
                    aria-expanded={isExpanded}
                    aria-controls="posts-filter-controls"
                    className="flex min-h-11 items-center gap-2 text-lg font-semibold text-content hover:text-content transition-colors">
                    <ExpandIcon aria-hidden className="h-4 w-4" />
                    <SlidersHorizontal aria-hidden className="h-4 w-4" />
                    <span>필터 및 검색</span>
                    {hasActiveFilters(filters) && (
                        <span className="ml-2 px-2 py-0.5 bg-line text-content text-xs font-medium rounded-full">
                            활성
                        </span>
                    )}
                </button>
                {showClearAction && hasActiveFilters(filters) && (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="min-h-11! flex-shrink-0"
                        leftIcon={<X aria-hidden className="h-4 w-4" />}
                        onClick={onClearFilters}>
                        필터 초기화
                    </Button>
                )}
            </div>

            {/* 활성 필터 뱃지 */}
            {hasActiveFilters(filters) && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {filters.search && (
                        <div className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-subtle pl-3 text-sm text-content">
                            <Search aria-hidden className="h-3.5 w-3.5" />
                            <span>검색: {filters.search}</span>
                            <button
                                type="button"
                                aria-label="검색 필터 제거"
                                onClick={() => onFilterChange('search', '')}
                                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-content-secondary hover:bg-surface hover:text-content">
                                <X aria-hidden className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                    {filters.tag && (
                        <div className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-subtle pl-3 text-sm text-content">
                            <TagIcon aria-hidden className="h-3.5 w-3.5" />
                            <span>{filters.tag}</span>
                            <button
                                type="button"
                                aria-label={`${filters.tag} 태그 필터 제거`}
                                onClick={() => onFilterChange('tag', '')}
                                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-content-secondary hover:bg-surface hover:text-content">
                                <X aria-hidden className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                    {filters.series && (
                        <div className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-subtle pl-3 text-sm text-content">
                            <BookOpen aria-hidden className="h-3.5 w-3.5" />
                            <span>{series?.find((s) => s.url === filters.series)?.title}</span>
                            <button
                                type="button"
                                aria-label="시리즈 필터 제거"
                                onClick={() => onFilterChange('series', '')}
                                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-content-secondary hover:bg-surface hover:text-content">
                                <X aria-hidden className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                    {filters.visibility && (
                        <div className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-subtle pl-3 text-sm text-content">
                            <VisibilityIcon aria-hidden className="h-3.5 w-3.5" />
                            <span>{filters.visibility === 'public' ? '공개' : '숨김'}</span>
                            <button
                                type="button"
                                aria-label="공개 상태 필터 제거"
                                onClick={() => onFilterChange('visibility', '')}
                                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-content-secondary hover:bg-surface hover:text-content">
                                <X aria-hidden className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 필터 컨트롤 */}
            {isExpanded && (
                <div id="posts-filter-controls" className="p-6 bg-surface-subtle border border-line rounded-2xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <Input
                            type="text"
                            aria-label="포스트 제목 검색"
                            placeholder="포스트 제목 검색..."
                            defaultValue={filters.search}
                            onChange={onSearchChange}
                            leftIcon={<Search aria-hidden className="h-4 w-4" />}
                        />

                        {/* 정렬 */}
                        <Dropdown
                            align="left"
                            trigger={
                                <button
                                    type="button"
                                    aria-label="포스트 정렬 방식 선택"
                                    className={`${settingsSelectTriggerStyles} flex items-center justify-between text-left`}>
                                    <span className="text-content font-medium">
                                        {POSTS_ORDER.find(o => o.order === filters.order)?.name || '정렬 방식'}
                                    </span>
                                    <ChevronDown aria-hidden className="h-4 w-4 text-content-hint" />
                                </button>
                            }
                            items={POSTS_ORDER.map((orderOption) => ({
                                label: orderOption.name,
                                onClick: () => onFilterChange('order', orderOption.order),
                                checked: filters.order === orderOption.order
                            }))}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* 태그 필터 */}
                        <Dropdown
                            align="left"
                            trigger={
                                <button
                                    type="button"
                                    aria-label="태그 필터 선택"
                                    className={`${settingsSelectTriggerStyles} flex items-center justify-between text-left`}>
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
                                    checked: filters.tag === ''
                                },
                                ...(tags?.map((tag) => ({
                                    label: `${tag.name} (${tag.count})`,
                                    onClick: () => onFilterChange('tag', tag.name),
                                    checked: filters.tag === tag.name
                                })) || [])
                            ]}
                        />

                        {/* 시리즈 필터 */}
                        <Dropdown
                            align="left"
                            trigger={
                                <button
                                    type="button"
                                    aria-label="시리즈 필터 선택"
                                    className={`${settingsSelectTriggerStyles} flex items-center justify-between text-left`}>
                                    <span className={filters.series ? 'text-content font-medium' : 'text-content-hint'}>
                                        {series?.find((s) => s.url === filters.series)?.title || '시리즈'}
                                    </span>
                                    <ChevronDown aria-hidden className="h-4 w-4 text-content-hint" />
                                </button>
                            }
                            items={[
                                {
                                    label: '전체',
                                    onClick: () => onFilterChange('series', ''),
                                    checked: filters.series === ''
                                },
                                ...(series?.map((item) => ({
                                    label: `${item.title} (${item.totalPosts})`,
                                    onClick: () => onFilterChange('series', item.url),
                                    checked: filters.series === item.url
                                })) || [])
                            ]}
                        />

                        {/* 공개 상태 필터 */}
                        <Dropdown
                            align="left"
                            trigger={
                                <button
                                    type="button"
                                    aria-label="공개 상태 필터 선택"
                                    className={`${settingsSelectTriggerStyles} flex items-center justify-between text-left`}>
                                    <span className={filters.visibility ? 'text-content font-medium' : 'text-content-hint'}>
                                        {filters.visibility === 'public' ? '공개' : filters.visibility === 'hidden' ? '숨김' : '공개 상태'}
                                    </span>
                                    <ChevronDown aria-hidden className="h-4 w-4 text-content-hint" />
                                </button>
                            }
                            items={[
                                {
                                    label: '전체',
                                    onClick: () => onFilterChange('visibility', ''),
                                    checked: filters.visibility === ''
                                },
                                {
                                    label: '공개',
                                    onClick: () => onFilterChange('visibility', 'public'),
                                    checked: filters.visibility === 'public'
                                },
                                {
                                    label: '숨김',
                                    onClick: () => onFilterChange('visibility', 'hidden'),
                                    checked: filters.visibility === 'hidden'
                                }
                            ]}
                        />

                    </div>
                </div>
            )}
        </div>
    );
};

export default PostsFilter;
