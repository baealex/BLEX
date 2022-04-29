import axiosRequest, { ResponseData } from './index';

export async function getTags(page: number) {
    return await axiosRequest<ResponseData<GetTagsData>>({
        url: '/v1/tags',
        method: 'GET',
        params: {
            page 
        },
    });
}

export interface GetTagsData {
    tags: {
        name: string;
        count: number;
    }[];
    lastPage: number;
}

export async function getTag(tag: string, page: number) {
    return await axiosRequest<ResponseData<GetTagData>>({
        url: `/v1/tags/${encodeURIComponent(tag)}`,
        method: 'GET',
        params: {
            page 
        },
    });
}

export interface GetTagData {
    tag: string;
    desc: {
        url: string;
        author: string;
        authorImage: string;
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
    lastPage: number;
}