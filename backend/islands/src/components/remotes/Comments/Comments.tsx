import { useState, useRef, useEffect } from 'react';
import type { Response } from '~/modules/http.module';
import { http } from '~/modules/http.module';
import { useFetch } from '~/hooks/use-fetch';
import { getStaticPath } from '~/modules/static.module';
import { useConfirm } from '~/contexts/ConfirmContext';

interface CommentsProps {
    postUrl: string;
}

interface Comment {
    id: number;
    author: string;
    authorImage: string;
    renderedContent: string;
    isEdited: boolean;
    createdDate: string;
    countLikes: number;
    isLiked: boolean;
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

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const editTextareaRef = useRef<HTMLTextAreaElement>(null);

    const { data, isError, isLoading, refetch } = useFetch({
        queryKey: [postUrl, 'comments'],
        queryFn: async () => {
            const response = await http<Response<{ comments: Comment[] }>>(`v1/posts/${postUrl}/comments`, { method: 'GET' });
            if (response.data.status === 'ERROR') {
                throw new Error(response.data.errorMessage);
            }
            return response.data.body;
        },
        enable: !!postUrl
    });

    // Auto-resize textarea as content grows
    useEffect(() => {
        const adjustHeight = (textarea: HTMLTextAreaElement | null) => {
            if (!textarea) return;
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        };

        adjustHeight(textareaRef.current);
        adjustHeight(editTextareaRef.current);
    }, [commentText, editText]);

    const handleLike = async (commentId: number) => {
        try {
            const response = await http<Response<{ countLikes: number }>>(`v1/comments/${commentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: 'like=like'
            });

            if (response.data.status === 'DONE') {
                refetch();
            } else {
                setError('Failed to like comment');
                setTimeout(() => setError(null), 3000);
            }
        } catch {
            setError('Error liking comment');
            setTimeout(() => setError(null), 3000);
        }
    };

    const handleWrite = async () => {
        if (!commentText.trim()) {
            setError('Comment cannot be empty');
            setTimeout(() => setError(null), 3000);
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            params.append('comment_md', commentText);

            const response = await http<Response<Comment>>(`v1/comments?url=${encodeURIComponent(postUrl)}`, {
                method: 'POST',
                data: params.toString(),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            if (response.data.status === 'DONE') {
                setCommentText('');
                refetch();
            } else {
                setError(response.data.errorMessage || 'Failed to post comment');
            }
        } catch {
            setError('Error posting comment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const startEditing = async (commentId: number) => {
        try {
            const response = await http<Response<CommentEditData>>(`v1/comments/${commentId}`, { method: 'GET' });

            if (response.data.status === 'DONE' && response.data.body) {
                setEditingCommentId(commentId);
                setEditText(response.data.body.textMd);

                // Focus and adjust the edit textarea after it renders
                setTimeout(() => {
                    if (editTextareaRef.current) {
                        editTextareaRef.current.focus();
                        editTextareaRef.current.style.height = 'auto';
                        editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
                    }
                }, 0);
            } else {
                setError('Failed to get comment data');
                setTimeout(() => setError(null), 3000);
            }
        } catch {
            setError('Error retrieving comment data');
            setTimeout(() => setError(null), 3000);
        }
    };

    const cancelEditing = () => {
        setEditingCommentId(null);
        setEditText('');
    };

    const saveEdit = async (commentId: number) => {
        if (!editText.trim()) {
            setError('Comment cannot be empty');
            setTimeout(() => setError(null), 3000);
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
                setError(response.data.errorMessage || 'Failed to update comment');
                setTimeout(() => setError(null), 3000);
            }
        } catch {
            setError('Error updating comment');
            setTimeout(() => setError(null), 3000);
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
            const response = await http<Response<Comment>>(`v1/comments/${commentId}`, { method: 'DELETE' });

            if (response.data.status === 'DONE') {
                refetch();
            } else {
                setError(response.data.errorMessage || 'Failed to delete comment');
                setTimeout(() => setError(null), 3000);
            }
        } catch {
            setError('Error deleting comment');
            setTimeout(() => setError(null), 3000);
        }
    };

    if (isError) {
        return <div className="text-center py-8 text-gray-600">댓글을 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.</div>;
    }

    if (isLoading) {
        return <div className="text-center py-8 text-gray-500">댓글을 불러오는 중...</div>;
    }

    return (
        <div className="space-y-6 sm:space-y-8">
            {error && (
                <div className="bg-gray-50 border-l-4 border-gray-900 text-gray-700 px-4 py-3 sm:px-5 sm:py-4 rounded-xl shadow-sm animate-fade-in">
                    <div className="flex items-center">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-gray-900 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium text-sm sm:text-base">{error}</span>
                    </div>
                </div>
            )}

            {data?.comments.length === 0 ? (
                <div className="h-[200px] flex flex-col items-center justify-center rounded-2xl">
                    <div className="text-3xl sm:text-4xl text-gray-300 mb-3 sm:mb-4">
                        <i className="far fa-comments" />
                    </div>
                    <p className="text-gray-400 text-sm sm:text-base">아직 댓글이 없네요! 첫 번째 댓글을 작성해 볼까요?</p>
                </div>
            ) : (
                <div className="space-y-4 sm:space-y-6 flex flex-col gap-4 lg:gap-6">
                    {data?.comments.map((comment) => (
                        <div key={comment.id} className="bg-white border border-gray-100 rounded-xl sm:rounded-2xl">
                            {/* 댓글 헤더 */}
                            <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                                <a href={`/@${comment.author}`} className="flex-shrink-0 group">
                                    {comment.authorImage ? (
                                        <img
                                            src={getStaticPath(comment.authorImage)}
                                            alt={comment.author}
                                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover ring-2 ring-gray-100 group-hover:ring-gray-300 transition-all duration-200"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black ring-2 ring-gray-100 group-hover:ring-gray-300 transition-all duration-200 flex items-center justify-center text-white font-bold text-sm sm:text-base">
                                            {comment.author.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </a>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-2">
                                        <a
                                            href={`/@${comment.author}`}
                                            className="font-semibold text-gray-900 hover:text-gray-600 transition-colors text-sm sm:text-base truncate">
                                            {comment.author}
                                        </a>
                                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                                            <time className="text-gray-500 font-medium">{comment.createdDate}</time>
                                            {comment.isEdited && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                    <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                    </svg>
                                                    수정됨
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 댓글 내용 */}
                                    {editingCommentId === comment.id ? (
                                        <div className="space-y-3 sm:space-y-4">
                                            <textarea
                                                ref={editTextareaRef}
                                                className="w-full p-3 sm:p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-gray-300 focus:border-gray-300 resize-none text-sm sm:text-base"
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                placeholder="댓글을 수정하세요..."
                                                disabled={isSubmitting}
                                                rows={3}
                                            />
                                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                                                <button
                                                    className="w-full sm:w-auto px-6 py-3 bg-black hover:bg-gray-800 text-white rounded-xl font-medium transition-all duration-200 text-sm disabled:opacity-50 shadow-md"
                                                    onClick={() => saveEdit(comment.id)}
                                                    disabled={isSubmitting}>
                                                    {isSubmitting ? '저장 중...' : '저장'}
                                                </button>
                                                <button
                                                    className="w-full sm:w-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all duration-200 text-sm disabled:opacity-50"
                                                    onClick={cancelEditing}
                                                    disabled={isSubmitting}>
                                                    취소
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div
                                                className="prose prose-sm sm:prose-base max-w-none text-gray-800 mb-4 sm:mb-5 leading-relaxed break-words"
                                                dangerouslySetInnerHTML={{ __html: comment.renderedContent }}
                                            />

                                            {/* 댓글 액션 */}
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                <button
                                                    className={`flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${comment.isLiked
                                                        ? 'bg-gray-50 text-gray-900 hover:bg-gray-100 border border-gray-200'
                                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                                                        }`}
                                                    onClick={() => handleLike(comment.id)}>
                                                    <svg className={`w-4 h-4 ${comment.isLiked ? 'fill-black' : 'fill-none stroke-current stroke-2'}`} viewBox="0 0 24 24">
                                                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                                    </svg>
                                                    {comment.countLikes > 0 && (
                                                        <span className="font-semibold">{comment.countLikes}</span>
                                                    )}
                                                </button>

                                                {window.configuration.user?.username === comment.author && (
                                                    <div className="flex gap-2 w-full sm:w-auto">
                                                        <button
                                                            className="flex-1 sm:flex-none px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200 font-medium"
                                                            onClick={() => startEditing(comment.id)}>
                                                            수정
                                                        </button>
                                                        <button
                                                            className="flex-1 sm:flex-none px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200 font-medium"
                                                            onClick={() => deleteComment(comment.id)}>
                                                            삭제
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 댓글 작성 폼 */}
            <div className="border-t border-gray-200 pt-6 sm:pt-8 mt-8 sm:mt-10">
                <div className="bg-gray-50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                    <h4 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-gray-900 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        댓글 작성
                    </h4>
                    <div className="space-y-4 sm:space-y-5">
                        <textarea
                            ref={textareaRef}
                            className="w-full p-3 sm:p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-gray-300 focus:border-gray-300 resize-none bg-white transition-all duration-200 placeholder-gray-400 text-sm sm:text-base"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            disabled={isSubmitting}
                            rows={4}
                        />

                        <div className="flex flex-col sm:flex-row sm:justify-end sm:items-center gap-3">
                            <button
                                className="w-full sm:w-auto px-6 py-3 bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 order-1 sm:order-2 shadow-md"
                                onClick={handleWrite}
                                disabled={isSubmitting || !commentText.trim()}>
                                {isSubmitting ? (
                                    <>
                                        <i className="fas fa-spinner animate-spin" />
                                        작성 중...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-pen" />
                                        댓글 작성
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Comments;
