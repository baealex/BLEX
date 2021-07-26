import axios, {
    ResponseData,
} from './index';

export async function getSearch(query: string, page=1, username='') {
    return await axios.request<ResponseData<GetSearchData>>({
        url: `/v1/search?q=${encodeURIComponent(query)}&page=${page}&username=${username}`,
        method: 'GET',
    });
}

export interface GetSearchData {
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
    }[];
}

export async function getSearchHistory() {
    return await axios.request<ResponseData<GetSearchHistoryData>>({
        url: '/v1/search/history',
        method: 'GET',
    });
}

export interface GetSearchHistoryData {
    searches: {
        pk: number,
        value: string,
    }[];
}

export async function deleteSearchHistory(pk: number) {
    return await axios.request<ResponseData<any>>({
        url: `/v1/search/history/${pk}`,
        method: 'DELETE',
    });
}