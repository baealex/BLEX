import type { Comment } from '~/lib/api/comments';

type CommentUpdater = (comment: Comment) => Comment;

export const updateCommentInTree = (
    comments: Comment[],
    commentId: number,
    updater: CommentUpdater
): Comment[] => {
    return comments.map((comment) => {
        if (comment.id === commentId) {
            return updater(comment);
        }

        if (!comment.replies?.length) {
            return comment;
        }

        return {
            ...comment,
            replies: updateCommentInTree(comment.replies, commentId, updater)
        };
    });
};

export const mergeCommentInTree = (
    comments: Comment[],
    updatedComment: Comment
): Comment[] => {
    return updateCommentInTree(comments, updatedComment.id, (comment) => ({
        ...comment,
        ...updatedComment,
        replies: updatedComment.replies ?? comment.replies
    }));
};

export const appendCommentToTree = (
    comments: Comment[],
    createdComment: Comment
): Comment[] => {
    if (!createdComment.parentId) {
        return [
            ...comments,
            {
                ...createdComment,
                replies: createdComment.replies ?? []
            }
        ];
    }

    return updateCommentInTree(comments, createdComment.parentId, (comment) => ({
        ...comment,
        replies: [
            ...(comment.replies ?? []),
            {
                ...createdComment,
                replies: createdComment.replies ?? []
            }
        ]
    }));
};

export const findRootParentId = (
    commentId: number,
    comments: Comment[]
): number => {
    for (const comment of comments) {
        if (comment.id === commentId) {
            return comment.id;
        }

        if (!comment.replies?.length) {
            continue;
        }

        if (comment.replies.some((reply) => reply.id === commentId)) {
            return comment.id;
        }
    }

    return commentId;
};
