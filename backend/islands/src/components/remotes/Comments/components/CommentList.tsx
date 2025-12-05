import { CommentItem } from './CommentItem';
import { EmptyState } from './EmptyState';
import type { Comment } from '~/lib/api/comments';

interface CommentListProps {
    comments: Comment[];
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
}

export const CommentList = ({
    comments,
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
    onCancelReply
}: CommentListProps) => {
    if (comments.length === 0) {
        return <EmptyState />;
    }

    return (
        <div className="space-y-4" role="list">
            {comments.map((comment) => (
                <CommentItem
                    key={comment.pk}
                    comment={comment}
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
                />
            ))}
        </div>
    );
};
