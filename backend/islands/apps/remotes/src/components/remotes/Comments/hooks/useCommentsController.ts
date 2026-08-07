import { useRef, useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useConfirm } from '~/hooks/useConfirm';
import {
    createComment,
    deleteComment as deleteCommentAPI,
    getComment,
    getCommentAuthors,
    getComments,
    toggleCommentLike,
    updateComment,
    type Comment
} from '~/lib/api';
import { toast } from '~/utils/toast';
import { logger } from '~/utils/logger';
import type { LoginPromptAction } from '~/utils/loginPrompt';
import {
    appendCommentToTree,
    findRootParentId,
    mergeCommentInTree,
    updateCommentInTree
} from '../utils/commentTree';
import { buildReplySubmissionText } from '../utils/replyText';

interface CommentsData {
    comments: Comment[];
    canComment: boolean;
}

interface UseCommentsControllerOptions {
    postUrl: string;
    isLoggedIn: boolean;
    onRequireLogin: (action: LoginPromptAction) => void;
}

const getCommentsQueryKey = (postUrl: string) => [postUrl, 'comments'] as const;

const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof AxiosError && error.response?.data?.errorMessage) {
        return error.response.data.errorMessage;
    }
    return fallback;
};

export const useCommentsController = ({
    postUrl,
    isLoggedIn,
    onRequireLogin
}: UseCommentsControllerOptions) => {
    const { t } = useLingui();
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const commentListRef = useRef<HTMLDivElement>(null);

    const [commentText, setCommentText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editText, setEditText] = useState('');
    const [replyingToCommentId, setReplyingToCommentId] = useState<number | null>(null);
    const [replyText, setReplyText] = useState('');
    const [replyParentId, setReplyParentId] = useState<number | null>(null);
    const [replyTargetAuthor, setReplyTargetAuthor] = useState<string | null>(null);

    const queryKey = getCommentsQueryKey(postUrl);
    const commentsQuery = useQuery({
        queryKey,
        queryFn: async () => {
            const response = await getComments(postUrl);
            if (response.data.status === 'ERROR') {
                throw new Error(response.data.errorMessage);
            }
            return response.data.body;
        },
        enabled: !!postUrl
    });

    const comments = commentsQuery.data?.comments ?? [];
    const canComment = commentsQuery.data?.canComment ?? true;
    const mentionableUsers = getCommentAuthors(comments);

    const updateComments = (updater: (comments: Comment[]) => Comment[]) => {
        queryClient.setQueryData<CommentsData>(queryKey, (currentData) => {
            if (!currentData) {
                return currentData;
            }

            return {
                ...currentData,
                comments: updater(currentData.comments)
            };
        });
    };

    const scrollToLatestComment = () => {
        setTimeout(() => {
            const commentList = commentListRef.current;
            if (!commentList) return;

            const renderedComments = commentList.querySelectorAll('[data-comment-id]');
            const lastComment = renderedComments[renderedComments.length - 1];
            lastComment?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }, 300);
    };

    const handleLike = async (commentId: number) => {
        if (!isLoggedIn) {
            onRequireLogin('like');
            return;
        }

        try {
            const response = await toggleCommentLike(commentId);

            if (response.data.status === 'DONE') {
                const likeState = response.data.body;
                updateComments((currentComments) => updateCommentInTree(
                    currentComments,
                    commentId,
                    (comment) => ({
                        ...comment,
                        isLiked: likeState.isLiked,
                        countLikes: likeState.countLikes
                    })
                ));
                return;
            }

            toast.error(response.data.errorMessage || t({
                id: 'comments.like.failed',
                message: 'Could not update this like.'
            }));
        } catch (error) {
            toast.error(getErrorMessage(error, t({
                id: 'comments.like.error',
                message: 'Something went wrong while updating this like.'
            })));
        }
    };

    const handleWrite = async () => {
        if (!isLoggedIn) {
            onRequireLogin('comment');
            return;
        }

        if (!commentText.trim()) {
            toast.error(t({
                id: 'comments.validation.comment_required',
                message: 'Enter a comment.'
            }));
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await createComment(postUrl, commentText);

            if (response.data.status === 'DONE') {
                const createdComment = response.data.body;
                setCommentText('');
                updateComments((currentComments) => appendCommentToTree(
                    currentComments,
                    createdComment
                ));
                scrollToLatestComment();
                toast.success(t({
                    id: 'comments.create.success',
                    message: 'Comment posted.'
                }));
                return;
            }

            toast.error(response.data.errorMessage || t({
                id: 'comments.create.failed',
                message: 'Could not post the comment.'
            }));
        } catch (error) {
            toast.error(getErrorMessage(error, t({
                id: 'comments.create.error',
                message: 'Something went wrong while posting the comment.'
            })));
        } finally {
            setIsSubmitting(false);
        }
    };

    const startEditing = async (commentId: number) => {
        try {
            const { data } = await getComment(commentId);

            if (data.status === 'DONE') {
                setEditingCommentId(commentId);
                setEditText(data.body.textMd || '');
                return;
            }

            toast.error(data.errorMessage || t({
                id: 'comments.edit.load_failed',
                message: 'Could not load the comment.'
            }));
        } catch (error) {
            logger.error('Failed to load comment for editing:', error);
            toast.error(t({
                id: 'comments.edit.load_error',
                message: 'Something went wrong while loading the comment.'
            }));
        }
    };

    const cancelEditing = () => {
        setEditingCommentId(null);
        setEditText('');
    };

    const saveEdit = async (commentId: number) => {
        if (!editText.trim()) {
            toast.error(t({
                id: 'comments.validation.comment_required',
                message: 'Enter a comment.'
            }));
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await updateComment(commentId, editText);

            if (response.data.status === 'DONE') {
                setEditingCommentId(null);
                setEditText('');
                await commentsQuery.refetch();
                toast.success(t({
                    id: 'comments.edit.success',
                    message: 'Comment updated.'
                }));
                return;
            }

            toast.error(response.data.errorMessage || t({
                id: 'comments.edit.failed',
                message: 'Could not update the comment.'
            }));
        } catch (error) {
            toast.error(getErrorMessage(error, t({
                id: 'comments.edit.error',
                message: 'Something went wrong while updating the comment.'
            })));
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteComment = async (commentId: number) => {
        const confirmed = await confirm({
            title: t({
                id: 'comments.delete.title',
                message: 'Delete comment'
            }),
            message: t({
                id: 'comments.delete.confirm',
                message: 'Delete this comment?'
            }),
            confirmText: t({
                id: 'common.delete',
                message: 'Delete'
            }),
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const response = await deleteCommentAPI(commentId);

            if (response.data.status === 'DONE') {
                const deletedComment = response.data.body;
                updateComments((currentComments) => mergeCommentInTree(
                    currentComments,
                    deletedComment
                ));
                toast.success(t({
                    id: 'comments.delete.success',
                    message: 'Comment deleted.'
                }));
                return;
            }

            toast.error(response.data.errorMessage || t({
                id: 'comments.delete.failed',
                message: 'Could not delete the comment.'
            }));
        } catch (error) {
            toast.error(getErrorMessage(error, t({
                id: 'comments.delete.error',
                message: 'Something went wrong while deleting the comment.'
            })));
        }
    };

    const startReplying = (commentId: number, authorUsername: string) => {
        if (!isLoggedIn) {
            onRequireLogin('reply');
            return;
        }

        setReplyingToCommentId(commentId);
        setReplyParentId(findRootParentId(commentId, comments));
        setReplyTargetAuthor(authorUsername);
        setReplyText('');
    };

    const cancelReplying = () => {
        setReplyingToCommentId(null);
        setReplyText('');
        setReplyParentId(null);
        setReplyTargetAuthor(null);
    };

    const getReplySubmissionText = () => {
        return buildReplySubmissionText(replyText, replyTargetAuthor);
    };

    const handleReply = async () => {
        if (!isLoggedIn) {
            onRequireLogin('reply');
            return;
        }

        if (!replyText.trim()) {
            toast.error(t({
                id: 'comments.validation.reply_required',
                message: 'Enter a reply.'
            }));
            return;
        }

        if (!replyParentId) {
            toast.error(t({
                id: 'comments.reply.parent_missing',
                message: 'Could not find the comment to reply to.'
            }));
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await createComment(postUrl, getReplySubmissionText(), replyParentId);

            if (response.data.status === 'DONE') {
                const createdReply = response.data.body;
                setReplyText('');
                setReplyingToCommentId(null);
                setReplyParentId(null);
                setReplyTargetAuthor(null);
                updateComments((currentComments) => appendCommentToTree(
                    currentComments,
                    createdReply
                ));
                scrollToLatestComment();
                toast.success(t({
                    id: 'comments.reply.success',
                    message: 'Reply posted.'
                }));
                return;
            }

            toast.error(response.data.errorMessage || t({
                id: 'comments.reply.failed',
                message: 'Could not post the reply.'
            }));
        } catch (error) {
            toast.error(getErrorMessage(error, t({
                id: 'comments.reply.error',
                message: 'Something went wrong while posting the reply.'
            })));
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        comments,
        canComment,
        mentionableUsers,
        commentListRef,
        isError: commentsQuery.isError,
        isLoading: commentsQuery.isLoading,
        refetch: commentsQuery.refetch,
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
    };
};
