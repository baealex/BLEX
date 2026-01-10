import { http, type Response } from '../http.module';

export interface Comment {
    id: number;
    author: string;
    authorImage: string;
    createdDate: string;
    renderedContent: string;
    contentMarkdown: string;
    countLikes: number;
    isLiked: boolean;
    isEdited: boolean;
    isMine: boolean;
    parentId?: number;
    replies?: Comment[];
}

export type CommentsResponse = Response<{ comments: Comment[] }>;
export type CommentResponse = Response<{ textMd: string }>;
export type CommentActionResponse = Response<{ success: boolean }>;

export const getComments = async (postUrl: string) => {
    return http.get<CommentsResponse>(`v1/posts/${postUrl}/comments`);
};

export const createComment = async (postUrl: string, commentMarkdown: string, parentId?: number) => {
    const formData = new URLSearchParams();
    formData.append('comment_md', commentMarkdown);
    if (parentId) {
        formData.append('parent_id', parentId.toString());
    }

    return http.post<CommentActionResponse>(`v1/comments?url=${postUrl}`, formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
};

export const getComment = async (commentId: number) => {
    return http.get<CommentResponse>(`v1/comments/${commentId}`);
};

export const updateComment = async (commentId: number, commentMarkdown: string) => {
    const formData = new URLSearchParams();
    formData.append('comment', 'true');
    formData.append('comment_md', commentMarkdown);

    return http.put<CommentActionResponse>(`v1/comments/${commentId}`, formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
};

export const deleteComment = async (commentId: number) => {
    return http.delete<CommentActionResponse>(`v1/comments/${commentId}`);
};

export const toggleCommentLike = async (commentId: number) => {
    const formData = new URLSearchParams();
    formData.append('like', 'like');

    return http.put<CommentActionResponse>(`v1/comments/${commentId}`, formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
};

export const getCommentAuthors = (comments: Comment[]): string[] => {
    const authors = new Set<string>();

    const collectAuthors = (commentList: Comment[]) => {
        commentList.forEach(comment => {
            if (comment.author && comment.author !== 'Ghost') {
                authors.add(comment.author);
            }
            if (comment.replies && comment.replies.length > 0) {
                collectAuthors(comment.replies);
            }
        });
    };

    collectAuthors(comments);
    return Array.from(authors).sort();
};
