import { CommentItem } from './CommentItem';
import { EmptyState } from './EmptyState';
import type { Comment } from '~/lib/api/comments';

interface CommentListProps {
    comments: Comment[];
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

export const CommentList = ({
    comments,
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
}: CommentListProps) => {
    if (comments.length === 0) {
        return <EmptyState />;
    }

    return (
        <div className="space-y-2" role="list">
            {comments.map((comment) => (
                <CommentItem
                    key={comment.id}
                    comment={comment}
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
    );
};
