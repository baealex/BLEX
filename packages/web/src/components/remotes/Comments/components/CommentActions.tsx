import { Trans, useLingui } from '@lingui/react/macro';
import { Heart, Reply } from '@blex/ui/icons';
import type { CommentPermissions } from '~/lib/api/comments';

interface CommentActionsProps {
    commentId: number;
    isLiked: boolean;
    countLikes: number;
    isDeleted: boolean;
    isLoggedIn: boolean;
    permissions: CommentPermissions;
    onLike: (commentId: number) => void;
    onReply?: () => void;
}

export const CommentActions = ({
    commentId,
    isLiked,
    countLikes,
    isDeleted,
    isLoggedIn,
    permissions,
    onLike,
    onReply
}: CommentActionsProps) => {
    const { i18n, t } = useLingui();
    const showLikeAction = !isDeleted && (permissions.canLike || !isLoggedIn);
    const showLikeCount = !isDeleted && !showLikeAction && countLikes > 0;
    const showReply = !isDeleted && !!onReply && (permissions.canReply || !isLoggedIn);

    if (!showLikeAction && !showLikeCount && !showReply) {
        return null;
    }

    return (
        <div className="flex items-center gap-1 mt-4 flex-wrap">
            {showLikeAction && (
                <button
                    className={`
                        inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md
                        text-xs font-semibold transition-colors duration-150
                        ${isLiked
                            ? 'bg-danger-surface text-danger ring-1 ring-danger-line hover:bg-danger-surface'
                            : 'text-content-secondary hover:text-content hover:bg-surface-subtle'
                        }
                    `}
                    onClick={() => onLike(commentId)}
                    aria-label={isLiked
                        ? t({
                            id: 'comments.like.remove',
                            message: 'Remove like'
                        })
                        : t({
                            id: 'comments.like.add',
                            message: 'Like'
                        })}
                    aria-pressed={isLiked}>
                    <Heart
                        className={`w-4 h-4 ${isLiked ? 'fill-danger' : ''}`}
                        aria-hidden="true"
                    />
                    {countLikes > 0 && <span>{countLikes}</span>}
                </button>
            )}

            {showLikeCount && (
                <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-content-secondary"
                    aria-label={i18n._({
                        id: 'comments.like.count',
                        message: '{count, plural, one {# like} other {# likes}}',
                        values: { count: countLikes }
                    })}>
                    <Heart className="w-4 h-4" aria-hidden="true" />
                    <span>{countLikes}</span>
                </span>
            )}

            {showReply && (
                <button
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-content-secondary hover:text-content hover:bg-surface-subtle transition-colors duration-150"
                    onClick={onReply}
                    aria-label={t({
                        id: 'comments.reply.submit',
                        message: 'Post reply'
                    })}>
                    <Reply className="w-4 h-4" />
                    <Trans id="comments.reply.action">Reply</Trans>
                </button>
            )}

        </div>
    );
};
