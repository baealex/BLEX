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