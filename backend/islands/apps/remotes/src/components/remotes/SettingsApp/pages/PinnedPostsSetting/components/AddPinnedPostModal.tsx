import { useState, useMemo } from 'react';
import { Button, Modal } from '~/components/shared';
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
            title="글 고정하기"
            maxWidth="2xl">
            <div className="flex flex-col h-[70vh]">
                <div className="px-6 py-4 border-b border-gray-100 space-y-3">
                    <p className="text-sm text-gray-500">
                        프로필에 표시할 글을 선택하세요.
                    </p>
                    <div className="relative">
                        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="글 제목 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
                    {filteredPosts.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center justify-center h-full">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <i className="fas fa-search text-2xl text-gray-300" />
                            </div>
                            <p className="text-gray-900 font-medium text-lg mb-1">검색 결과가 없습니다</p>
                            <p className="text-gray-500">다른 검색어로 다시 시도해보세요.</p>
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
                                                ? 'border-black bg-white ring-1 ring-black shadow-md z-10'
                                                : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm'
                                        }`}>

                                        {/* Image */}
                                        {post.image ? (
                                            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-100">
                                                <img
                                                    src={getMediaPath(post.image)}
                                                    alt={post.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 border border-gray-100 text-gray-400">
                                                <i className="fas fa-file-alt text-xl" />
                                            </div>
                                        )}

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`font-bold text-lg truncate mb-1 ${isSelected ? 'text-black' : 'text-gray-900'}`}>
                                                {post.title}
                                            </h4>
                                            <p className="text-sm text-gray-500 flex items-center gap-2">
                                                <i className="far fa-calendar" />
                                                {new Date(post.createdDate).toLocaleDateString('ko-KR')}
                                            </p>
                                        </div>

                                        {/* Check Icon */}
                                        <div
                                            className={`absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                                            isSelected
                                                ? 'border-black bg-black text-white scale-100 opacity-100'
                                                : 'border-gray-300 bg-white text-transparent group-hover:border-gray-400'
                                        }`}>
                                            <i className="fas fa-check text-xs" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 flex items-center justify-end bg-white gap-3">
                    <Button variant="secondary" size="lg" onClick={handleClose}>
                        취소
                    </Button>
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={handleAdd}
                        disabled={!selectedPost || isLoading}
                        className="px-8">
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <i className="fas fa-spinner fa-spin" />
                                추가 중...
                            </span>
                        ) : (
                            '고정하기'
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
