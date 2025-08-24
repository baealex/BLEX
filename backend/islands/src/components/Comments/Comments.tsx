import { useState, useRef, useEffect } from 'react';
import type { Response } from '~/modules/http.module';
import { http } from '~/modules/http.module';
import { useFetch } from '~/hooks/use-fetch';
import { getStaticPath, userResource } from '~/modules/static.module';

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

declare global {
    interface Window {
        configuration: {
            host: string;
            static: string;
            user?: {
                isAuthenticated: boolean;
                username: string;
            };
        };
    }
}

const Comments = (props: CommentsProps) => {
    const { postUrl } = props;

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
        } catch (err) {
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
        if (!confirm('이 댓글을 삭제하시겠습니까?')) {
            return;
        }

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
        return <div className="text-center py-8 text-red-600">댓글을 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.</div>;
    }

    if (isLoading) {
        return <div className="text-center py-8 text-gray-500">댓글을 불러오는 중...</div>;
    }

    return (
        <div className="space-y-8">
            {error && (
                <div className="bg-red-50 border-l-4 border-red-400 text-red-700 px-5 py-4 rounded-r-lg shadow-sm animate-fade-in">
                    <div className="flex items-center">
                        <svg className="w-5 h-5 mr-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">{error}</span>
                    </div>
                </div>
            )}

            {data?.comments.length === 0 ? (
                <div className="text-center py-12">
                    <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 border-2 border-dashed border-gray-200">
                        <div className="text-4xl text-gray-300 mb-4">
                            <i className="far fa-comments" />
                        </div>
                        <p className="text-gray-600">아직 댓글이 없습니다. 첫 번째 댓글을 작성해보세요!</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {data?.comments.map((comment) => (
                        <div key={comment.id} className="bg-white border border-gray-100 rounded-2xl p-6">
                            {/* 댓글 헤더 */}
                            <div className="flex items-start gap-4 mb-4">
                                <a href={`/@${comment.author}`} className="flex-shrink-0 group">
                                    <img
                                        src={getStaticPath(userResource(comment.authorImage))}
                                        alt={comment.author}
                                        className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100 group-hover:ring-indigo-300 transition-all duration-200"
                                    />
                                </a>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <a
                                            href={`/@${comment.author}`}
                                            className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors text-base">
                                            {comment.author}
                                        </a>
                                        <time className="text-sm text-gray-500 font-medium">{comment.createdDate}</time>
                                        {comment.isEdited && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                </svg>
                                                수정됨
                                            </span>
                                        )}
                                    </div>

                                    {/* 댓글 내용 */}
                                    {editingCommentId === comment.id ? (
                                        <div className="space-y-3">
                                            <textarea
                                                ref={editTextareaRef}
                                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                placeholder="댓글을 수정하세요..."
                                                disabled={isSubmitting}
                                                rows={3}
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors duration-200 text-sm disabled:opacity-50"
                                                    onClick={() => saveEdit(comment.id)}
                                                    disabled={isSubmitting}>
                                                    {isSubmitting ? '저장 중...' : '저장'}
                                                </button>
                                                <button
                                                    className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors duration-200 text-sm disabled:opacity-50"
                                                    onClick={cancelEditing}
                                                    disabled={isSubmitting}>
                                                    취소
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div
                                                className="prose prose-base max-w-none text-gray-800 mb-5 leading-relaxed"
                                                dangerouslySetInnerHTML={{ __html: comment.renderedContent }}
                                            />

                                            {/* 댓글 액션 */}
                                            <div className="flex items-center justify-between">
                                                <button
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 transform hover:scale-105 ${comment.isLiked
                                                        ? 'bg-pink-50 text-pink-700 hover:bg-pink-100 ring-1 ring-pink-200'
                                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 ring-1 ring-gray-200'
                                                        }`}
                                                    onClick={() => handleLike(comment.id)}>
                                                    <span className="text-lg">
                                                        {comment.isLiked ? '❤️' : '🤍'}
                                                    </span>
                                                    {comment.countLikes > 0 && (
                                                        <span className="font-semibold">{comment.countLikes}</span>
                                                    )}
                                                </button>

                                                {window.configuration.user?.username === comment.author && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all duration-200"
                                                            onClick={() => startEditing(comment.id)}>
                                                            수정
                                                        </button>
                                                        <button
                                                            className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
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
            <div className="border-t-2 border-gray-100 pt-8 mt-10">
                <div className="bg-gray-50 rounded-2xl p-6">
                    <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                        <svg className="w-6 h-6 mr-3 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        댓글 작성
                    </h4>
                    <div className="space-y-5">
                        <textarea
                            ref={textareaRef}
                            className="w-full p-5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 resize-none bg-white shadow-sm transition-all duration-200 placeholder-gray-400"
                            placeholder="댓글을 작성해주세요... 마크다운을 지원합니다."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            disabled={isSubmitting}
                            rows={4}
                        />

                        <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-500">
                                💡 마크다운 문법을 사용하여 서식을 꾸밀 수 있어요
                            </p>
                            <button
                                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                                onClick={handleWrite}
                                disabled={isSubmitting || !commentText.trim()}>
                                {isSubmitting ? (
                                    <>
                                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />
                                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        작성 중...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                        </svg>
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
