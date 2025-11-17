export interface SearchResult {
    url: string;
    title: string;
    image: string;
    description: string;
    created_date: string;
    author: string;
    author_image: string;
}

export interface SearchResponse {
    status: 'DONE' | 'ERROR';
    body?: {
        posts: SearchResult[];
        last_page: number;
    };
    errorMessage?: string;
}

/**
 * Search posts
 */
export const searchPosts = async (query: string, page: number = 1): Promise<SearchResponse> => {
    const response = await fetch(`/v1/search?q=${encodeURIComponent(query)}&page=${page}`);
    return response.json();
};
