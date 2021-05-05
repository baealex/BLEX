import axios from 'axios';

axios.defaults.withCredentials = true;

import Config from '../config.json';

import {
    ResponseData,
    serializeObject,
    objectToForm,
} from './index';

export async function getPosts(sort: string, page: number) {
    return await axios.request<ResponseData<GetPostsData>>({
        url: `${Config.API_SERVER}/v1/posts?sort=${sort}&page=${page}`,
        method: 'GET',
    });
}

export interface GetPostsData {
    posts: {
        url: string;
        title: string;
        image: string;
        description: string;
        readTime: number;
        createdDate: string;
        author: string;
        authorImage: string;
    }[];
    lastPage: number;
}

export async function postPosts(data: {}) {
    return await axios.request<ResponseData<GetPostPosts>>({
        url: `${Config.API_SERVER}/v1/posts`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: objectToForm(data),
        withCredentials: true,
    });
}

interface GetPostPosts {
    url: string;
}

export async function getPost(url: string, mode: string, cookie?: string) {
    return await axios.request<ResponseData<GetPostData>>({
        url: `${Config.API_SERVER}/v1/posts/${encodeURIComponent(url)}?mode=${mode}`,
        method: 'GET',
        headers: cookie ? { cookie } : undefined
    });
}

export interface GetPostData {
    url: string;
    title: string;
    image: string;
    description: string;
    readTime: number;
    series?: string;
    createdDate: string;
    updatedDate: string;
    authorImage: string;
    author: string;
    textHtml: string;
    totalLikes: number;
    totalComment: number;
    tag: string;
    isLiked: boolean;
}

export async function getPostComments(url: string) {
    return await axios.request<ResponseData<GetPostCommentData>>({
        url: `${Config.API_SERVER}/v1/posts/${encodeURIComponent(url)}/comments`,
        method: 'GET',
    });
}

export interface GetPostCommentData {
    comments: GetPostCommentDataComment[];
};

export interface GetPostCommentDataComment {
    pk: number;
    author: string;
    authorImage: string;
    isEdited: boolean;
    textHtml: string;
    timeSince: string;
    totalLikes: number;
    isLiked: boolean;
}

export async function postPost(url: string, data: {}) {
    return await axios.request<ResponseData<any>>({
        url: `${Config.API_SERVER}/v1/posts/${encodeURIComponent(url)}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: objectToForm(data),
        withCredentials: true,
    });
}

export async function putPost(url: string, item: string, data = {}) {
    return await axios.request<ResponseData<PutPostData>>({
        url: `${Config.API_SERVER}/v1/posts/${encodeURIComponent(url)}?${item}=${item}`,
        method: 'PUT',
        withCredentials: true,
        data: serializeObject(data),
    });
}

export interface PutPostData {
    totalLikes?: number;
    isHide?: boolean;
    tag?: string;
}

export async function deletePost(url: string) {
    return await axios.request<ResponseData<any>>({
        url: `${Config.API_SERVER}/v1/posts/${encodeURIComponent(url)}`,
        method: 'DELETE',
        withCredentials: true,
    });
}

export async function getPostAnalytics(url: string) {
    return await axios.request<ResponseData<GetPostAnalytics>>({
        url: `${Config.API_SERVER}/v1/posts/${encodeURIComponent(url)}/analytics`,
        method: 'GET'
    });
}

export interface GetPostAnalytics {
    items: {
        date: string;
        count: number;
    }[];
    referers: {
        time: string;
        from: string;
        title: string;
    }[];
}

export async function postPostAnalytics(url: string, data: {}, cookie?: string) {
    return await axios.request<ResponseData<PostPostAnalyticsData>>({
        url: `${Config.API_SERVER}/v1/posts/${encodeURIComponent(url)}/analytics`,
        method: 'POST',
        headers: cookie ? { cookie } : undefined,
        data: serializeObject(data),
        withCredentials: true,
    });
}

export interface PostPostAnalyticsData {
    rand: string;
}