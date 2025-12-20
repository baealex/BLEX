import { http, type Response } from '../http.module';

export interface SearchResult {
    url: string;
    title: string;
    image: string;
    description: string;
    createdDate: string;
    author: string;
    authorImage: string;
    readTime?: number;
    positions?: string[];
}

export interface SearchResponseBody {
    results: SearchResult[];
    lastPage: number;
    query?: string;
    totalSize?: number;
    elapsedTime?: number;
}

export type SearchResponse = Response<SearchResponseBody>;

export const searchPosts = async (query: string, page: number = 1) => {
    return http.get<SearchResponse>(`/v1/search?q=${encodeURIComponent(query)}&page=${page}`);
};
