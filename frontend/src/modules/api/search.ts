import request from './request';

export interface GetSearchResponseData {
    elapsedTime: number;
    totalSize: number;
    lastPage: number;
    results: {
        url: string;
        title: string;
        image: string;
        description: string;
        readTime: number;
        createdDate: string;
        authorImage: string;
        author: string;
        positions: string[];
    }[];
}

export async function getSearch(query: string, page = 1, username = '') {
    return await request<GetSearchResponseData>({
        url: '/v1/search',
        params: {
            q: query,
            page,
            username
        },
        method: 'GET'
    });
}

export interface GetSearchHistoryResponseData {
    searches: {
        pk: number;
        value: string;
        createdDate: string;
    }[];
}

export async function getSearchHistory() {
    return await request<GetSearchHistoryResponseData>({
        url: '/v1/search/history',
        method: 'GET'
    });
}

export async function deleteSearchHistory(pk: number) {
    return await request<unknown>({
        url: `/v1/search/history/${pk}`,
        method: 'DELETE'
    });
}

export interface GetSearchSuggestionResponseData {
    results: string[];
}

export async function getSearchSuggestion(query: string) {
    return await request<GetSearchSuggestionResponseData>({
        url: '/v1/search/suggest',
        params: { q: query },
        method: 'GET'
    });
}