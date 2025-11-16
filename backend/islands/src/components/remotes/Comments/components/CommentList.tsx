import { CommentItem, type Comment } from './CommentItem';
import { EmptyState } from './EmptyState';

interface CommentListProps {
    comments: Comment[];
    currentUser: string | undefined;
    editingCommentId: number | null;
    editText: string;
    isSubmitting: boolean;
    onLike: (commentId: number) => void;
    onEdit: (commentId: number) => void;
    onDelete: (commentId: number) => void;
    onEditTextChange: (text: string) => void;
    onSaveEdit: (commentId: number) => void;
    onCancelEdit: () => void;
}

export const CommentList = ({
    comments,
    currentUser,
    editingCommentId,
    editText,
    isSubmitting,
    onLike,
    onEdit,
    onDelete,
    onEditTextChange,
    onSaveEdit,
    onCancelEdit
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
                    onLike={onLike}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onEditTextChange={onEditTextChange}
                    onSaveEdit={onSaveEdit}
                    onCancelEdit={onCancelEdit}
                />
            ))}
        </div>
    );
};
