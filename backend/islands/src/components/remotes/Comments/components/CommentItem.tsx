import { CommentHeader } from './CommentHeader';
import { CommentContent } from './CommentContent';
import { CommentActions } from './CommentActions';
import { CommentEditForm } from './CommentEditForm';
import type { Comment } from '~/lib/api/comments';

interface CommentItemProps {
    comment: Comment;
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

export const CommentItem = ({
    comment,
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
}: CommentItemProps) => {
    const isEditing = editingCommentId === comment.id;

    return (
        <article
            className="py-5 px-4 bg-gray-50/30 hover:bg-gray-50 rounded-xl transition-colors duration-200"
            aria-label={`${comment.author}의 댓글`}>
            <CommentHeader
                author={comment.author}
                authorImage={comment.authorImage}
                createdDate={comment.createdDate}
                isEdited={comment.isEdited}
            />

            <div className="mt-3.5 ml-0 sm:ml-12">
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
                            onLike={onLike}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    </>
                )}
            </div>
        </article>
    );
};
