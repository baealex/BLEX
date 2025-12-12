import { useRef, useEffect } from 'react';

interface CommentFormProps {
    isLoggedIn: boolean;
    commentText: string;
    onCommentTextChange: (text: string) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    onShowLoginPrompt: () => void;
}

export const CommentForm = ({
    isLoggedIn,
    commentText,
    onCommentTextChange,
    onSubmit,
    isSubmitting,
    onShowLoginPrompt
}: CommentFormProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [commentText]);

    if (!isLoggedIn) {
        return (
            <div className="relative group cursor-pointer" onClick={onShowLoginPrompt}>
                <textarea
                    className="w-full p-5 border border-gray-200 rounded-2xl resize-none bg-gray-50/50 text-sm placeholder-gray-400 pointer-events-none transition-all duration-200 group-hover:border-gray-300 group-hover:bg-white"
                    placeholder="댓글을 작성해보세요..."
                    rows={4}
                    disabled
                    aria-hidden="true"
                />

                {/* Hover 시 나타나는 안내 */}
                <div className="absolute inset-0 flex items-center justify-center bg-white/0 group-hover:bg-white/60 backdrop-blur-0 group-hover:backdrop-blur-sm transition-all duration-300 rounded-2xl pointer-events-none">
                    <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-y-0 translate-y-2 text-center px-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/80 text-white rounded-full text-sm font-medium shadow-lg backdrop-blur-md">
                            <i className="fas fa-lock text-xs" />
                            <span>로그인이 필요합니다</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    className="w-full p-5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black resize-none bg-white transition-all duration-200 placeholder-gray-400 text-sm hover:border-gray-300 leading-relaxed"
                    value={commentText}
                    onChange={(e) => onCommentTextChange(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="댓글을 작성해보세요..."
                    rows={4}
                    aria-label="댓글 내용"
                />
            </div>

            <div className="flex justify-end">
                <button
                    className="px-6 py-2.5 bg-black hover:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-xl text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed hover:-translate-y-0.5 active:scale-95"
                    onClick={onSubmit}
                    disabled={isSubmitting || !commentText.trim()}
                    aria-label={isSubmitting ? '댓글 작성 중' : '댓글 작성하기'}>
                    {isSubmitting ? (
                        <span className="flex items-center gap-2">
                            <i className="fas fa-spinner fa-spin text-xs" />
                            <span>작성 중...</span>
                        </span>
                    ) : '댓글 작성'}
                </button>
            </div>
        </div>
    );
};
