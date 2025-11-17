import { http } from '~/modules/http.module';

export interface Comment {
    pk: number;
    author: string;
    author_image: string;
    created_date: string;
    content_html: string;
    content_markdown: string;
    total_liked: number;
    is_edited: boolean;
    is_mine: boolean;
    has_liked: boolean;
}

export interface CommentsResponse {
    status: 'DONE' | 'ERROR';
    body?: Comment[];
    errorMessage?: string;
}

export interface CommentResponse {
    status: 'DONE' | 'ERROR';
    body?: Comment;
    errorMessage?: string;
}

/**
 * Get all comments for a post
 */
export const getComments = async (postUrl: string) => {
    return http.get(`v1/posts/${postUrl}/comments`);
};

/**
 * Create a new comment
 */
export const createComment = async (postUrl: string, commentMarkdown: string) => {
    const formData = new URLSearchParams();
    formData.append('comment_md', commentMarkdown);

    return http.post(`v1/comments?url=${postUrl}`, formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
};

/**
 * Get a single comment for editing
 */
export const getComment = async (commentId: number) => {
    return http.get(`v1/comments/${commentId}`);
};

/**
 * Update a comment
 */
export const updateComment = async (commentId: number, commentMarkdown: string) => {
    const formData = new URLSearchParams();
    formData.append('comment_md', commentMarkdown);

    return http.put(`v1/comments/${commentId}`, formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
};

/**
 * Delete a comment
 */
export const deleteComment = async (commentId: number) => {
    return http.delete(`v1/comments/${commentId}`);
};

/**
 * Toggle like on a comment
 */
export const toggleCommentLike = async (commentId: number) => {
    const formData = new URLSearchParams();
    formData.append('like', 'like');

    return http.put(`v1/comments/${commentId}`, formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
};
