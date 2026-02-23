import { ThumbsUp, Reply } from '@blex/ui';

interface CommentActionsProps {
    commentId: number;
    isLiked: boolean;
    countLikes: number;
    isDeleted: boolean;
    onLike: (commentId: number) => void;
    onReply?: () => void;
}

export const CommentActions = ({
    commentId,
    isLiked,
    countLikes,
    isDeleted,
    onLike,
    onReply
}: CommentActionsProps) => {
    return (
        <div className="flex items-center gap-1 mt-4 flex-wrap">
            {!isDeleted && (
                <button
                    className={`
                        inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md
                        text-xs font-semibold transition-colors duration-150
                        ${isLiked
                            ? 'bg-action text-content-inverted hover:bg-action-hover'
                            : 'text-content-secondary hover:text-content hover:bg-surface-subtle'
                        }
                    `}
                    onClick={() => onLike(commentId)}
                    aria-label={isLiked ? '좋아요 취소' : '좋아요'}
                    aria-pressed={isLiked}>
                    <ThumbsUp
                        className={`w-4 h-4 ${isLiked ? 'fill-content-inverted' : ''}`}
                        aria-hidden="true"
                    />
                    {countLikes > 0 && <span>{countLikes}</span>}
                </button>
            )}

            {!isDeleted && onReply && (
                <button
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-content-secondary hover:text-content hover:bg-surface-subtle transition-colors duration-150"
                    onClick={onReply}
                    aria-label="답글 작성">
                    <Reply className="w-4 h-4" />
                    답글
                </button>
            )}

        </div>
    );
};
