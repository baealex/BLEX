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

export const togglePostNotice = async (username: string, postUrl: string) => {
    return http.put<Response<{ isNotice: boolean }>>(`v1/users/@${username}/posts/${postUrl}?notice=notice`);
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
    metaDescription: string;
    image?: string;
    createdDate: string;
    readTime: number;
}

export const getRelatedPosts = async (username: string, postUrl: string) => {
    return http.get<Response<{ posts: RelatedPost[] }>>(`v1/users/@${username}/posts/${postUrl}/related`);
};

export const createTempPost = async (data: { title: string; content: string; tags: string }) => {
    return http.post<Response<{ token: string }>>('v1/temp-posts', data, { headers: { 'Content-Type': 'application/json' } });
};

export const updateTempPost = async (token: string, data: { title: string; text_md: string; tag: string }) => {
    const formData = new URLSearchParams();
    formData.append('title', data.title);
    formData.append('text_md', data.text_md);
    formData.append('tag', data.tag);

    return http.put<Response<{ success: boolean }>>(`v1/temp-posts/${token}`, formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
};

export interface TempPostDetail {
    token: string;
    title: string;
    textMd: string;
    rawContent: string;
    tags: string;
    createdDate: string;
}

export const getTempPost = async (token: string) => {
    return http.get<Response<TempPostDetail>>(`v1/temp-posts/${token}`);
};

export interface PostForEdit {
    title: string;
    url: string;
    textHtml: string;
    image: string;
    description: string;
    tags: string[];
    series: {
        id: string;
        name: string;
    } | null;
    isHide: boolean;
    isNotice: boolean;
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
