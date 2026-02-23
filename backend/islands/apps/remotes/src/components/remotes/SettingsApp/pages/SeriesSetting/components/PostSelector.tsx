import { useState } from 'react';
import { Checkbox, Input } from '~/components/shared';
import { SettingsEmptyState } from '../../../components';
import type { AvailableSeriesPost } from '~/lib/api/settings';

type SortMode = 'default' | 'selectedFirst';

interface PostSelectorProps {
    posts: AvailableSeriesPost[];
    selectedPostIds: number[];
    onChange: (postIds: number[]) => void;
}

const PostSelector = ({ posts, selectedPostIds, onChange }: PostSelectorProps) => {
    const [query, setQuery] = useState('');
    const [sortMode, setSortMode] = useState<SortMode>('default');
    const [undoSelection, setUndoSelection] = useState<number[] | null>(null);

    const safePosts = Array.isArray(posts) ? posts : [];
    const selectedPostIdSet = new Set(selectedPostIds);

    let filteredPosts = safePosts;

    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
        filteredPosts = filteredPosts.filter((post) => post.title.toLowerCase().includes(normalizedQuery));
    }

    if (sortMode === 'selectedFirst') {
        filteredPosts = [...filteredPosts].sort((a, b) => {
            const aSelected = selectedPostIdSet.has(a.id) ? 0 : 1;
            const bSelected = selectedPostIdSet.has(b.id) ? 0 : 1;
            return aSelected - bSelected;
        });
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
        if (isSearchActive) {
            return;
        }

        if (isAllSelected) {
            setUndoSelection([...selectedPostIds]);
            onChange([]);
            return;
        }

        setUndoSelection([...selectedPostIds]);
        onChange(safePosts.map((post) => post.id));
    };

    const handleSelectFiltered = () => {
        const nextIds = new Set(selectedPostIds);
        filteredPosts.forEach((post) => nextIds.add(post.id));
        setUndoSelection([...selectedPostIds]);
        onChange(Array.from(nextIds));
    };

    const handleUndoSelection = () => {
        if (!undoSelection) {
            return;
        }

        onChange(undoSelection);
        setUndoSelection(null);
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 bg-surface-subtle rounded-lg flex items-center justify-center">
                        <i className="fas fa-list text-sm text-content" />
                    </div>
                    <h2 className="text-base font-semibold text-content">포함할 글 선택</h2>
                </div>
                <div className="text-sm text-content-secondary">
                    {selectedPostIds.length}개 선택
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex-1">
                    <Input
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="포스트 제목 검색"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setQuery('')}
                    disabled={!isSearchActive}
                    className="inline-flex h-12 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-content transition-all duration-150 hover:bg-surface-subtle active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
                    지우기
                </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleToggleAll}
                        disabled={safePosts.length === 0 || isSearchActive}
                        className={`inline-flex h-11 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
                            isAllSelected
                                ? 'border-line-strong bg-action text-content-inverted hover:bg-action-hover'
                                : 'border-line bg-surface text-content hover:bg-surface-subtle'
                        }`}>
                        {isAllSelected ? '전체 해제' : '전체 선택'}
                    </button>

                    {isSearchActive && (
                        <button
                            type="button"
                            onClick={handleSelectFiltered}
                            disabled={filteredPosts.length === 0}
                            className="inline-flex h-11 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-content transition-all duration-150 hover:bg-surface-subtle active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
                            검색 결과 전체 선택
                        </button>
                    )}

                    {undoSelection !== null && (
                        <button
                            type="button"
                            onClick={handleUndoSelection}
                            className="inline-flex h-11 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-content transition-all duration-150 hover:bg-surface-subtle active:scale-[0.98]">
                            되돌리기
                        </button>
                    )}
                </div>

                <div className="flex justify-end sm:ml-auto">
                    <button
                        type="button"
                        onClick={() => setSortMode((prev) => (prev === 'default' ? 'selectedFirst' : 'default'))}
                        className={`inline-flex h-11 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
                            sortMode === 'selectedFirst'
                                ? 'border-line-strong bg-action text-content-inverted'
                                : 'border-line bg-surface text-content hover:bg-surface-subtle'
                        }`}>
                        선택 우선 정렬
                    </button>
                </div>
            </div>

            {isSearchActive && (
                <p className="text-xs text-content-secondary">
                    검색 중에는 실수 방지를 위해 전체 선택/해제를 비활성화했습니다.
                </p>
            )}

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
                <div className="space-y-2 max-h-96 overflow-y-auto overflow-x-hidden">
                    {filteredPosts.map((post) => {
                        const isSelected = selectedPostIdSet.has(post.id);
                        return (
                            <div
                                key={post.id}
                                onClick={() => togglePost(post.id)}
                                className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all motion-interaction active:bg-surface-subtle w-full ${
                                    isSelected
                                        ? 'border-line bg-surface-subtle'
                                        : 'bg-surface border-line hover:border-line hover:bg-surface-subtle'
                                }`}>
                                <div onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => togglePost(post.id)}
                                    />
                                </div>
                                <div className="flex-1 min-w-0 ml-3">
                                    <span className="text-sm font-medium text-content truncate block">
                                        {post.title}
                                    </span>
                                    {post.publishedDate && (
                                        <span className="text-xs text-content-hint mt-0.5 block">
                                            {post.publishedDate}
                                        </span>
                                    )}
                                </div>
                                {isSelected && (
                                    <i className="fas fa-check text-xs text-content ml-2 shrink-0" />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PostSelector;
