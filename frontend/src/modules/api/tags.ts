import axios, { ResponseData } from './index';

export async function getTags(page: number) {
    return await axios.request<ResponseData<GetTagsData>>({
        url: `/v1/tags?page=${page}`,
        method: 'GET'
    });
}

export interface GetTagsData {
    tags: {
        name: string;
        count: number;
        description: string;
    }[];
    lastPage: number;
}

export async function getTag(tag: string, page: number) {
    return await axios.request<ResponseData<GetTagData>>({
        url: `/v1/tags/${encodeURIComponent(tag)}?page=${page}`,
        method: 'GET'
    });
}

export interface GetTagData {
    tag: string;
    lastPage: number;
    descPosts: {
        url: string;
        author: string;
        description: string;
    };
    posts: {
        url: string;
        title: string;
        image: string;
        readTime: number;
        createdDate: string;
        author: string;
        authorImage: string;
    }[];
}