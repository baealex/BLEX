import { Button, Input, Dropdown } from '~/components/shared';
import { baseInputStyles } from '~/components/shared';
import type { FilterOptions } from '../hooks';
import { POSTS_ORDER } from '../hooks';
import type { Tag, Series } from '~/lib/api/settings';

interface PostsFilterProps {
    filters: FilterOptions;
    isExpanded: boolean;
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
    onExpandToggle,
    onFilterChange,
    onSearchChange,
    onClearFilters,
    tags,
    series
}: PostsFilterProps) => {
    return (
        <div className="mb-6">
            {/* 필터 헤더 */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={onExpandToggle}
                    className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-gray-700 transition-colors">
                    <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} text-sm`} />
                    <i className="fas fa-filter" />
                    <span>필터 및 검색</span>
                    {hasActiveFilters(filters) && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            활성
                        </span>
                    )}
                </button>
                {hasActiveFilters(filters) && (
                    <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<i className="fas fa-times" />}
                        onClick={onClearFilters}>
                        필터 초기화
                    </Button>
                )}
            </div>

            {/* 활성 필터 뱃지 */}
            {hasActiveFilters(filters) && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {filters.search && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm">
                            <i className="fas fa-search text-xs" />
                            <span>검색: {filters.search}</span>
                            <button
                                onClick={() => onFilterChange('search', '')}
                                className="hover:text-blue-900">
                                <i className="fas fa-times text-xs" />
                            </button>
                        </div>
                    )}
                    {filters.tag && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm">
                            <i className="fas fa-tag text-xs" />
                            <span>{filters.tag}</span>
                            <button
                                onClick={() => onFilterChange('tag', '')}
                                className="hover:text-purple-900">
                                <i className="fas fa-times text-xs" />
                            </button>
                        </div>
                    )}
                    {filters.series && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm">
                            <i className="fas fa-book text-xs" />
                            <span>{series?.find((s) => s.url === filters.series)?.title}</span>
                            <button
                                onClick={() => onFilterChange('series', '')}
                                className="hover:text-green-900">
                                <i className="fas fa-times text-xs" />
                            </button>
                        </div>
                    )}
                    {filters.visibility && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-sm">
                            <i className={`fas ${filters.visibility === 'public' ? 'fa-eye' : 'fa-eye-slash'} text-xs`} />
                            <span>{filters.visibility === 'public' ? '공개' : '숨김'}</span>
                            <button
                                onClick={() => onFilterChange('visibility', '')}
                                className="hover:text-orange-900">
                                <i className="fas fa-times text-xs" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 필터 컨트롤 */}
            {isExpanded && (
                <div className="p-6 bg-gray-50 border border-gray-200 rounded-2xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <Input
                            type="text"
                            placeholder="포스트 제목 검색..."
                            defaultValue={filters.search}
                            onChange={onSearchChange}
                            leftIcon={<i className="fas fa-search" />}
                        />

                        {/* 정렬 */}
                        <Dropdown
                            align="left"
                            trigger={
                                <button className={`${baseInputStyles} flex items-center justify-between text-left`}>
                                    <span className="text-gray-900 font-medium">
                                        {POSTS_ORDER.find(o => o.order === filters.order)?.name || '정렬 방식'}
                                    </span>
                                    <i className="fas fa-chevron-down text-gray-400" />
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
                                <button className={`${baseInputStyles} flex items-center justify-between text-left`}>
                                    <span className={filters.tag ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                                        {filters.tag || '태그'}
                                    </span>
                                    <i className="fas fa-chevron-down text-gray-400" />
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
                                <button className={`${baseInputStyles} flex items-center justify-between text-left`}>
                                    <span className={filters.series ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                                        {series?.find((s) => s.url === filters.series)?.title || '시리즈'}
                                    </span>
                                    <i className="fas fa-chevron-down text-gray-400" />
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
                                <button className={`${baseInputStyles} flex items-center justify-between text-left`}>
                                    <span className={filters.visibility ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                                        {filters.visibility === 'public' ? '공개' : filters.visibility === 'hidden' ? '숨김' : '공개 상태'}
                                    </span>
                                    <i className="fas fa-chevron-down text-gray-400" />
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
