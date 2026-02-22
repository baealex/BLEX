import { http, type Response } from '../http.module';

export interface Post {
    url: string;
    title: string;
    image: string;
    description: string;
    createdDate: string;
    updatedDate: string;
    totalLiked: number;
    author: string;
    authorImage: string;
    readTime: number;
    hide: boolean;
    isHide: boolean;
    tag: string;
    series: string | null;
    countLikes: number;
    countComments: number;
}

interface PostsResponseBody {
    posts: Post[];
    username: string;
    lastPage: number;
}

export type PostsResponse = Response<PostsResponseBody>;

export interface PostsFilters {
    search?: string;
    tag?: string;
    series?: string;
    hide?: string;
    sort?: string;
    page?: number;
}

export const getPosts = async (filters: PostsFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            params.append(key, value.toString());
        }
    });

    const queryString = params.toString();
    return http.get<PostsResponse>(`v1/setting/posts${queryString ? `?${queryString}` : ''}`);
};

export const togglePostVisibility = async (username: string, postUrl: string) => {
    return http.put<Response<{ isHide: boolean }>>(`v1/users/@${username}/posts/${postUrl}?hide=hide`);
};

export const deletePost = async (username: string, postUrl: string) => {
    return http.delete<Response<unknown>>(`v1/users/@${username}/posts/${postUrl}`);
};

export const updatePostTags = async (username: string, postUrl: string, tags: string) => {
    const formData = new URLSearchParams();
    formData.append('tag', tags);

    return http.put<Response<{ tag: string }>>(`v1/users/@${username}/posts/${postUrl}?tag=tag`, formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
};

export const updatePostSeries = async (username: string, postUrl: string, series: string) => {
    const formData = new URLSearchParams();
    formData.append('series', series);

    return http.put<Response<{ series: string }>>(`v1/users/@${username}/posts/${postUrl}?series=series`, formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
};

export interface RelatedPost {
    title: string;
    url: string;
    authorUsername: string;
    authorName: string;
    authorImage?: string;
    metaDescription: string;
    image?: string;
    publishedDate: string;
    readTime: number;
}

export const getRelatedPosts = async (username: string, postUrl: string) => {
    return http.get<Response<{ posts: RelatedPost[] }>>(`v1/users/@${username}/posts/${postUrl}/related`);
};

// Draft API
export interface DraftDetail {
    url: string;
    title: string;
    subtitle: string;
    contentType: 'html' | 'markdown';
    textMd: string;
    rawContent: string;
    tags: string;
    description: string;
    image: string | null;
    series: {
        url: string;
        name: string;
    } | null;
    createdDate: string;
}

export interface DraftSummary {
    url: string;
    title: string;
    createdDate: string;
    updatedDate: string;
}

export const createDraft = async (data: { title: string; content: string; tags: string; subtitle?: string; description?: string; series_url?: string } | FormData) => {
    if (data instanceof FormData) {
        return http.post<Response<{ url: string }>>('v1/drafts', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return http.post<Response<{ url: string }>>('v1/drafts', data, { headers: { 'Content-Type': 'application/json' } });
};

export const updateDraft = async (url: string, data: { title?: string; content?: string; tags?: string; subtitle?: string; description?: string; series_url?: string } | FormData) => {
    if (data instanceof FormData) {
        return http.put<Response<{ url: string }>>(`v1/drafts/${url}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return http.put<Response<{ url: string }>>(`v1/drafts/${url}`, data, { headers: { 'Content-Type': 'application/json' } });
};

export const getDraft = async (url: string) => {
    return http.get<Response<DraftDetail>>(`v1/drafts/${url}`);
};

export const getDrafts = async () => {
    return http.get<Response<{ drafts: DraftSummary[] }>>('v1/drafts');
};

export const deleteDraft = async (url: string) => {
    return http.delete<Response<unknown>>(`v1/drafts/${url}`);
};

export interface PostForEdit {
    title: string;
    subtitle: string;
    url: string;
    contentType: 'html' | 'markdown';
    textHtml: string;
    image: string;
    description: string;
    tags: string[];
    series: {
        id: string;
        name: string;
        url: string;
    } | null;
    isHide: boolean;
    isAdvertise: boolean;
}

export const getPostForEdit = async (username: string, postUrl: string) => {
    return http.get<Response<PostForEdit>>(`v1/users/@${username}/posts/${postUrl}?mode=edit`);
};

export const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    return http.post<Response<{ url: string }>>('v1/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};
