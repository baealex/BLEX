import { useState } from 'react';
import { Checkbox, Input } from '~/components/shared';
import { Search } from '@blex/ui/icons';
import { SettingsEmptyState } from '../../../components';
import type { AvailableSeriesPost } from '~/lib/api/settings';

interface PostSelectorProps {
    posts: AvailableSeriesPost[];
    selectedPostIds: number[];
    onChange: (postIds: number[]) => void;
}

const PostSelector = ({ posts, selectedPostIds, onChange }: PostSelectorProps) => {
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
                <h2 className="text-base font-semibold text-content">포함할 포스트 선택</h2>
                <div className="rounded-full bg-surface-subtle px-3 py-1 text-xs font-medium text-content-secondary">
                    {selectedPostIds.length}개 선택
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="space-y-3 border-b border-line-light p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                            <Input
                                type="text"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="포스트 제목 검색"
                                leftIcon={<Search className="h-4 w-4" />}
                            />
                        </div>
                        <div className="flex min-h-11 items-center justify-between gap-2 sm:justify-end">
                            <button
                                type="button"
                                onClick={handleToggleAll}
                                disabled={safePosts.length === 0}
                                className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-content-secondary transition-colors duration-150 hover:text-content active:text-content disabled:cursor-not-allowed disabled:opacity-40">
                                {isAllSelected ? '전체 해제' : '전체 선택'}
                            </button>
                            {isSearchActive && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-content-secondary transition-colors duration-150 hover:text-content active:text-content">
                                    검색 지우기
                                </button>
                            )}
                        </div>
                    </div>

                    {isSearchActive && (
                        <p className="text-xs text-content-secondary">
                            {filteredPosts.length}개의 검색 결과
                        </p>
                    )}
                </div>

                {safePosts.length === 0 ? (
                    <SettingsEmptyState
                        iconClassName="fas fa-file-alt"
                        title="선택 가능한 포스트가 없습니다"
                        description="아직 게시되지 않았거나 이미 다른 시리즈에 포함된 포스트는 제외됩니다."
                        className="py-12"
                    />
                ) : filteredPosts.length === 0 ? (
                    <SettingsEmptyState
                        iconClassName="fas fa-search"
                        title="검색 결과가 없습니다"
                        description="다른 검색어로 다시 시도해주세요."
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
                                            onCheckedChange={() => togglePost(post.id)}
                                        />
                                    </div>
                                    <div className="ml-3 min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-content">
                                            {post.title}
                                        </span>
                                        {post.publishedDate && (
                                            <span className="mt-0.5 block text-xs text-content-hint">
                                                {post.publishedDate}
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
