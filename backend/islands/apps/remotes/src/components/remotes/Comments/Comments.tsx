import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConfirm } from '~/contexts/ConfirmContext';
import { isLoggedIn as checkIsLoggedIn, showLoginPrompt } from '~/utils/loginPrompt';
import { toast } from '~/utils/toast';
import {
    getComments,
    createComment,
    getComment,
    updateComment,
    deleteComment as deleteCommentAPI,
    toggleCommentLike,
    getCommentAuthors
} from '~/lib/api';

import { CommentList } from './components/CommentList';
import { CommentForm } from './components/CommentForm';
import type { Comment } from '~/lib/api/comments';

interface CommentsProps {
    postUrl: string;
}

const Comments = (props: CommentsProps) => {
    const { postUrl } = props;
    const { confirm } = useConfirm();

    const [commentText, setCommentText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editText, setEditText] = useState('');
    const [replyingToCommentId, setReplyingToCommentId] = useState<number | null>(null);
    const [replyText, setReplyText] = useState('');
    const [replyParentId, setReplyParentId] = useState<number | null>(null);

    const isLoggedIn = useMemo(() => {
        return checkIsLoggedIn();
    }, []);

    const { data, isError, isLoading, refetch } = useQuery({
        queryKey: [postUrl, 'comments'],
        queryFn: async () => {
            const response = await getComments(postUrl);
            if (response.data.status === 'ERROR') {
                throw new Error(response.data.errorMessage);
            }
            return response.data.body;
        },
        enabled: !!postUrl
    });

    const mentionableUsers = useMemo(() => {
        if (!data?.comments) return [];
        return getCommentAuthors(data.comments);
    }, [data?.comments]);

    const findRootParentId = useCallback((commentId: number, comments: Comment[]): number => {
        for (const comment of comments) {
            if (comment.id === commentId) {
                return comment.id;
            }
            if (comment.replies) {
                for (const reply of comment.replies) {
                    if (reply.id === commentId) {
                        return comment.id;
                    }
                }
            }
        }
        return commentId;
    }, []);

    const handleLike = useCallback(
        async (commentId: number) => {
            if (!isLoggedIn) {
                showLoginPrompt('좋아요');
                return;
            }

            try {
                const response = await toggleCommentLike(commentId);

                if (response.data.status === 'DONE') {
                    refetch();
                } else {
                    toast.error('좋아요 처리에 실패했습니다.');
                }
            } catch {
                toast.error('좋아요 처리 중 오류가 발생했습니다.');
            }
        },
        [isLoggedIn, refetch]
    );

    const handleWrite = useCallback(async () => {
        if (!isLoggedIn) {
            showLoginPrompt('댓글 작성');
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
                setCommentText('');
                refetch();
                toast.success('댓글이 작성되었습니다.');
            } else {
                toast.error(response.data.errorMessage || '댓글 작성에 실패했습니다.');
            }
        } catch {
            toast.error('댓글 작성 중 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    }, [isLoggedIn, commentText, postUrl, refetch]);

    const startEditing = async (commentId: number) => {
        try {
            const { data } = await getComment(commentId);

            if (data.status === 'DONE') {
                setEditingCommentId(commentId);
                setEditText(data.body.textMd || '');
            } else {
                toast.error('댓글 정보를 불러오는데 실패했습니다.');
            }
        } catch (err) {
            console.error('댓글 수정 오류:', err);
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
                refetch();
                toast.success('댓글이 수정되었습니다.');
            } else {
                toast.error(response.data.errorMessage || '댓글 수정에 실패했습니다.');
            }
        } catch {
            toast.error('댓글 수정 중 오류가 발생했습니다.');
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
                refetch();
                toast.success('댓글이 삭제되었습니다.');
            } else {
                toast.error(response.data.errorMessage || '댓글 삭제에 실패했습니다.');
            }
        } catch {
            toast.error('댓글 삭제 중 오류가 발생했습니다.');
        }
    };

    const startReplying = (commentId: number, authorUsername: string) => {
        if (!isLoggedIn) {
            showLoginPrompt('답글 작성');
            return;
        }
        setReplyingToCommentId(commentId);
        const rootParentId = findRootParentId(commentId, data?.comments ?? []);
        setReplyParentId(rootParentId);
        setReplyText(`\`@${authorUsername}\` `);
    };

    const cancelReplying = () => {
        setReplyingToCommentId(null);
        setReplyText('');
        setReplyParentId(null);
    };

    const handleReply = async () => {
        if (!isLoggedIn) {
            showLoginPrompt('답글 작성');
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
                setReplyText('');
                setReplyingToCommentId(null);
                setReplyParentId(null);
                refetch();
                toast.success('답글이 작성되었습니다.');
            } else {
                toast.error(response.data.errorMessage || '답글 작성에 실패했습니다.');
            }
        } catch {
            toast.error('답글 작성 중 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isError) {
        return (
            <div className="text-center py-12 bg-red-50 border border-red-100 rounded-2xl">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                    <svg
                        className="w-8 h-8 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    댓글을 불러올 수 없습니다
                </h3>
                <p className="text-gray-600 text-sm">
                    잠시 후 다시 시도해 주세요.
                </p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="text-center space-y-4">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-gray-900" />
                    <p className="text-gray-500 text-sm font-medium">댓글을 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <CommentList
                comments={data?.comments ?? []}
                currentUser={window.configuration.user?.username}
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

            <div className="border-t-2 border-gray-200 pt-8">
                <div className="flex items-center gap-3 mb-6">
                    <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h2 className="text-lg font-bold text-gray-900">
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
