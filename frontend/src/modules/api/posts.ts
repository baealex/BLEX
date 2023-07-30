import request, {
    objectToForm,
    serializeObject
} from './request';
import type { Headers } from './request';

export interface GetTempPostsResponseData {
    temps: {
        token: string;
        title: string;
        createdDate: string;
    }[];
}

export function getTempPosts() {
    return request<GetTempPostsResponseData>({
        url: '/v1/temp-posts',
        method: 'GET'
    });
}

export interface PostTempPostsResponseData {
    token: string;
}

export function postTempPosts(title: string, text_md: string, tag: string) {
    return request<PostTempPostsResponseData>({
        url: '/v1/temp-posts',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: serializeObject({
            title,
            text_md,
            tag
        })
    });
}

export interface GetAnTempPostsResponseData {
    title: string;
    token: string;
    textMd: string;
    tags: string;
    createdDate: string;
}

export function getAnTempPosts(token: string, headers?: Headers) {
    return request<GetAnTempPostsResponseData>({
        url: `/v1/temp-posts/${token}`,
        method: 'GET',
        headers
    });
}

export function putTempPosts(token: string, title: string, text_md: string, tag: string) {
    return request<unknown>({
        url: `/v1/temp-posts/${token}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: serializeObject({
            title,
            text_md,
            tag
        })
    });
}

export function deleteTempPosts(token: string) {
    return request<unknown>({
        url: `/v1/temp-posts/${token}`,
        method: 'DELETE',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
}

export interface GetPostsResponseData {
    posts: {
        url: string;
        title: string;
        image: string;
        description: string;
        readTime: number;
        createdDate: string;
        author: string;
        authorImage: string;
        isAd: boolean;
    }[];
    lastPage: number;
}

export function getPopularPosts(page: number) {
    return request<GetPostsResponseData>({
        url: `/v1/posts/popular?page=${page}`,
        method: 'GET'
    });
}

export function getNewestPosts(page: number) {
    return request<GetPostsResponseData>({
        url: `/v1/posts/newest?page=${page}`,
        method: 'GET'
    });
}

export function getLikedPosts(page: number, cookie?: string) {
    return request<GetPostsResponseData>({
        url: `/v1/posts/liked?page=${page}`,
        method: 'GET',
        headers: cookie ? { cookie } : undefined
    });
}

export interface GetTopTrendyPostsResponseData {
    posts: {
        url: string;
        title: string;
        readTime: number;
        createdDate: string;
        author: string;
        authorImage: string;
        isAd: boolean;
    }[];
}

export function getTrendyTopPosts() {
    return request<GetTopTrendyPostsResponseData>({
        url: '/v1/posts/top-trendy',
        method: 'GET'
    });
}

interface CreatePostRequestData {
    token: string;
    title: string;
    text_md: string;
    image?: File;
    tag: string;
    url: string;
    description: string;
    series: string;
    verification: string;
    reserved_date?: string;
    is_hide: string;
    is_advertise: string;
}

interface CreatePostResponseData {
    url: string;
}

export function createPost(data: CreatePostRequestData) {
    return request<CreatePostResponseData>({
        url: '/v1/posts',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: objectToForm(data)
    });
}

export interface GetUserPostsResponseData {
    allCount: number;
    posts: {
        url: string;
        title: string;
        image: string;
        readTime: number;
        description: string;
        createdDate: string;
        authorImage: string;
        author: string;
        isAd: boolean;
        tags: string[];
    }[];
    lastPage: number;
}

export function getUserPosts(author: string, page: number, tag = '') {
    return request<GetUserPostsResponseData>({
        url: `/v1/users/${encodeURIComponent(author)}/posts?tag=${encodeURIComponent(tag)}&page=${page}`,
        method: 'GET'
    });
}

export interface GetAnUserPostsViewResponseData {
    url: string;
    title: string;
    image: string;
    description: string;
    readTime: number;
    series?: string;
    seriesName?: string;
    createdDate: string;
    updatedDate: string;
    authorImage: string;
    author: string;
    textHtml: string;
    totalLikes: number;
    totalComment: number;
    isAd: boolean;
    tags: string[];
    isLiked: boolean;
}

export function getAnUserPostsView(username: string, url: string, cookie?: string) {
    return request<GetAnUserPostsViewResponseData>({
        url: `/v1/users/${encodeURIComponent(username)}/posts/${encodeURIComponent(url)}?mode=view`,
        method: 'GET',
        headers: cookie ? { cookie } : undefined
    });
}

export interface GetAnUserPostsEditResponseData {
    image: string;
    title: string;
    series: string;
    description: string;
    textMd: string;
    tags: string[];
    isHide: boolean;
    isAdvertise: boolean;
}

export function getAnUserPostsEdit(username: string, url: string, cookie?: string) {
    return request<GetAnUserPostsEditResponseData>({
        url: `/v1/users/${encodeURIComponent(username)}/posts/${encodeURIComponent(url)}?mode=edit`,
        method: 'GET',
        headers: cookie ? { cookie } : undefined
    });
}

export function postAnUserPosts(author: string, url: string, data: object) {
    return request<unknown>({
        url: `/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: objectToForm(data)
    });
}

export interface PutAnUserPostsResponseData {
    totalLikes?: number;
    isHide?: boolean;
    tag?: string;
}

export function putAnUserPosts(author: string, url: string, item: string, data = {}) {
    return request<PutAnUserPostsResponseData>({
        url: `/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}?${item}=${item}`,
        method: 'PUT',

        data: serializeObject(data)
    });
}

export function deleteAnUserPosts(author: string, url: string) {
    return request<unknown>({
        url: `/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}`,
        method: 'DELETE'
    });
}

export interface GetFeaturePostsResponseData {
    posts: {
        url: string;
        title: string;
        image: string;
        readTime: number;
        createdDate: string;
        authorImage: string;
        author: string;
    }[];
}

export function getFeaturePosts(username: string, exclude: string) {
    return request<GetFeaturePostsResponseData>({
        url: `/v1/posts/feature?${serializeObject({
            username,
            exclude
        })}`,
        method: 'GET'
    });
}

export interface GetFeatureTagPostsResponseData {
    posts: {
        url: string;
        title: string;
        image: string;
        readTime: number;
        createdDate: string;
        authorImage: string;
        author: string;
    }[];
}

export function getFeatureTagPosts(tag: string, exclude: string) {
    return request<GetFeatureTagPostsResponseData>({
        url: `/v1/posts/feature/${tag}?${serializeObject({ exclude })}`,
        method: 'GET'
    });
}

export interface GetPostCommentResponseData {
    comments: {
        pk: number;
        author: string;
        authorImage: string;
        isEdited: boolean;
        textHtml: string;
        createdDate: string;
        totalLikes: number;
        isLiked: boolean;
    }[];
}

export function getPostComments(url: string) {
    return request<GetPostCommentResponseData>({
        url: `/v1/posts/${encodeURIComponent(url)}/comments`,
        method: 'GET'
    });
}

export interface GetPostAnalytics {
    items: {
        date: string;
        count: number;
    }[];
    referers: {
        time: string;
        from: string;
        title: string;
    }[];
    thanks: {
        positiveCount: number;
        negativeCount: number;
    };
}

export function getPostAnalytics(url: string) {
    return request<GetPostAnalytics>({
        url: `/v1/posts/${encodeURIComponent(url)}/analytics`,
        method: 'GET'
    });
}

export interface PostPostAnalyticsData {
    rand: string;
}

export function postPostAnalytics(url: string, data: object, cookie?: string) {
    return request<PostPostAnalyticsData>({
        url: `/v1/posts/${encodeURIComponent(url)}/analytics`,
        method: 'POST',
        headers: cookie ? { cookie } : undefined,
        data: serializeObject(data)
    });
}

export interface PostAutoGenegrateDescriptionRequestData {
    text_md: string;
}

export interface PostAutoGenegrateDescriptionResponseData {
    description: string;
}

export function postAutoGenerateDescription(data: PostAutoGenegrateDescriptionRequestData) {
    return request<PostAutoGenegrateDescriptionResponseData>({
        url: '/v1/openai/description',
        method: 'POST',
        data: serializeObject(data)
    });
}
