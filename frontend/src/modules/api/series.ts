import request, { serializeObject } from './request';

export interface GetUserSeriesResponseData {
    series: {
        url: string;
        name: string;
        image: string;
        createdDate: string;
        owner: string;
        totalPosts: number;
    }[];
    lastPage: number;
}

export async function getUserSeries(author: string, page: number) {
    return await request<GetUserSeriesResponseData>({
        url: `/v1/users/${encodeURIComponent(author)}/series`,
        method: 'GET',
        params: { page }
    });
}

export interface PostUserSeriesResponseData {
    url: string;
}

export async function postUserSeries(author: string, title: string) {
    return await request<PostUserSeriesResponseData>({
        url: `/v1/users/${encodeURIComponent(author)}/series`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: serializeObject({ title })
    });
}

export interface PutUserSeriesOrderResponseData {
    series: {
        url: string;
        title: string;
        totalPosts: number;
    }[];
}

export async function putUserSeriesOrder(author: string, items: (string | number)[][]) {
    return await request<PutUserSeriesOrderResponseData>({
        url: `/v1/users/${encodeURIComponent(author)}/series?kind=order`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: serializeObject({ series: items.map(item => `${item[0]}=${item[1]}`).join(',') })
    });
}

export interface GetAnUserSeriesResponseData {
    name: string;
    url: string;
    image: string;
    owner: string;
    ownerImage: string;
    description: string;
    posts: {
        url: string;
        title: string;
        image: string;
        number: number;
        readTime: number;
        description: string;
        createdDate: string;
    }[];
    lastPage: number;
}

export interface GetAnUSerSeriesRequestParams {
    page?: number;
    kind?: 'continue';
    order?: 'latest' | 'past';
}

export async function getAnUserSeries(author: string, url: string, params?: GetAnUSerSeriesRequestParams) {
    return await request<GetAnUserSeriesResponseData>({
        url: `/v1/users/${encodeURIComponent(author)}/series/${encodeURIComponent(url)}`,
        params,
        method: 'GET'
    });
}

export interface putUserSeriesResponseData {
    url: string;
}

export async function putUserSeries(author: string, url: string, data: object) {
    return await request<putUserSeriesResponseData>({
        url: `/v1/users/${encodeURIComponent(author)}/series/${encodeURIComponent(url)}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: serializeObject(data)
    });
}

export async function deleteUserSeries(author: string, url: string) {
    return await request<unknown>({
        url: `/v1/users/${encodeURIComponent(author)}/series/${encodeURIComponent(url)}`,
        method: 'DELETE'
    });
}
