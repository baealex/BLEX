import { AlertTriangle, MessageCircle, RotateCw } from '@blex/ui/icons';
import { isLoggedIn as checkIsLoggedIn, showLoginPrompt } from '~/utils/loginPrompt';
import { CommentList } from './components/CommentList';
import { CommentForm } from './components/CommentForm';
import { useCommentsController } from './hooks/useCommentsController';

interface CommentsProps {
    postUrl: string;
}

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
            <div className="text-center py-12 bg-danger-surface border border-danger-line rounded-2xl">
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
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="text-center space-y-4">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-line border-t-action" />
                    <p className="text-content-secondary text-sm font-medium">댓글을 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
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
                <div className="flex items-center gap-3 mb-6">
                    <MessageCircle className="w-5 h-5 text-content" />
                    <h2 className="text-lg font-bold text-content">
                        댓글 남기기
                    </h2>
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
        </div>
    );
};

export default Comments;
