import axios from 'axios';

axios.defaults.withCredentials = true;

import Config from '../config.json';

import {
    ResponseData,
    serializeObject,
    GetPostCommentDataComment,
} from './index';


export async function postComments(url: string, content: string, contentMarkup: string) {
    return await axios.request<ResponseData<PostCommentsData>>({
        url: `${Config.API_SERVER}/v1/comments?url=${url}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            comment_html: contentMarkup,
            comment_md: content
        }),
        withCredentials: true,
    });
}

export interface PostCommentsData extends GetPostCommentDataComment {};

export async function putCommentLike(pk: number) {
    return await axios.request<ResponseData<PutCommentLike>>({
        url: `${Config.API_SERVER}/v1/comments/${pk}`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            like: pk
        }),
        withCredentials: true,
    });
}

export interface PutCommentLike {
    totalLikes: number;
}

export async function getComment(pk: number) {
    return await axios.request<ResponseData<GetComment>>({
        url: `${Config.API_SERVER}/v1/comments/${pk}`,
        method: 'GET'
    });
}

export interface GetComment {
    textMd: string;
}

export async function putComment(pk: number, content: string, html: string) {
    return await axios.request<ResponseData<any>>({
        url: `${Config.API_SERVER}/v1/comments/${pk}`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            comment: 'comment',
            comment_md: content,
            comment_html: html,
        }),
        withCredentials: true,
    });
}

export async function deleteComment(pk: number) {
    return await axios.request<ResponseData<DeleteComment>>({
        url: `${Config.API_SERVER}/v1/comments/${pk}`,
        method: 'DELETE',
        withCredentials: true,
    });
}

export interface DeleteComment {
    author: string;
    authorImage: string;
    textHtml: string;
}