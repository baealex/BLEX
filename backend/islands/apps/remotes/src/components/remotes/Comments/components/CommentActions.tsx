import { ThumbsUp, Reply, Pencil, Trash2 } from '@blex/ui';

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
                    <ThumbsUp
                        className={`w-4 h-4 ${isLiked ? 'fill-white' : ''}`}
                        aria-hidden="true"
                    />
                    {countLikes > 0 && <span>{countLikes}</span>}
                </button>
            )}

            {!isDeleted && onReply && (
                <button
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 hover:text-gray-900 transition-all duration-150"
                    onClick={onReply}
                    aria-label="답글 작성">
                    <Reply className="w-4 h-4" />
                    답글
                </button>
            )}

            {isOwner && (
                <>
                    <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 hover:text-gray-900 transition-all duration-150"
                        onClick={() => onEdit(commentId)}
                        aria-label="댓글 수정">
                        <Pencil className="w-4 h-4" />
                        수정
                    </button>
                    <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-all duration-150"
                        onClick={() => onDelete(commentId)}
                        aria-label="댓글 삭제">
                        <Trash2 className="w-4 h-4" />
                        삭제
                    </button>
                </>
            )}
        </div>
    );
};
