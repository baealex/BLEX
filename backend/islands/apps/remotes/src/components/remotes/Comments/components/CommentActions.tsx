interface CommentActionsProps {
    commentId: number;
    commentAuthor: string;
    currentUser: string | undefined;
    isLiked: boolean;
    countLikes: number;
    onLike: (commentId: number) => void;
    onEdit: (commentId: number) => void;
    onDelete: (commentId: number) => void;
}

export const CommentActions = ({
    commentId,
    commentAuthor,
    currentUser,
    isLiked,
    countLikes,
    onLike,
    onEdit,
    onDelete
}: CommentActionsProps) => {
    const isOwner = currentUser === commentAuthor;

    return (
        <div className="flex items-center gap-2 mt-3">
            <button
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-200 ${
                    isLiked
                        ? 'bg-gray-900 text-white hover:bg-gray-800'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                onClick={() => onLike(commentId)}
                aria-label={isLiked ? '좋아요 취소' : '좋아요'}
                aria-pressed={isLiked}>
                <svg
                    className={`w-3.5 h-3.5 ${isLiked ? 'fill-white' : 'fill-none stroke-current stroke-2'}`}
                    viewBox="0 0 24 24"
                    aria-hidden="true">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
                {countLikes > 0 && <span>{countLikes}</span>}
            </button>

            {isOwner && (
                <>
                    <button
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-md transition-all duration-200 font-medium"
                        onClick={() => onEdit(commentId)}
                        aria-label="댓글 수정">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        수정
                    </button>
                    <button
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-red-700 bg-white hover:bg-red-50 border border-red-200 hover:border-red-300 rounded-md transition-all duration-200 font-medium"
                        onClick={() => onDelete(commentId)}
                        aria-label="댓글 삭제">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        삭제
                    </button>
                </>
            )}
        </div>
    );
};
