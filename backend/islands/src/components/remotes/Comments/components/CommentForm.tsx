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
                    className="w-full p-4 border border-solid border-gray-200 rounded-xl resize-none bg-white text-sm placeholder-gray-400 pointer-events-none transition-all duration-200 group-hover:border-gray-300"
                    placeholder="댓글을 작성해보세요..."
                    rows={4}
                    disabled
                    aria-hidden="true"
                />

                {/* Hover 시 나타나는 안내 */}
                <div className="absolute inset-0 flex items-center justify-center bg-white/0 group-hover:bg-white/95 backdrop-blur-0 group-hover:backdrop-blur-sm transition-all duration-200 rounded-xl pointer-events-none">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-center px-4">
                        <div className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                            </svg>
                            <span className="font-medium">댓글을 작성하려면 로그인이 필요해요</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    className="w-full p-4 border border-solid border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-gray-300 resize-none bg-white transition-all duration-200 placeholder-gray-400 text-sm hover:border-gray-300"
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
                    className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-lg text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-300"
                    onClick={onSubmit}
                    disabled={isSubmitting || !commentText.trim()}
                    aria-label={isSubmitting ? '댓글 작성 중' : '댓글 작성하기'}>
                    {isSubmitting ? '작성 중...' : '댓글 작성'}
                </button>
            </div>
        </div>
    );
};
