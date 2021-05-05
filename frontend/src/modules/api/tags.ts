import axios from 'axios';

axios.defaults.withCredentials = true;

import Config from '../config.json';

import { ResponseData } from './index';

export async function getTags(page: number) {
    return await axios.request<ResponseData<GetTagsData>>({
        url: `${Config.API_SERVER}/v1/tags?page=${page}`,
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
        url: `${Config.API_SERVER}/v1/tags/${encodeURIComponent(tag)}?page=${page}`,
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