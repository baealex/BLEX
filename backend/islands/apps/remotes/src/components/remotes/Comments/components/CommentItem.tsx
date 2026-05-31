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
    const isEditing = editingCommentId === comment.id;
    const isReplying = replyingToCommentId === comment.id;
    const isReply = !!comment.parentId;
    const isDeleted = isCommentDeleted(comment);
    const permissions = resolveCommentPermissions(comment);
    const menuItems = [
        ...(permissions.canEdit ? [{
            label: '수정',
            icon: 'fas fa-pen',
            onClick: () => onEdit(comment.id)
        }] : []),
        ...(permissions.canDelete ? [{
            label: '삭제',
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
                    py-6 px-4 sm:px-6
                    bg-surface hover:bg-surface-subtle/50
                    transition-colors duration-200
                    ${isReply
                        ? 'ml-6 sm:ml-14 border-l-2 border-line pl-6 sm:pl-8'
                        : 'rounded-xl ring-1 ring-line/5'
                    }
                `}
                aria-label={`${comment.author}의 ${isReply ? '답글' : '댓글'}`}>
                {menuItems.length > 0 && !isEditing && (
                    <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                            trigger={(
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-md text-content-secondary hover:text-content hover:bg-surface-subtle transition-colors duration-150"
                                    aria-label="댓글 옵션 열기">
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

                <div className="mt-4 ml-0 sm:ml-14">
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
                <div className="mt-4 ml-6 sm:ml-14 pl-6 sm:pl-8 pt-4 border-l-2 border-line">
                    <div className="flex items-center gap-2 mb-3">
                        <Reply className="w-4 h-4 text-content-hint" />
                        <p className="text-sm text-content-secondary">
                            <span className="font-semibold text-content">{comment.author}</span>님에게 답글
                        </p>
                    </div>
                    <CommentForm
                        isLoggedIn={true}
                        commentText={replyText}
                        onCommentTextChange={onReplyTextChange}
                        onSubmit={onSaveReply}
                        isSubmitting={isSubmitting}
                        onShowLoginPrompt={() => {}}
                        placeholder="답글을 입력하세요..."
                        mentionableUsers={mentionableUsers}
                        onCancel={onCancelReply}
                        submitButtonText="답글 작성"
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
