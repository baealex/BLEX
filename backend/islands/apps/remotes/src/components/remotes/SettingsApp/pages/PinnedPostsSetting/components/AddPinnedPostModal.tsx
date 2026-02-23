import { useState, useMemo } from 'react';
import { Modal } from '~/components/shared';
import { getMediaPath } from '~/modules/static.module';
import type { PinnablePostData } from '~/lib/api/settings';

interface AddPinnedPostModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pinnablePosts: PinnablePostData[];
    onAdd: (postUrl: string) => void;
    isLoading: boolean;
}

export const AddPinnedPostModal = ({
    open,
    onOpenChange,
    pinnablePosts,
    onAdd,
    isLoading
}: AddPinnedPostModalProps) => {
    const [selectedPost, setSelectedPost] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredPosts = useMemo(() => {
        if (!searchQuery.trim()) return pinnablePosts;
        const lowerQuery = searchQuery.toLowerCase();
        return pinnablePosts.filter(post =>
            post.title.toLowerCase().includes(lowerQuery)
        );
    }, [pinnablePosts, searchQuery]);

    const handleAdd = () => {
        if (selectedPost) {
            onAdd(selectedPost);
            setSelectedPost(null);
            setSearchQuery('');
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        setSelectedPost(null);
        setSearchQuery('');
    };

    return (
        <Modal
            isOpen={open}
            onClose={handleClose}
            title="포스트 고정하기"
            maxWidth="2xl">
            <div className="flex flex-col h-[70vh]">
                <div className="px-6 py-4 border-b border-line-light space-y-3">
                    <p className="text-sm text-content-secondary">
                        프로필에 표시할 포스트를 선택하세요.
                    </p>
                    <div className="relative">
                        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-content-hint" />
                        <input
                            type="text"
                            placeholder="포스트 제목 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-surface-subtle border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-line/5 focus:border-line-strong transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-surface-subtle/30">
                    {filteredPosts.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center justify-center h-full">
                            <div className="w-16 h-16 bg-surface-subtle rounded-full flex items-center justify-center mb-4">
                                <i className="fas fa-search text-2xl text-content-hint" />
                            </div>
                            <p className="text-content font-medium text-lg mb-1">검색 결과가 없습니다</p>
                            <p className="text-content-secondary">다른 검색어로 다시 시도해보세요.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            {filteredPosts.map((post) => {
                                const isSelected = selectedPost === post.url;
                                return (
                                    <button
                                        key={post.url}
                                        onClick={() => setSelectedPost(post.url)}
                                        className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group relative flex items-center gap-4 ${
                                            isSelected
                                                ? 'border-line-strong bg-surface ring-1 ring-line-strong shadow-md z-10'
                                                : 'border-line bg-surface hover:border-line-strong hover:shadow-sm'
                                        }`}>

                                        {/* Image */}
                                        {post.image ? (
                                            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-surface-subtle border border-line-light">
                                                <img
                                                    src={getMediaPath(post.image)}
                                                    alt={post.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 rounded-lg bg-surface-subtle flex items-center justify-center flex-shrink-0 border border-line-light text-content-hint">
                                                <i className="fas fa-file-alt text-xl" />
                                            </div>
                                        )}

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`font-bold text-lg truncate mb-1 ${isSelected ? 'text-content' : 'text-content'}`}>
                                                {post.title}
                                            </h4>
                                            <p className="text-sm text-content-secondary flex items-center gap-2">
                                                <i className="far fa-calendar" />
                                                {new Date(post.createdDate).toLocaleDateString('ko-KR')}
                                            </p>
                                        </div>

                                        {/* Check Icon */}
                                        <div
                                            className={`absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                                            isSelected
                                                ? 'border-line-strong bg-action text-content-inverted scale-100 opacity-100'
                                                : 'border-line bg-surface text-transparent group-hover:border-line-strong'
                                        }`}>
                                            <i className="fas fa-check text-xs" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <Modal.Footer>
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
                </Modal.Footer>
            </div>
        </Modal>
    );
};
