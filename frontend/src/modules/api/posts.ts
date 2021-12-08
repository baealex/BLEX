import axiosRequest, {
    objectToForm,
    ResponseData,
    serializeObject,
} from './index';

export interface GetTempPostsDataTemp {
    token: string;
    title: string;
    createdDate: string;
}

export interface GetTempPostsData {
    temps: GetTempPostsDataTemp[];
}

export async function getTempPosts() {
    return await axiosRequest<ResponseData<GetTempPostsData>>({
        url: `/v1/posts/temp?get=list`,
        method: 'GET',
    });
}

export interface PostTempPostsData {
    token: string;
}

export async function postTempPosts(title: string, text_md: string, tag: string) {
    return await axiosRequest<ResponseData<PostTempPostsData>>({
        url: `/v1/posts/temp`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            title,
            text_md,
            tag
        }),
    });
}

export interface GetAnTempPostsData {
    title: string;
    token: string;
    textMd: string;
    tags: string[];
    createdDate: string;
}

export async function getAnTempPosts(token: string) {
    return await axiosRequest<ResponseData<GetAnTempPostsData>>({
        url: `/v1/posts/temp/${token}`,
        method: 'GET',
    });
}

export async function putTempPosts(token: string, title: string, text_md: string, tag: string) {
    return await axiosRequest<ResponseData<any>>({
        url: `/v1/posts/temp/${token}`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            title,
            text_md,
            tag
        }),
    });
}

export async function deleteTempPosts(token: string) {
    return await axiosRequest<ResponseData<any>>({
        url: `/v1/posts/temp/${token}`,
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
    });
}

export interface GetPostsData {
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

export async function getPopualrPosts(page: number) {
    return await axiosRequest<ResponseData<GetPostsData>>({
        url: `/v1/posts/popular?page=${page}`,
        method: 'GET',
    });
}

export async function getNewestPosts(page: number) {
    return await axiosRequest<ResponseData<GetPostsData>>({
        url: `/v1/posts/newest?page=${page}`,
        method: 'GET',
    });
}

export interface GetTopTrendyPostsData {
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

export async function getTrendyTopPosts() {
    return await axiosRequest<ResponseData<GetTopTrendyPostsData>>({
        url: `/v1/posts/top-trendy`,
        method: 'GET',
    });
}

interface PostPostsData {
    url: string;
}

export async function postPosts(data: {}) {
    return await axiosRequest<ResponseData<PostPostsData>>({
        url: `/v1/posts`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: objectToForm(data),
    });
}

export interface GetUserPostsDataPosts {
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
}

export interface GetUserPostsData {
    allCount: number;
    posts: GetUserPostsDataPosts[];
    lastPage: number;
}

export async function getUserPosts(author: string, page: number, tag='') {
    return await axiosRequest<ResponseData<GetUserPostsData>>({
        url: `/v1/users/${encodeURIComponent(author)}/posts?tag=${encodeURIComponent(tag)}&page=${page}`,
        method: 'GET',
    });
}

export interface GetAnUserPostsViewData {
    url: string;
    title: string;
    image: string;
    description: string;
    readTime: number;
    series?: string;
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

export async function getAnUserPostsView(username: string, url: string, cookie?: string) {
    return await axiosRequest<ResponseData<GetAnUserPostsViewData>>({
        url: `/v1/users/${encodeURIComponent(username)}/posts/${encodeURIComponent(url)}?mode=view`,
        method: 'GET',
        headers: cookie ? { cookie } : undefined
    });
}

export interface GetAnUserPostsEditData {
    image: string;
    title: string;
    series: string;
    textMd: string;
    tags: string[];
    isHide: boolean;
    isAdvertise: boolean;
}

export async function getAnUserPostsEdit(username: string, url: string, cookie?: string) {
    return await axiosRequest<ResponseData<GetAnUserPostsEditData>>({
        url: `/v1/users/${encodeURIComponent(username)}/posts/${encodeURIComponent(url)}?mode=edit`,
        method: 'GET',
        headers: cookie ? { cookie } : undefined
    });
}

export async function postAnUserPosts(author: string, url: string, data: {}) {
    return await axiosRequest<ResponseData<any>>({
        url: `/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: objectToForm(data),
    });
}

export interface PutAnUserPostsData {
    totalLikes?: number;
    isHide?: boolean;
    tag?: string;
}

export async function putAnUserPosts(author: string, url: string, item: string, data = {}) {
    return await axiosRequest<ResponseData<PutAnUserPostsData>>({
        url: `/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}?${item}=${item}`,
        method: 'PUT',
        
        data: serializeObject(data),
    });
}

export async function deleteAnUserPosts(author: string, url: string) {
    return await axiosRequest<ResponseData<any>>({
        url: `/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}`,
        method: 'DELETE',
    });
}

export interface GetFeaturePostsDataPosts {
    url: string;
    title: string;
    image: string;
    readTime: number;
    createdDate: string;
    authorImage: string;
    author: string;
}

export interface GetFeaturePostsData {
    posts: GetFeaturePostsDataPosts[];
}

export async function getFeaturePosts(username: string, exclude: string) {
    return await axiosRequest<ResponseData<GetFeaturePostsData>>({
        url: `/v1/posts/feature?${serializeObject({username, exclude})}`,
        method: 'GET',
    });
}

export interface GetFeatureTagPostsData {
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

export async function getFeatureTagPosts(tag: string, exclude: string) {
    return await axiosRequest<ResponseData<GetFeatureTagPostsData>>({
        url: `/v1/posts/feature/${tag}?${serializeObject({exclude})}`,
        method: 'GET',
    });
}

export interface GetPostCommentDataComment {
    pk: number;
    author: string;
    authorImage: string;
    isEdited: boolean;
    textHtml: string;
    timeSince: string;
    totalLikes: number;
    isLiked: boolean;
}

export interface GetPostCommentData {
    comments: GetPostCommentDataComment[];
};

export async function getPostComments(url: string) {
    return await axiosRequest<ResponseData<GetPostCommentData>>({
        url: `/v1/posts/${encodeURIComponent(url)}/comments`,
        method: 'GET',
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
}

export async function getPostAnalytics(url: string) {
    return await axiosRequest<ResponseData<GetPostAnalytics>>({
        url: `/v1/posts/${encodeURIComponent(url)}/analytics`,
        method: 'GET'
    });
}

export interface PostPostAnalyticsData {
    rand: string;
}

export async function postPostAnalytics(url: string, data: {}, cookie?: string) {
    return await axiosRequest<ResponseData<PostPostAnalyticsData>>({
        url: `/v1/posts/${encodeURIComponent(url)}/analytics`,
        method: 'POST',
        headers: cookie ? { cookie } : undefined,
        data: serializeObject(data),
    });
}