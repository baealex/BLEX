import { AlertTriangle, RotateCw } from '@blex/ui/icons';
import { isLoggedIn as checkIsLoggedIn, showLoginPrompt } from '~/utils/loginPrompt';
import { CommentList } from './components/CommentList';
import { CommentForm } from './components/CommentForm';
import { useCommentsController } from './hooks/useCommentsController';
import type { Comment } from '~/lib/api/comments';

interface CommentsProps {
    postUrl: string;
}

const countComments = (comments: Comment[]): number => (
    comments.reduce((total, comment) => total + 1 + countComments(comment.replies ?? []), 0)
);

const CommentsHeader = ({ count }: { count?: number }) => (
    <div className="mb-6 flex items-start justify-between gap-4 border-b border-line-light pb-4">
        <div className="min-w-0">
            <h2 id="comments-heading" className="text-lg font-bold leading-snug text-content">
                댓글
            </h2>
        </div>
        {typeof count === 'number' && (
            <span className="shrink-0 text-sm font-medium leading-6 text-content-secondary">
                {count}개
            </span>
        )}
    </div>
);

const Comments = (props: CommentsProps) => {
    const { postUrl } = props;
    const isLoggedIn = checkIsLoggedIn();
    const {
        comments,
        mentionableUsers,
        commentListRef,
        isError,
        isLoading,
        refetch,
        commentText,
        setCommentText,
        isSubmitting,
        editingCommentId,
        editText,
        setEditText,
        replyingToCommentId,
        replyText,
        setReplyText,
        handleLike,
        handleWrite,
        startEditing,
        cancelEditing,
        saveEdit,
        deleteComment,
        startReplying,
        cancelReplying,
        handleReply
    } = useCommentsController({
        postUrl,
        isLoggedIn,
        onRequireLogin: showLoginPrompt
    });

    if (isError) {
        return (
            <section className="mt-16 mb-16 bg-surface rounded-2xl p-6 ring-1 ring-line/60 sm:p-8" aria-labelledby="comments-heading">
                <CommentsHeader />
                <div className="text-center py-12 bg-danger-surface border border-danger-line rounded-xl">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-danger-surface rounded-full mb-4">
                        <AlertTriangle className="w-8 h-8 text-danger" />
                    </div>
                    <h3 className="text-lg font-semibold text-content mb-2">
                        댓글을 불러올 수 없습니다
                    </h3>
                    <p className="text-content-secondary text-sm mb-4">
                        잠시 후 다시 시도해 주세요.
                    </p>
                    <button
                        onClick={() => refetch()}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-action text-content-inverted rounded-lg text-sm font-medium hover:bg-action-hover transition-colors active:scale-95">
                        <RotateCw className="w-3.5 h-3.5" />
                        다시 시도
                    </button>
                </div>
            </section>
        );
    }

    if (isLoading) {
        return (
            <section className="mt-16 mb-16 bg-surface rounded-2xl p-6 ring-1 ring-line/60 sm:p-8" aria-labelledby="comments-heading">
                <CommentsHeader />
                <div className="flex items-center justify-center py-16">
                    <div className="text-center space-y-4">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-line border-t-action" />
                        <p className="text-content-secondary text-sm font-medium">댓글을 불러오는 중...</p>
                    </div>
                </div>
            </section>
        );
    }

    const commentCount = countComments(comments);

    return (
        <section className="mt-16 mb-16 bg-surface rounded-2xl p-6 ring-1 ring-line/60 sm:p-8" aria-labelledby="comments-heading">
            <CommentsHeader count={commentCount} />
            <div ref={commentListRef}>
                <CommentList
                    comments={comments}
                    isLoggedIn={isLoggedIn}
                    editingCommentId={editingCommentId}
                    editText={editText}
                    isSubmitting={isSubmitting}
                    replyingToCommentId={replyingToCommentId}
                    replyText={replyText}
                    mentionableUsers={mentionableUsers}
                    onLike={handleLike}
                    onEdit={startEditing}
                    onDelete={deleteComment}
                    onEditTextChange={setEditText}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEditing}
                    onReply={startReplying}
                    onReplyTextChange={setReplyText}
                    onSaveReply={handleReply}
                    onCancelReply={cancelReplying}
                />
            </div>

            <div className="border-t border-line-light pt-8 mt-8">
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-content-secondary">
                        댓글 남기기
                    </h3>
                </div>

                <CommentForm
                    isLoggedIn={isLoggedIn}
                    commentText={commentText}
                    onCommentTextChange={setCommentText}
                    onSubmit={handleWrite}
                    isSubmitting={isSubmitting}
                    onShowLoginPrompt={() => showLoginPrompt('댓글 작성')}
                    mentionableUsers={mentionableUsers}
                />
            </div>
        </section>
    );
};

export default Comments;
