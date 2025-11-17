import { http } from '~/modules/http.module';

export interface Post {
    url: string;
    title: string;
    image: string;
    description: string;
    created_date: string;
    updated_date: string;
    total_liked: number;
    author: string;
    author_image: string;
    read_time: number;
    hide: boolean;
    tag: string[];
    series: string | null;
}

export interface PostsResponse {
    status: 'DONE' | 'ERROR';
    body?: {
        posts: Post[];
        last_page: number;
    };
    errorMessage?: string;
}

export interface PostsFilters {
    search?: string;
    tag?: string;
    series?: string;
    hide?: string;
    sort?: string;
    page?: number;
}

/**
 * Get user's posts with filters
 */
export const getPosts = async (filters: PostsFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            params.append(key, value.toString());
        }
    });

    const queryString = params.toString();
    return http.get(`v1/setting/posts${queryString ? `?${queryString}` : ''}`);
};

/**
 * Toggle post visibility
 */
export const togglePostVisibility = async (username: string, postUrl: string) => {
    return http.put(`v1/users/@${username}/posts/${postUrl}?hide=hide`);
};

/**
 * Delete a post
 */
export const deletePost = async (username: string, postUrl: string) => {
    return http.delete(`v1/users/@${username}/posts/${postUrl}`);
};

/**
 * Update post tags
 */
export const updatePostTags = async (username: string, postUrl: string, tags: string) => {
    const formData = new URLSearchParams();
    formData.append('tag', tags);

    return http.put(`v1/users/@${username}/posts/${postUrl}?tag=tag`, formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
};

/**
 * Update post series
 */
export const updatePostSeries = async (username: string, postUrl: string, series: string) => {
    const formData = new URLSearchParams();
    formData.append('series', series);

    return http.put(`v1/users/@${username}/posts/${postUrl}?series=series`, formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
};
