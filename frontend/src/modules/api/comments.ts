import request, {
    GetPostCommentResponseData,
    serializeObject
} from './index';

export type PostCommentsResponseData = GetPostCommentResponseData['comments'][0];

export async function postComments(url: string, content: string) {
    return await request<PostCommentsResponseData>({
        url: '/v1/comments',
        method: 'POST',
        params: { url },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: serializeObject({ comment_md: content })
    });
}

export interface PutCommentLikeResponseData {
    totalLikes: number;
}

export async function putCommentLike(pk: number) {
    return await request<PutCommentLikeResponseData>({
        url: `/v1/comments/${pk}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: serializeObject({ like: pk })
    });
}

export interface GetCommentResponseData {
    textMd: string;
}

export async function getComment(pk: number) {
    return await request<GetCommentResponseData>({
        url: `/v1/comments/${pk}`,
        method: 'GET'
    });
}

export async function putComment(pk: number, content: string) {
    return await request<unknown>({
        url: `/v1/comments/${pk}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: serializeObject({
            comment: 'comment',
            comment_md: content
        })
    });
}

export interface DeleteCommentResponseData {
    author: string;
    authorImage: string;
    textHtml: string;
}

export async function deleteComment(pk: number) {
    return await request<DeleteCommentResponseData>({
        url: `/v1/comments/${pk}`,
        method: 'DELETE'
    });
}