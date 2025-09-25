import { http, type Response } from '~/modules/http.module';

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

export const commentsApi = {
    // Get comments for a post
    getComments: async (postUrl: string) => {
        const response = await http<Response<{ comments: Comment[] }>>(`v1/posts/${postUrl}/comments`, { method: 'GET' });
        if (response.data.status === 'ERROR') {
            throw new Error(response.data.errorMessage);
        }
        return response.data.body;
    },

    // Create a new comment
    createComment: async (postUrl: string, commentText: string) => {
        const params = new URLSearchParams();
        params.append('comment_md', commentText);

        const response = await http<Response<Comment>>(`v1/comments?url=${encodeURIComponent(postUrl)}`, {
            method: 'POST',
            data: params.toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (response.data.status !== 'DONE') {
            throw new Error(response.data.errorMessage || 'Failed to post comment');
        }

        return response.data;
    },

    // Get comment data for editing
    getCommentForEdit: async (commentId: number) => {
        const response = await http<Response<CommentEditData>>(`v1/comments/${commentId}`, { method: 'GET' });

        if (response.data.status !== 'DONE' || !response.data.body) {
            throw new Error('Failed to get comment data');
        }

        return response.data.body;
    },

    // Update a comment
    updateComment: async (commentId: number, commentText: string) => {
        const params = new URLSearchParams();
        params.append('comment', 'true');
        params.append('comment_md', commentText);

        const response = await http<Response<Comment>>(`v1/comments/${commentId}`, {
            method: 'PUT',
            data: params.toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (response.data.status !== 'DONE') {
            throw new Error(response.data.errorMessage || 'Failed to update comment');
        }

        return response.data;
    },

    // Delete a comment
    deleteComment: async (commentId: number) => {
        const response = await http<Response<Comment>>(`v1/comments/${commentId}`, { method: 'DELETE' });

        if (response.data.status !== 'DONE') {
            throw new Error(response.data.errorMessage || 'Failed to delete comment');
        }

        return response.data;
    },

    // Like/unlike a comment
    likeComment: async (commentId: number) => {
        const response = await http<Response<{ countLikes: number }>>(`v1/comments/${commentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: 'like=like'
        });

        if (response.data.status !== 'DONE') {
            throw new Error('Failed to like comment');
        }

        return response.data;
    }
};
