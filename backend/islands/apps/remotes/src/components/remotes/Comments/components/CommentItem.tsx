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
    currentUser,
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

    return (
        <div className="group">
            <article
                className={`
                    py-6 px-4 sm:px-6
                    bg-white hover:bg-gray-50/50
                    transition-colors duration-200
                    ${isReply
                        ? 'ml-6 sm:ml-14 border-l-2 border-gray-200 pl-6 sm:pl-8'
                        : 'rounded-xl ring-1 ring-gray-900/5'
                    }
                `}
                aria-label={`${comment.author}의 ${isReply ? '답글' : '댓글'}`}>
                <CommentHeader
                    author={comment.author}
                    authorImage={comment.authorImage}
                    createdDate={comment.createdDate}
                    isEdited={comment.isEdited}
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
                                commentAuthor={comment.author}
                                currentUser={currentUser}
                                isLiked={comment.isLiked}
                                countLikes={comment.countLikes}
                                isDeleted={comment.author === 'Ghost'}
                                onLike={onLike}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onReply={() => onReply(comment.id, comment.author)}
                            />
                        </>
                    )}
                </div>
            </article>

            {/* 답글 작성 폼 */}
            {isReplying && (
                <div className="mt-4 ml-6 sm:ml-14 pl-6 sm:pl-8 pt-4 border-l-2 border-gray-300">
                    <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        <p className="text-sm text-gray-600">
                            <span className="font-semibold text-gray-900">{comment.author}</span>님에게 답글
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
                            currentUser={currentUser}
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
