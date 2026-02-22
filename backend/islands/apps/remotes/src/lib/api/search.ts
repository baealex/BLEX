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

interface SearchPostsOptions {
    page?: number;
    username?: string;
}

export const searchPosts = async (query: string, options: SearchPostsOptions = {}) => {
    const params = new URLSearchParams({
        q: query,
        page: String(options.page ?? 1)
    });

    if (options.username) {
        params.set('username', options.username);
    }

    return http.get<SearchResponse>(`/v1/search?${params.toString()}`);
};
