import { useMemo, useState } from 'react';
import { Checkbox, Input } from '~/components/shared';
import { SettingsEmptyState } from '../../../components';
import type { AvailableSeriesPost } from '~/lib/api/settings';

type FilterMode = 'all' | 'selected';

interface PostSelectorProps {
    posts: AvailableSeriesPost[];
    selectedPostIds: number[];
    onChange: (postIds: number[]) => void;
}

const PostSelector = ({ posts, selectedPostIds, onChange }: PostSelectorProps) => {
    const [query, setQuery] = useState('');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');

    const safePosts = Array.isArray(posts) ? posts : [];

    const filteredPosts = useMemo(() => {
        let result = safePosts;

        if (filterMode === 'selected') {
            result = result.filter((post) => selectedPostIds.includes(post.id));
        }

        const normalizedQuery = query.trim().toLowerCase();
        if (normalizedQuery) {
            result = result.filter((post) => post.title.toLowerCase().includes(normalizedQuery));
        }

        return result;
    }, [safePosts, query, filterMode, selectedPostIds]);

    const togglePost = (postId: number) => {
        if (selectedPostIds.includes(postId)) {
            onChange(selectedPostIds.filter((id) => id !== postId));
            return;
        }
        onChange([...selectedPostIds, postId]);
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <i className="fas fa-list text-sm text-gray-700" />
                    </div>
                    <h2 className="text-base font-semibold text-gray-900">포함할 글 선택</h2>
                </div>
                <div className="text-sm text-gray-500">
                    {selectedPostIds.length}개 선택
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <Input
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="포스트 제목 검색"
                    />
                </div>
                {selectedPostIds.length > 0 && (
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0 h-12">
                        <button
                            type="button"
                            onClick={() => setFilterMode('all')}
                            className={`px-4 text-sm font-medium transition-all motion-interaction ${
                                filterMode === 'all'
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}>
                            전체
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMode('selected')}
                            className={`px-4 text-sm font-medium transition-all motion-interaction ${
                                filterMode === 'selected'
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}>
                            선택됨
                        </button>
                    </div>
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
                    iconClassName={filterMode === 'selected' ? 'fas fa-check-circle' : 'fas fa-search'}
                    title={filterMode === 'selected' ? '선택된 포스트가 없습니다' : '검색 결과가 없습니다'}
                    description={filterMode === 'selected' ? '아래 전체 목록에서 포스트를 선택해주세요.' : '다른 검색어로 다시 시도해주세요.'}
                    className="py-12"
                />
            ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto overflow-x-hidden">
                    {filteredPosts.map((post) => {
                        const isSelected = selectedPostIds.includes(post.id);
                        return (
                            <div
                                key={post.id}
                                onClick={() => togglePost(post.id)}
                                className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all motion-interaction active:bg-gray-100 w-full ${
                                    isSelected
                                        ? 'border-gray-300 bg-gray-50'
                                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}>
                                <div onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => togglePost(post.id)}
                                    />
                                </div>
                                <div className="flex-1 min-w-0 ml-3">
                                    <span className="text-sm font-medium text-gray-900 truncate block">
                                        {post.title}
                                    </span>
                                    {post.publishedDate && (
                                        <span className="text-xs text-gray-400 mt-0.5 block">
                                            {post.publishedDate}
                                        </span>
                                    )}
                                </div>
                                {isSelected && (
                                    <i className="fas fa-check text-xs text-gray-700 ml-2 shrink-0" />
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
