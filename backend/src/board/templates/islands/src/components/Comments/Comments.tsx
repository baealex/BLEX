import { useState, useRef, useEffect } from 'react';
import type { Response } from '~/modules/http.module';
import { http } from '~/modules/http.module';
import { useFetch } from '~/hooks/use-fetch';
import { getStaticPath } from '~/modules/env.module';

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
    hasLiked: boolean;
}

interface CommentEditData {
    textMd: string;
}

declare global {
    interface Window {
        authKey: symbol;
        [authKey: symbol]: {
            username: string;
            id: number;
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
        return <div className="comments-error">Error loading comments. Please try again later.</div>;
    }

    if (isLoading) {
        return <div className="comments-loading">Loading comments...</div>;
    }

    return (
        <>
            {error && <div className="error-message">{error}</div>}

            <div className="comments-container">
                <h3 className="comments-title">Comments</h3>

                {data?.comments.length === 0 ? (
                    <div className="no-comments">No comments yet. Be the first to comment!</div>
                ) : (
                    <ul className="comments-list">
                        {data?.comments.map((comment) => (
                            <li key={comment.id} className="comment-item">
                                <div className="comment-header">
                                    <a href={`/@${comment.author}`} className="author-link">
                                        <img
                                            src={getStaticPath(comment.authorImage)}
                                            alt={comment.author}
                                            className="author-image"
                                        />
                                    </a>
                                    <div className="author-info">
                                        <a className="author-name" href={`/@${comment.author}`}>{comment.author}</a>
                                        <div className="comment-meta">
                                            <span className="comment-date">{comment.createdDate}</span>
                                            {comment.isEdited && <span className="edited-mark">(edited)</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="comment-body">
                                    {editingCommentId === comment.id ? (
                                        <div className="edit-comment-container">
                                            <textarea
                                                ref={editTextareaRef}
                                                className="edit-comment-input"
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                placeholder="Edit your comment..."
                                                disabled={isSubmitting}
                                            />
                                            <div className="edit-actions">
                                                <button
                                                    className="save-button"
                                                    onClick={() => saveEdit(comment.id)}
                                                    disabled={isSubmitting}>
                                                    {isSubmitting ? 'Saving...' : 'Save'}
                                                </button>
                                                <button
                                                    className="cancel-button"
                                                    onClick={cancelEditing}
                                                    disabled={isSubmitting}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div
                                                className="comment-content"
                                                dangerouslySetInnerHTML={{ __html: comment.renderedContent }}
                                            />
                                            <div className="comment-actions">
                                                <button
                                                    className={`like-button ${comment.hasLiked ? 'liked' : ''}`}
                                                    onClick={() => handleLike(comment.id)}>
                                                    {comment.hasLiked ? 'Liked' : 'Like'}
                                                </button>
                                                {comment.countLikes > 0 && (
                                                    <span className="like-count">{comment.countLikes}</span>
                                                )}

                                                {/* Show edit/delete buttons if current user is the author */}
                                                {window.authKey && window[window.authKey].username === comment.author && (
                                                    <div className="author-actions">
                                                        <button
                                                            className="edit-button"
                                                            onClick={() => startEditing(comment.id)}>
                                                            Edit
                                                        </button>
                                                        <button
                                                            className="delete-button"
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

                <div className="write-comment-container">
                    <h4 className="write-comment-title">Write a comment</h4>
                    <textarea
                        ref={textareaRef}
                        className="comment-input"
                        placeholder="Write your comment..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        disabled={isSubmitting}
                    />

                    <button
                        className="write-button"
                        onClick={handleWrite}
                        disabled={isSubmitting || !commentText.trim()}>
                        {isSubmitting ? 'Posting...' : 'Post Comment'}
                    </button>
                </div>
            </div>

            <style jsx>{`
                .comments-container {
                    margin-top: 30px;
                    padding: 20px;
                    border-radius: 8px;
                    background-color: #fff;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
                }
                
                .comments-title {
                    font-size: 1.5rem;
                    margin-bottom: 20px;
                    color: #333;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 10px;
                }
                
                .no-comments {
                    color: #6c757d;
                    font-style: italic;
                    margin: 20px 0;
                    text-align: center;
                }
                
                .comments-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                
                .comment-item {
                    margin-bottom: 20px;
                    padding: 15px;
                    border-radius: 8px;
                    background-color: #f8f9fa;
                    transition: background-color 0.2s ease;
                }
                
                .comment-item:hover {
                    background-color: #f1f3f5;
                }
                
                .comment-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .author-link {
                    display: block;
                    flex-shrink: 0;
                }
                
                .author-image {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    margin-right: 10px;
                    object-fit: cover;
                    border: 2px solid #fff;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }
                
                .author-info {
                    display: flex;
                    flex-direction: column;
                }
                
                .author-name {
                    font-weight: 600;
                    font-size: 14px;
                    color: #343a40;
                    text-decoration: none;
                }
                
                .author-name:hover {
                    text-decoration: underline;
                }
                
                .comment-meta {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                
                .comment-date {
                    font-size: 12px;
                    color: #6c757d;
                }
                
                .edited-mark {
                    font-size: 11px;
                    color: #6c757d;
                    font-style: italic;
                }
                
                .comment-body {
                    margin-left: 50px;
                }
                
                .comment-content {
                    margin-bottom: 10px;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #212529;
                    word-break: break-word;
                }
                
                .comment-content p {
                    margin-bottom: 0.75rem;
                }
                
                .comment-content p:last-child {
                    margin-bottom: 0;
                }
                
                .comment-actions {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-top: 10px;
                    flex-wrap: wrap;
                }
                
                .like-button {
                    background: none;
                    border: none;
                    color: #6c757d;
                    cursor: pointer;
                    padding: 5px 10px;
                    font-size: 12px;
                    border-radius: 4px;
                    background-color: #e9ecef;
                    transition: all 0.2s ease;
                }
                
                .like-button:hover {
                    background-color: #dee2e6;
                }
                
                .like-button.liked {
                    background-color: #cfe2ff;
                    color: #0d6efd;
                }
                
                .like-count {
                    font-size: 12px;
                    color: #6c757d;
                }
                
                .author-actions {
                    display: flex;
                    gap: 8px;
                    margin-left: auto;
                }
                
                .edit-button, .delete-button {
                    background: none;
                    border: none;
                    font-size: 12px;
                    color: #6c757d;
                    cursor: pointer;
                    padding: 5px 8px;
                    border-radius: 4px;
                }
                
                .edit-button:hover {
                    color: #0d6efd;
                    background-color: #e9ecef;
                }
                
                .delete-button:hover {
                    color: #dc3545;
                    background-color: #e9ecef;
                }
                
                .edit-comment-container {
                    margin-bottom: 15px;
                }
                
                .edit-comment-input {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ced4da;
                    border-radius: 4px;
                    font-size: 14px;
                    min-height: 80px;
                    resize: vertical;
                    margin-bottom: 10px;
                }
                
                .edit-actions {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }
                
                .save-button, .cancel-button {
                    padding: 6px 12px;
                    border-radius: 4px;
                    font-size: 13px;
                    cursor: pointer;
                    border: none;
                }
                
                .save-button {
                    background-color: #0d6efd;
                    color: white;
                }
                
                .save-button:hover:not(:disabled) {
                    background-color: #0b5ed7;
                }
                
                .cancel-button {
                    background-color: #6c757d;
                    color: white;
                }
                
                .cancel-button:hover:not(:disabled) {
                    background-color: #5c636a;
                }
                
                .write-comment-container {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                }
                
                .write-comment-title {
                    font-size: 1.1rem;
                    margin-bottom: 15px;
                    color: #495057;
                }
                
                .comment-input {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid #ced4da;
                    border-radius: 4px;
                    font-size: 14px;
                    min-height: 100px;
                    resize: vertical;
                    transition: border-color 0.2s ease;
                }
                
                .comment-input:focus {
                    outline: none;
                    border-color: #86b7fe;
                    box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
                }
                
                .write-button {
                    margin-top: 15px;
                    padding: 10px 20px;
                    background-color: #0d6efd;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background-color 0.2s ease;
                }
                
                .write-button:hover:not(:disabled) {
                    background-color: #0b5ed7;
                }
                
                .write-button:disabled {
                    background-color: #6c757d;
                    cursor: not-allowed;
                    opacity: 0.65;
                }
                
                .error-message {
                    background-color: #f8d7da;
                    color: #842029;
                    padding: 10px 15px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                    font-size: 14px;
                }
                
                .comments-loading, .comments-error {
                    text-align: center;
                    padding: 20px;
                    color: #6c757d;
                    font-style: italic;
                }
                
                @media (max-width: 576px) {
                    .comment-body {
                        margin-left: 0;
                        margin-top: 10px;
                    }
                    
                    .author-actions {
                        margin-left: 0;
                        margin-top: 10px;
                    }
                    
                    .comment-actions {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 8px;
                    }
                    
                    .like-count {
                        margin-left: 10px;
                    }
                }
            `}</style>
        </>
    );
};

export default Comments;
