import { useState, useMemo, useCallback } from 'react';
import type { Response } from '~/modules/http.module';
import { http } from '~/modules/http.module';
import { useFetch } from '~/hooks/use-fetch';
import { useConfirm } from '~/contexts/ConfirmContext';
import { isLoggedIn as checkIsLoggedIn, showLoginPrompt } from '~/utils/loginPrompt';

import { ErrorAlert } from './components/ErrorAlert';
import { CommentList } from './components/CommentList';
import { CommentForm } from './components/CommentForm';
import type { Comment } from './components/CommentItem';

interface CommentsProps {
    postUrl: string;
}

interface CommentEditData {
    textMd: string;
}

const Comments = (props: CommentsProps) => {
    const { postUrl } = props;
    const { confirm } = useConfirm();

    const [commentText, setCommentText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editText, setEditText] = useState('');
    const [error, setError] = useState<string | null>(null);

    const isLoggedIn = useMemo(() => {
        return checkIsLoggedIn();
    }, []);

    const { data, isError, isLoading, refetch } = useFetch({
        queryKey: [postUrl, 'comments'],
        queryFn: async () => {
            const response = await http<Response<{ comments: Comment[] }>>(
                `v1/posts/${postUrl}/comments`,
                { method: 'GET' }
            );
            if (response.data.status === 'ERROR') {
                throw new Error(response.data.errorMessage);
            }
            return response.data.body;
        },
        enable: !!postUrl
    });

    const handleLike = useCallback(
        async (commentId: number) => {
            if (!isLoggedIn) {
                showLoginPrompt('좋아요');
                return;
            }

            try {
                const response = await http<Response<{ countLikes: number }>>(
                    `v1/comments/${commentId}`,
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        data: 'like=like'
                    }
                );

                if (response.data.status === 'DONE') {
                    refetch();
                } else {
                    setError('좋아요 처리에 실패했습니다.');
                }
            } catch {
                setError('좋아요 처리 중 오류가 발생했습니다.');
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
            setError('댓글 내용을 입력해주세요.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            params.append('comment_md', commentText);

            const response = await http<Response<Comment>>(
                `v1/comments?url=${encodeURIComponent(postUrl)}`,
                {
                    method: 'POST',
                    data: params.toString(),
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );

            if (response.data.status === 'DONE') {
                setCommentText('');
                refetch();
            } else {
                setError(response.data.errorMessage || '댓글 작성에 실패했습니다.');
            }
        } catch {
            setError('댓글 작성 중 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    }, [isLoggedIn, commentText, postUrl, refetch]);

    const startEditing = async (commentId: number) => {
        try {
            const response = await http<Response<CommentEditData>>(
                `v1/comments/${commentId}`,
                { method: 'GET' }
            );

            if (response.data.status === 'DONE' && response.data.body) {
                setEditingCommentId(commentId);
                setEditText(response.data.body.textMd);
            } else {
                setError('댓글 정보를 불러오는데 실패했습니다.');
            }
        } catch {
            setError('댓글 정보를 불러오는 중 오류가 발생했습니다.');
        }
    };

    const cancelEditing = () => {
        setEditingCommentId(null);
        setEditText('');
    };

    const saveEdit = async (commentId: number) => {
        if (!editText.trim()) {
            setError('댓글 내용을 입력해주세요.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            params.append('comment', 'true');
            params.append('comment_md', editText);

            const response = await http<Response<Comment>>(`v1/comments/${commentId}`, {
                method: 'PUT',
                data: params.toString(),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            if (response.data.status === 'DONE') {
                setEditingCommentId(null);
                setEditText('');
                refetch();
            } else {
                setError(response.data.errorMessage || '댓글 수정에 실패했습니다.');
            }
        } catch {
            setError('댓글 수정 중 오류가 발생했습니다.');
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
            const response = await http<Response<Comment>>(
                `v1/comments/${commentId}`,
                { method: 'DELETE' }
            );

            if (response.data.status === 'DONE') {
                refetch();
            } else {
                setError(response.data.errorMessage || '댓글 삭제에 실패했습니다.');
            }
        } catch {
            setError('댓글 삭제 중 오류가 발생했습니다.');
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
        <div className="space-y-6">
            {error && (
                <ErrorAlert
                    message={error}
                    onDismiss={() => setError(null)}
                />
            )}

            <CommentList
                comments={data?.comments || []}
                currentUser={window.configuration.user?.username}
                editingCommentId={editingCommentId}
                editText={editText}
                isSubmitting={isSubmitting}
                onLike={handleLike}
                onEdit={startEditing}
                onDelete={deleteComment}
                onEditTextChange={setEditText}
                onSaveEdit={saveEdit}
                onCancelEdit={cancelEditing}
            />

            <div className="border-t border-gray-200 pt-6 mt-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                    댓글 작성
                </h2>

                <CommentForm
                    isLoggedIn={isLoggedIn}
                    commentText={commentText}
                    onCommentTextChange={setCommentText}
                    onSubmit={handleWrite}
                    isSubmitting={isSubmitting}
                    onShowLoginPrompt={() => showLoginPrompt('댓글 작성')}
                />
            </div>
        </div>
    );
};

export default Comments;
