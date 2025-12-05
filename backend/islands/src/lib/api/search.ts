import { http, type Response } from '~/modules/http.module';

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

export interface SearchFilters {
    username?: string;
    tag?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: 'relevance' | 'latest' | 'popular';
}

export const searchPosts = async (query: string, page: number = 1, filters?: SearchFilters) => {
    const params = new URLSearchParams({
        q: query,
        page: page.toString(),
    });

    if (filters?.username) {
        params.append('username', filters.username);
    }
    if (filters?.tag) {
        params.append('tag', filters.tag);
    }
    if (filters?.dateFrom) {
        params.append('date_from', filters.dateFrom);
    }
    if (filters?.dateTo) {
        params.append('date_to', filters.dateTo);
    }
    if (filters?.sort) {
        params.append('sort', filters.sort);
    }

    return http.get<SearchResponse>(`/v1/search?${params.toString()}`);
};
