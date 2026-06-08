import { useEffect, useState } from 'react';
import { Modal } from '~/components/shared';
import { getMediaPath } from '~/modules/static.module';
import type { PinnablePostData, PinnablePostsPaginationData } from '~/lib/api/settings';
import { PinnablePostsPager } from './PinnablePostsPager';

interface AddPinnedPostModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pinnablePosts: PinnablePostData[];
    searchQuery?: string;
    onSearchQueryChange?: (query: string) => void;
    pagination: PinnablePostsPaginationData;
    onPageChange: (page: number) => void;
    onAdd: (postUrl: string) => void;
    isLoading: boolean;
    isFetchingPosts?: boolean;
    presentation?: 'modal' | 'inline';
}

export const AddPinnedPostModal = ({
    open,
    onOpenChange,
    pinnablePosts,
    searchQuery = '',
    onSearchQueryChange,
    pagination,
    onPageChange,
    onAdd,
    isLoading,
    isFetchingPosts = false,
    presentation = 'modal'
}: AddPinnedPostModalProps) => {
    const [selectedPost, setSelectedPost] = useState<string | null>(null);

    useEffect(() => {
        setSelectedPost(null);
    }, [searchQuery]);

    const handleAdd = () => {
        if (selectedPost) {
            onAdd(selectedPost);
            setSelectedPost(null);
            onSearchQueryChange?.('');
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        setSelectedPost(null);
        onSearchQueryChange?.('');
    };

    const handlePageChange = (page: number) => {
        setSelectedPost(null);
        onPageChange(page);
    };

    const content = (
        <div className={`flex flex-col ${presentation === 'inline' ? 'max-h-[68vh] rounded-2xl border border-line bg-surface-elevated shadow-subtle' : 'h-[70vh]'}`}>
            {presentation === 'inline' && (
                <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold tracking-tight text-content">
                            고정할 포스트 선택
                        </h3>
                        <p className="text-sm text-content-secondary">
                            프로필에 보여줄 포스트를 하나 선택하세요.
                        </p>
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:bg-surface-subtle hover:text-content active:scale-95">
                            선택 취소
                        </button>
                    </div>
                </div>
            )}

            <div className={`space-y-3 border-b border-line ${presentation === 'inline' ? 'px-5 py-4' : 'px-6 py-4'}`}>
                {presentation === 'modal' && (
                    <p className="text-sm text-content-secondary">
                        프로필에 표시할 포스트를 선택하세요.
                    </p>
                )}
                <div className="relative">
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-content-hint" />
                    <input
                        type="text"
                        aria-label="고정할 포스트 검색"
                        placeholder="포스트 제목 검색..."
                        value={searchQuery}
                        onChange={(e) => onSearchQueryChange?.(e.target.value)}
                        className="w-full rounded-xl border border-line bg-surface-subtle py-3 pl-10 pr-4 transition-all focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-line/5"
                    />
                </div>
            </div>

            <div className={`flex-1 overflow-y-auto bg-surface-subtle/30 ${presentation === 'inline' ? 'min-h-0 px-4 py-4' : 'p-4'}`}>
                {isFetchingPosts && pinnablePosts.length === 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div
                                key={index}
                                className="animate-pulse rounded-xl border border-line bg-surface p-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-lg bg-surface-subtle" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="h-5 w-2/3 rounded bg-surface-subtle" />
                                        <div className="h-4 w-1/3 rounded bg-surface-subtle" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : pinnablePosts.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center py-20 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-subtle">
                            <i className="fas fa-search text-2xl text-content-hint" />
                        </div>
                        <p className="mb-1 text-lg font-medium text-content">검색 결과가 없습니다</p>
                        <p className="text-content-secondary">다른 검색어로 다시 시도해보세요.</p>
                    </div>
                ) : (
                    <div
                        className="grid grid-cols-1 gap-2"
                        role="radiogroup"
                        aria-label="고정할 포스트 선택">
                        {pinnablePosts.map((post) => {
                            const isSelected = selectedPost === post.url;
                            return (
                                <button
                                    key={post.url}
                                    type="button"
                                    role="radio"
                                    aria-checked={isSelected}
                                    aria-label={`고정할 포스트 선택: ${post.title}`}
                                    onClick={() => setSelectedPost(post.url)}
                                    className={`group relative flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-150 active:scale-[0.99] ${
                                        isSelected
                                            ? 'z-10 border-line-strong bg-surface shadow-subtle ring-1 ring-line-strong'
                                            : 'border-line bg-surface hover:border-line-strong hover:shadow-subtle'
                                    }`}>

                                    {post.image ? (
                                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-line bg-surface-subtle">
                                            <img
                                                src={getMediaPath(post.image)}
                                                alt={post.title}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-line bg-surface-subtle text-content-hint">
                                            <i className="fas fa-file-alt text-xl" />
                                        </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                        <h4 className="mb-1 truncate text-lg font-bold text-content">
                                            {post.title}
                                        </h4>
                                        <p className="flex items-center gap-2 text-sm text-content-secondary">
                                            <i className="far fa-calendar" />
                                            {new Date(post.createdDate).toLocaleDateString('ko-KR')}
                                        </p>
                                    </div>

                                    <div
                                        className={`absolute right-4 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border transition-all ${
                                        isSelected
                                            ? 'scale-100 border-line-strong bg-action text-content-inverted opacity-100'
                                            : 'border-line bg-surface text-transparent group-hover:border-line-strong'
                                    }`}>
                                        <i className="fas fa-check text-xs" />
                                    </div>
                                </button>
                            );
                        })}
                        <PinnablePostsPager
                            pagination={pagination}
                            onPageChange={handlePageChange}
                            isLoading={isFetchingPosts}
                        />
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-line bg-surface-subtle px-6 py-4">
                <Modal.FooterAction variant="secondary" onClick={handleClose}>
                    취소
                </Modal.FooterAction>
                <Modal.FooterAction
                    variant="primary"
                    onClick={handleAdd}
                    disabled={!selectedPost || isLoading}>
                    {isLoading ? (
                        <span className="flex items-center gap-2">
                            <i className="fas fa-spinner fa-spin" />
                            추가 중...
                        </span>
                    ) : (
                        '포스트 고정'
                    )}
                </Modal.FooterAction>
            </div>
        </div>
    );

    if (presentation === 'inline' && !open) {
        return null;
    }

    if (presentation === 'inline') {
        return content;
    }

    return (
        <Modal
            isOpen={open}
            onClose={handleClose}
            title="포스트 고정하기"
            maxWidth="2xl">
            {content}
        </Modal>
    );
};
