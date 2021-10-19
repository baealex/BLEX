import axiosRequest, {
    ResponseData,
    serializeObject,
    GetPostCommentDataComment,
} from './index';

export async function postComments(url: string, content: string, contentMarkup: string) {
    return await axiosRequest<ResponseData<PostCommentsData>>({
        url: `/v1/comments?url=${url}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            comment_html: contentMarkup,
            comment_md: content
        }),
    });
}

export interface PostCommentsData extends GetPostCommentDataComment {};

export async function putCommentLike(pk: number) {
    return await axiosRequest<ResponseData<PutCommentLike>>({
        url: `/v1/comments/${pk}`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            like: pk
        }),
    });
}

export interface PutCommentLike {
    totalLikes: number;
}

export async function getComment(pk: number) {
    return await axiosRequest<ResponseData<GetComment>>({
        url: `/v1/comments/${pk}`,
        method: 'GET'
    });
}

export interface GetComment {
    textMd: string;
}

export async function putComment(pk: number, content: string, html: string) {
    return await axiosRequest<ResponseData<any>>({
        url: `/v1/comments/${pk}`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            comment: 'comment',
            comment_md: content,
            comment_html: html,
        }),
    });
}

export async function deleteComment(pk: number) {
    return await axiosRequest<ResponseData<DeleteComment>>({
        url: `/v1/comments/${pk}`,
        method: 'DELETE',
    });
}

export interface DeleteComment {
    author: string;
    authorImage: string;
    textHtml: string;
}