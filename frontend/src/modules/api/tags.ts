import request from './request';

export interface GetTagsResponseData {
    tags: {
        name: string;
        count: number;
        description: string;
    }[];
    lastPage: number;
}

export async function getTags(page: number) {
    return await request<GetTagsResponseData>({
        url: '/v1/tags',
        method: 'GET',
        params: { page }
    });
}

export interface GetTagResponseData {
    tag: string;
    headPost?: {
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
        hasLiked: boolean;
        countLikes: number;
        countComments: number;
    }[];
    lastPage: number;
}

export async function getTag(tag: string, page: number, cookie?: string) {
    return await request<GetTagResponseData>({
        url: `/v1/tags/${encodeURIComponent(tag)}`,
        method: 'GET',
        params: { page },
        headers: { cookie }
    });
}
