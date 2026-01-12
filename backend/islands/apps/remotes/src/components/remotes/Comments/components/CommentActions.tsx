interface CommentActionsProps {
    commentId: number;
    commentAuthor: string;
    currentUser: string | undefined;
    isLiked: boolean;
    countLikes: number;
    isDeleted: boolean;
    onLike: (commentId: number) => void;
    onEdit: (commentId: number) => void;
    onDelete: (commentId: number) => void;
    onReply?: () => void;
}

export const CommentActions = ({
    commentId,
    commentAuthor,
    currentUser,
    isLiked,
    countLikes,
    isDeleted,
    onLike,
    onEdit,
    onDelete,
    onReply
}: CommentActionsProps) => {
    const isOwner = currentUser === commentAuthor;

    return (
        <div className="flex items-center gap-1 mt-4">
            {!isDeleted && (
                <button
                    className={`
                        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                        text-xs font-semibold transition-all duration-150
                        ${isLiked
                            ? 'bg-gray-900 text-white hover:bg-gray-800'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                        }
                    `}
                    onClick={() => onLike(commentId)}
                    aria-label={isLiked ? '좋아요 취소' : '좋아요'}
                    aria-pressed={isLiked}>
                    <svg
                        className={`w-4 h-4 ${isLiked ? 'fill-white' : 'fill-none stroke-current'}`}
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        aria-hidden="true">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                    {countLikes > 0 && <span>{countLikes}</span>}
                </button>
            )}

            {!isDeleted && onReply && (
                <button
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 hover:text-gray-900 transition-all duration-150"
                    onClick={onReply}
                    aria-label="답글 작성">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    답글
                </button>
            )}

            {isOwner && (
                <>
                    <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 hover:text-gray-900 transition-all duration-150"
                        onClick={() => onEdit(commentId)}
                        aria-label="댓글 수정">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        수정
                    </button>
                    <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-all duration-150"
                        onClick={() => onDelete(commentId)}
                        aria-label="댓글 삭제">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        삭제
                    </button>
                </>
            )}
        </div>
    );
};
