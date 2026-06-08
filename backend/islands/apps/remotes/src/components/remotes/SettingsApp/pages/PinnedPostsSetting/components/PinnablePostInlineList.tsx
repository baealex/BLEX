import {
    Button,
    SUBTITLE,
    TITLE,
    getIconClass
} from '~/components/shared';
import SettingsListItem from '../../../components/SettingsListItem';
import { getMediaPath } from '~/modules/static.module';
import type { PinnablePostData, PinnablePostsPaginationData } from '~/lib/api/settings';
import { PinnablePostsPager } from './PinnablePostsPager';

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
    const isActionDisabled = !canAddMore || isAdding || isLoading;

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-content">고정 가능한 포스트</h4>
                    <p className="text-xs text-content-secondary">
                        오른쪽의 고정 버튼을 누르면 바로 프로필에 추가됩니다.
                    </p>
                </div>
                <div className="relative w-full sm:w-72">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-content-hint" />
                    <input
                        type="text"
                        aria-label="고정 가능한 포스트 검색"
                        placeholder="포스트 검색"
                        value={searchQuery}
                        onChange={(event) => onSearchQueryChange(event.target.value)}
                        className="h-11 w-full rounded-lg border border-line bg-surface-subtle pl-9 pr-3 text-sm text-content transition-colors duration-150 placeholder:text-content-hint focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-line/50"
                    />
                </div>
            </div>

            {!canAddMore && (
                <div className="rounded-xl border border-line bg-surface-subtle px-4 py-3 text-sm text-content-secondary">
                    고정 가능한 최대 개수에 도달했습니다. 새 포스트를 고정하려면 기존 고정을 먼저 해제하세요.
                </div>
            )}

            {isLoading && posts.length === 0 ? (
                <div className="space-y-3" aria-label="고정 가능한 포스트를 불러오는 중">
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
                    {searchQuery.trim() ? '검색 결과가 없습니다.' : '더 고정할 수 있는 포스트가 없습니다.'}
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
                                        <div className={`${getIconClass('default')} overflow-hidden`}>
                                            <img
                                                src={getMediaPath(post.image)}
                                                alt={post.title}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className={getIconClass('default')}>
                                            <i className="fas fa-file-alt text-sm" />
                                        </div>
                                    )
                                }
                                actions={
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onAdd(post.url)}
                                        disabled={isActionDisabled || isLoading}
                                        isLoading={isLoading}>
                                        고정
                                    </Button>
                                }>
                                <h3 className={`${TITLE} mb-1 truncate text-content`}>{post.title}</h3>
                                <div className={`${SUBTITLE} flex items-center gap-2 text-xs`}>
                                    <span className="flex items-center gap-1">
                                        <i className="far fa-calendar text-content-hint" />
                                        {new Date(post.createdDate).toLocaleDateString('ko-KR')}
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
