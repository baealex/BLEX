import { useState, useRef, useEffect } from 'react';
import type { Response } from '~/modules/http.module';
import { http } from '~/modules/http.module';
import { useFetch } from '~/hooks/use-fetch';
import styles from './Comments.module.scss';
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
            const response = await http<Response<Comment>>('v1/comments', {
                params: { url: postUrl },
                method: 'POST',
                data: { text_md: commentText }
            });

            if (response.data.status === 'DONE') {
                setCommentText('');
                refetch();
            } else {
                setError(response.data.errorMessage || 'Failed to post comment');
            }
        } catch (err) {
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
        } catch (err) {
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
            const formData = new FormData();
            formData.append('comment', 'true');
            formData.append('comment_md', editText);

            const response = await http<Response<Comment>>(`v1/comments/${commentId}`, {
                method: 'PUT',
                data: formData
            });

            if (response.data.status === 'DONE') {
                setEditingCommentId(null);
                setEditText('');
                refetch();
            } else {
                setError(response.data.errorMessage || 'Failed to update comment');
                setTimeout(() => setError(null), 3000);
            }
        } catch (err) {
            setError('Error updating comment');
            setTimeout(() => setError(null), 3000);
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteComment = async (commentId: number) => {
        if (!confirm('Are you sure you want to delete this comment?')) {
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
        } catch (err) {
            setError('Error deleting comment');
            setTimeout(() => setError(null), 3000);
        }
    };

    if (isError) {
        return <div className={styles.commentsError}>Error loading comments. Please try again later.</div>;
    }

    if (isLoading) {
        return <div className={styles.commentsLoading}>Loading comments...</div>;
    }

    return (
        <>
            {error && <div className={styles.errorMessage}>{error}</div>}

            <div className={styles.commentsContainer}>
                <h3 className={styles.commentsTitle}>Comments</h3>

                {data?.comments.length === 0 ? (
                    <div className={styles.noComments}>No comments yet. Be the first to comment!</div>
                ) : (
                    <ul className={styles.commentsList}>
                        {data?.comments.map((comment) => (
                            <li key={comment.id} className={styles.commentItem}>
                                <div className={styles.commentHeader}>
                                    <a href={`/@${comment.author}`} className={styles.authorLink}>
                                        <img
                                            src={getStaticPath(userResource(comment.authorImage))}
                                            alt={comment.author}
                                            className={styles.authorImage}
                                        />
                                    </a>
                                    <div className={styles.authorInfo}>
                                        <a className={styles.authorName} href={`/@${comment.author}`}>{comment.author}</a>
                                        <div className={styles.commentMeta}>
                                            <span className={styles.commentDate}>{comment.createdDate}</span>
                                            {comment.isEdited && <span className={styles.editedMark}>(edited)</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.commentBody}>
                                    {editingCommentId === comment.id ? (
                                        <div className={styles.editCommentContainer}>
                                            <textarea
                                                ref={editTextareaRef}
                                                className={styles.editCommentInput}
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                placeholder="Edit your comment..."
                                                disabled={isSubmitting}
                                            />
                                            <div className={styles.editActions}>
                                                <button
                                                    className={styles.saveButton}
                                                    onClick={() => saveEdit(comment.id)}
                                                    disabled={isSubmitting}>
                                                    {isSubmitting ? 'Saving...' : 'Save'}
                                                </button>
                                                <button
                                                    className={styles.cancelButton}
                                                    onClick={cancelEditing}
                                                    disabled={isSubmitting}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div
                                                className={styles.commentContent}
                                                dangerouslySetInnerHTML={{ __html: comment.renderedContent }}
                                            />
                                            <div className={styles.commentActions}>
                                                <button
                                                    className={`${styles.likeButton} flex gap-1 ${comment.isLiked ? styles.liked : ''}`}
                                                    onClick={() => handleLike(comment.id)}>
                                                    {comment.isLiked ? '♥️' : '🩶'}
                                                    {comment.countLikes > 0 && (
                                                        <span className={styles.likeCount}>{comment.countLikes}</span>
                                                    )}
                                                </button>

                                                {window.configuration.user?.username === comment.author && (
                                                    <div className={styles.authorActions}>
                                                        <button
                                                            className={styles.editButton}
                                                            onClick={() => startEditing(comment.id)}>
                                                            Edit
                                                        </button>
                                                        <button
                                                            className={styles.deleteButton}
                                                            onClick={() => deleteComment(comment.id)}>
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <div className={styles.writeCommentContainer}>
                    <h4 className={styles.writeCommentTitle}>Write a comment</h4>
                    <textarea
                        ref={textareaRef}
                        className={styles.commentInput}
                        placeholder="Write your comment..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        disabled={isSubmitting}
                    />

                    <button
                        className={styles.writeButton}
                        onClick={handleWrite}
                        disabled={isSubmitting || !commentText.trim()}>
                        {isSubmitting ? 'Posting...' : 'Post Comment'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default Comments;
