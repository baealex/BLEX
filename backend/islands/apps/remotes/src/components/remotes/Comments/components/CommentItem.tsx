import { useLingui } from '@lingui/react/macro';
import { Dropdown } from '@blex/ui/dropdown';
import { Reply } from '@blex/ui/icons';
import { CommentHeader } from './CommentHeader';
import { CommentContent } from './CommentContent';
import { CommentActions } from './CommentActions';
import { CommentEditForm } from './CommentEditForm';
import { CommentForm } from './CommentForm';
import {
    isCommentDeleted,
    resolveCommentPermissions,
    type Comment
} from '~/lib/api/comments';

interface CommentItemProps {
    comment: Comment;
    isLoggedIn: boolean;
    editingCommentId: number | null;
    editText: string;
    isSubmitting: boolean;
    replyingToCommentId: number | null;
    replyText: string;
    mentionableUsers: string[];
    onLike: (commentId: number) => void;
    onEdit: (commentId: number) => void;
    onDelete: (commentId: number) => void;
    onEditTextChange: (text: string) => void;
    onSaveEdit: (commentId: number) => void;
    onCancelEdit: () => void;
    onReply: (commentId: number, authorUsername: string) => void;
    onReplyTextChange: (text: string) => void;
    onSaveReply: () => void;
    onCancelReply: () => void;
}

export const CommentItem = ({
    comment,
    isLoggedIn,
    editingCommentId,
    editText,
    isSubmitting,
    replyingToCommentId,
    replyText,
    mentionableUsers,
    onLike,
    onEdit,
    onDelete,
    onEditTextChange,
    onSaveEdit,
    onCancelEdit,
    onReply,
    onReplyTextChange,
    onSaveReply,
    onCancelReply
}: CommentItemProps) => {
    const { i18n, t } = useLingui();
    const isEditing = editingCommentId === comment.id;
    const isReplying = replyingToCommentId === comment.id;
    const isReply = !!comment.parentId;
    const isDeleted = isCommentDeleted(comment);
    const permissions = resolveCommentPermissions(comment);
    const displayAuthor = isDeleted
        ? t({
            id: 'comments.deleted_author',
            message: 'Deleted user'
        })
        : comment.author;
    const menuItems = [
        ...(permissions.canEdit ? [{
            label: t({
                id: 'common.edit',
                message: 'Edit'
            }),
            icon: 'fas fa-pen',
            onClick: () => onEdit(comment.id)
        }] : []),
        ...(permissions.canDelete ? [{
            label: t({
                id: 'common.delete',
                message: 'Delete'
            }),
            icon: 'fas fa-trash',
            onClick: () => onDelete(comment.id),
            variant: 'danger' as const
        }] : [])
    ];

    return (
        <div className="group" data-comment-id={comment.id} role={isReply ? undefined : 'listitem'}>
            <article
                className={`
                    relative
                    py-6
                    transition-colors duration-200
                    ${isReply
                        ? 'ml-6 sm:ml-14 border-l border-line-light pl-6 sm:pl-8'
                        : ''
                    }
                `}
                aria-label={isReply
                    ? i18n._({
                        id: 'comments.reply_by_author',
                        message: 'Reply by {author}',
                        values: { author: displayAuthor }
                    })
                    : i18n._({
                        id: 'comments.comment_by_author',
                        message: 'Comment by {author}',
                        values: { author: displayAuthor }
                    })}>
                {menuItems.length > 0 && !isEditing && (
                    <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                            trigger={(
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-md text-content-secondary hover:text-content hover:bg-surface-subtle transition-colors duration-150"
                                    aria-label={t({
                                        id: 'comments.options.open',
                                        message: 'Open comment options'
                                    })}>
                                    <i className="fas fa-ellipsis-v text-sm" />
                                </button>
                            )}
                            items={menuItems}
                        />
                    </div>
                )}
                <CommentHeader
                    author={comment.author}
                    authorImage={comment.authorImage}
                    createdDate={comment.createdDate}
                    isEdited={comment.isEdited}
                    isDeleted={isDeleted}
                />

                <div className="mt-2 ml-0 sm:ml-14">
                    {isEditing ? (
                        <CommentEditForm
                            editText={editText}
                            onEditTextChange={onEditTextChange}
                            onSave={() => onSaveEdit(comment.id)}
                            onCancel={onCancelEdit}
                            isSubmitting={isSubmitting}
                        />
                    ) : (
                        <>
                            <CommentContent renderedContent={comment.renderedContent} />
                            <CommentActions
                                commentId={comment.id}
                                isLiked={comment.isLiked}
                                countLikes={comment.countLikes}
                                isDeleted={isDeleted}
                                isLoggedIn={isLoggedIn}
                                permissions={permissions}
                                onLike={onLike}
                                onReply={() => onReply(comment.id, comment.author)}
                            />
                        </>
                    )}
                </div>
            </article>

            {/* 답글 작성 폼 */}
            {isReplying && (
                <div className="mt-4 ml-6 sm:ml-14 pl-6 sm:pl-8 pt-4 border-l border-line-light">
                    <div className="flex items-center gap-2 mb-3">
                        <Reply className="w-4 h-4 text-content-hint" />
                        <p className="text-sm text-content-secondary">
                            {i18n._({
                                id: 'comments.replying_to',
                                message: 'Replying to {author}',
                                values: { author: comment.author }
                            })}
                        </p>
                    </div>
                    <CommentForm
                        isLoggedIn={true}
                        commentText={replyText}
                        onCommentTextChange={onReplyTextChange}
                        onSubmit={onSaveReply}
                        isSubmitting={isSubmitting}
                        onShowLoginPrompt={() => {}}
                        placeholder={t({
                            id: 'comments.reply.placeholder',
                            message: 'Write a reply...'
                        })}
                        mentionableUsers={mentionableUsers}
                        onCancel={onCancelReply}
                        submitButtonText={t({
                            id: 'comments.reply.submit',
                            message: 'Post reply'
                        })}
                    />
                </div>
            )}

            {/* 대댓글 렌더링 */}
            {!isReply && comment.replies && comment.replies.length > 0 && (
                <div className="mt-2">
                    {comment.replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            isLoggedIn={isLoggedIn}
                            editingCommentId={editingCommentId}
                            editText={editText}
                            isSubmitting={isSubmitting}
                            replyingToCommentId={replyingToCommentId}
                            replyText={replyText}
                            mentionableUsers={mentionableUsers}
                            onLike={onLike}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onEditTextChange={onEditTextChange}
                            onSaveEdit={onSaveEdit}
                            onCancelEdit={onCancelEdit}
                            onReply={onReply}
                            onReplyTextChange={onReplyTextChange}
                            onSaveReply={onSaveReply}
                            onCancelReply={onCancelReply}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
