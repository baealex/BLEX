import { useRef, useState } from 'react';
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
import {
    appendCommentToTree,
    findRootParentId,
    mergeCommentInTree,
    updateCommentInTree
} from '../utils/commentTree';

interface CommentsData {
    comments: Comment[];
}

interface UseCommentsControllerOptions {
    postUrl: string;
    isLoggedIn: boolean;
    onRequireLogin: (action: string) => void;
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
            onRequireLogin('좋아요');
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

            toast.error(response.data.errorMessage || '좋아요 처리에 실패했습니다.');
        } catch (error) {
            toast.error(getErrorMessage(error, '좋아요 처리 중 오류가 발생했습니다.'));
        }
    };

    const handleWrite = async () => {
        if (!isLoggedIn) {
            onRequireLogin('댓글 작성');
            return;
        }

        if (!commentText.trim()) {
            toast.error('댓글 내용을 입력해주세요.');
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
                toast.success('댓글이 작성되었습니다.');
                return;
            }

            toast.error(response.data.errorMessage || '댓글 작성에 실패했습니다.');
        } catch (error) {
            toast.error(getErrorMessage(error, '댓글 작성 중 오류가 발생했습니다.'));
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

            toast.error(data.errorMessage || '댓글 정보를 불러오는데 실패했습니다.');
        } catch (error) {
            logger.error('댓글 수정 오류:', error);
            toast.error('댓글 정보를 불러오는 중 오류가 발생했습니다.');
        }
    };

    const cancelEditing = () => {
        setEditingCommentId(null);
        setEditText('');
    };

    const saveEdit = async (commentId: number) => {
        if (!editText.trim()) {
            toast.error('댓글 내용을 입력해주세요.');
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await updateComment(commentId, editText);

            if (response.data.status === 'DONE') {
                setEditingCommentId(null);
                setEditText('');
                await commentsQuery.refetch();
                toast.success('댓글이 수정되었습니다.');
                return;
            }

            toast.error(response.data.errorMessage || '댓글 수정에 실패했습니다.');
        } catch (error) {
            toast.error(getErrorMessage(error, '댓글 수정 중 오류가 발생했습니다.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteComment = async (commentId: number) => {
        const confirmed = await confirm({
            title: '댓글 삭제',
            message: '이 댓글을 삭제하시겠습니까?',
            confirmText: '삭제',
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
                toast.success('댓글이 삭제되었습니다.');
                return;
            }

            toast.error(response.data.errorMessage || '댓글 삭제에 실패했습니다.');
        } catch (error) {
            toast.error(getErrorMessage(error, '댓글 삭제 중 오류가 발생했습니다.'));
        }
    };

    const startReplying = (commentId: number, authorUsername: string) => {
        if (!isLoggedIn) {
            onRequireLogin('답글 작성');
            return;
        }

        setReplyingToCommentId(commentId);
        setReplyParentId(findRootParentId(commentId, comments));
        setReplyText(`\`@${authorUsername}\` `);
    };

    const cancelReplying = () => {
        setReplyingToCommentId(null);
        setReplyText('');
        setReplyParentId(null);
    };

    const handleReply = async () => {
        if (!isLoggedIn) {
            onRequireLogin('답글 작성');
            return;
        }

        if (!replyText.trim()) {
            toast.error('답글 내용을 입력해주세요.');
            return;
        }

        if (!replyParentId) {
            toast.error('답글을 작성할 댓글을 찾을 수 없습니다.');
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await createComment(postUrl, replyText, replyParentId);

            if (response.data.status === 'DONE') {
                const createdReply = response.data.body;
                setReplyText('');
                setReplyingToCommentId(null);
                setReplyParentId(null);
                updateComments((currentComments) => appendCommentToTree(
                    currentComments,
                    createdReply
                ));
                scrollToLatestComment();
                toast.success('답글이 작성되었습니다.');
                return;
            }

            toast.error(response.data.errorMessage || '답글 작성에 실패했습니다.');
        } catch (error) {
            toast.error(getErrorMessage(error, '답글 작성 중 오류가 발생했습니다.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        comments,
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
