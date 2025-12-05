import { CommentHeader } from './CommentHeader';
import { CommentContent } from './CommentContent';
import { CommentActions } from './CommentActions';
import { CommentEditForm } from './CommentEditForm';
import { CommentForm } from './CommentForm';
import type { Comment } from '~/lib/api/comments';

interface CommentItemProps {
    comment: Comment;
    currentUser: string | undefined;
    editingCommentId: number | null;
    editText: string;
    isSubmitting: boolean;
    replyingToId: number | null;
    replyText: string;
    onLike: (commentId: number) => void;
    onEdit: (commentId: number) => void;
    onDelete: (commentId: number) => void;
    onEditTextChange: (text: string) => void;
    onSaveEdit: (commentId: number) => void;
    onCancelEdit: () => void;
    onReply: (commentId: number) => void;
    onReplyTextChange: (text: string) => void;
    onSendReply: (commentId: number) => void;
    onCancelReply: () => void;
    depth?: number;
}

export const CommentItem = ({
    comment,
    currentUser,
    editingCommentId,
    editText,
    isSubmitting,
    replyingToId,
    replyText,
    onLike,
    onEdit,
    onDelete,
    onEditTextChange,
    onSaveEdit,
    onCancelEdit,
    onReply,
    onReplyTextChange,
    onSendReply,
    onCancelReply,
    depth = 0
}: CommentItemProps) => {
    const isEditing = editingCommentId === comment.pk;
    const isReplying = replyingToId === comment.pk;
    const isReply = depth > 0;

    return (
        <div className={isReply ? 'ml-8 sm:ml-12' : ''}>
            <article
                className={`py-4 px-4 ${isReply ? 'bg-gray-50/50' : 'bg-gray-50/30'} hover:bg-gray-50 rounded-xl transition-colors duration-200 ${isReply ? 'border-l-2 border-gray-300' : ''}`}
                aria-label={`${comment.author}의 ${isReply ? '답글' : '댓글'}`}>
                <CommentHeader
                    author={comment.author}
                    authorImage={comment.authorImage}
                    createdDate={comment.createdDate}
                    isEdited={comment.isEdited}
                />

                <div className="mt-3 ml-0 sm:ml-12">
                    {isEditing ? (
                        <CommentEditForm
                            editText={editText}
                            onEditTextChange={onEditTextChange}
                            onSave={() => onSaveEdit(comment.pk)}
                            onCancel={onCancelEdit}
                            isSubmitting={isSubmitting}
                        />
                    ) : (
                        <>
                            <CommentContent renderedContent={comment.textHtml} />
                            <CommentActions
                                commentId={comment.pk}
                                commentAuthor={comment.author}
                                currentUser={currentUser}
                                isLiked={comment.hasLiked}
                                countLikes={comment.countLikes}
                                onLike={onLike}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onReply={onReply}
                                showReplyButton={!isReply}
                            />
                        </>
                    )}
                </div>

                {/* 답글 작성 폼 */}
                {isReplying && (
                    <div className="mt-4 ml-0 sm:ml-12 p-4 bg-white rounded-lg border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">답글 작성</h4>
                        <CommentForm
                            isLoggedIn={!!currentUser}
                            commentText={replyText}
                            onCommentTextChange={onReplyTextChange}
                            onSubmit={() => onSendReply(comment.pk)}
                            isSubmitting={isSubmitting}
                            onShowLoginPrompt={() => {}}
                            placeholder="답글을 입력하세요..."
                        />
                        <button
                            onClick={onCancelReply}
                            className="mt-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                            취소
                        </button>
                    </div>
                )}
            </article>

            {/* 대댓글 목록 */}
            {comment.replies && comment.replies.length > 0 && (
                <div className="mt-2 space-y-2">
                    {comment.replies.map((reply) => (
                        <CommentItem
                            key={reply.pk}
                            comment={reply}
                            currentUser={currentUser}
                            editingCommentId={editingCommentId}
                            editText={editText}
                            isSubmitting={isSubmitting}
                            replyingToId={replyingToId}
                            replyText={replyText}
                            onLike={onLike}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onEditTextChange={onEditTextChange}
                            onSaveEdit={onSaveEdit}
                            onCancelEdit={onCancelEdit}
                            onReply={onReply}
                            onReplyTextChange={onReplyTextChange}
                            onSendReply={onSendReply}
                            onCancelReply={onCancelReply}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
