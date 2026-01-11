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
        <div className="flex items-center gap-3 mt-3">
            {!isDeleted && (
                <button
                    className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                    isLiked
                        ? 'text-gray-900'
                        : 'text-gray-600 hover:text-gray-900'
                }`}
                    onClick={() => onLike(commentId)}
                    aria-label={isLiked ? '좋아요 취소' : '좋아요'}
                    aria-pressed={isLiked}>
                    <svg
                        className={`w-4 h-4 ${isLiked ? 'fill-gray-900' : 'fill-none stroke-current'}`}
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
                    className="text-xs text-gray-600 hover:text-gray-900 font-medium"
                    onClick={onReply}
                    aria-label="답글 작성">
                    답글
                </button>
            )}

            {isOwner && (
                <>
                    <button
                        className="text-xs text-gray-600 hover:text-gray-900 font-medium"
                        onClick={() => onEdit(commentId)}
                        aria-label="댓글 수정">
                        수정
                    </button>
                    <button
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                        onClick={() => onDelete(commentId)}
                        aria-label="댓글 삭제">
                        삭제
                    </button>
                </>
            )}
        </div>
    );
};
