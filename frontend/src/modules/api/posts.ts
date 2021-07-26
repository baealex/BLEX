import axios, {
    objectToForm,
    ResponseData,
    serializeObject,
} from './index';

export async function getTempPosts() {
    return await axios.request<ResponseData<GetTempPostsData>>({
        url: `/v1/posts/temp?get=list`,
        method: 'GET',
    });
}

export interface GetTempPostsData {
    temps: GetTempPostsDataTemp[];
}

export interface GetTempPostsDataTemp {
    token: string;
    title: string;
    createdDate: string;
}

export async function getAnTempPosts(token: string) {
    return await axios.request<ResponseData<GetAnTempPostsData>>({
        url: `/v1/posts/temp?token=${token}`,
        method: 'GET',
    });
}

export interface GetAnTempPostsData {
    title: string;
    token: string;
    textMd: string;
    tag: string;
    createdDate: string;
}

export async function postTempPosts(title: string, text_md: string, tag: string) {
    return await axios.request<ResponseData<PostTempPostsData>>({
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

export interface PostTempPostsData {
    token: string;
}

export async function putTempPosts(token: string, title: string, text_md: string, tag: string) {
    return await axios.request<ResponseData<any>>({
        url: `/v1/posts/temp`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            token,
            title,
            text_md,
            tag
        }),
    });
}

export async function deleteTempPosts(token: string) {
    return await axios.request<ResponseData<any>>({
        url: `/v1/posts/temp`,
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            token
        }),
    });
}

export async function getPosts(sort: string, page: number) {
    return await axios.request<ResponseData<GetPostsData>>({
        url: `/v1/posts?sort=${sort}&page=${page}`,
        method: 'GET',
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
    }[];
    lastPage: number;
}

export async function postPosts(data: {}) {
    return await axios.request<ResponseData<GetPostPosts>>({
        url: `/v1/posts`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: objectToForm(data),
    });
}

interface GetPostPosts {
    url: string;
}

export async function getUserPosts(author: string, page: number, tag='') {
    return await axios.request<ResponseData<GetUserPostsData>>({
        url: `/v1/users/${encodeURIComponent(author)}/posts?tag=${encodeURIComponent(tag)}&page=${page}`,
        method: 'GET',
    });
}

export interface GetUserPostsData {
    allCount: number;
    posts: GetUserPostsDataPosts[];
    lastPage: number;
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
    tag: string;
}

export async function getAnUserPostsView(username: string, url: string, cookie?: string) {
    return await axios.request<ResponseData<GetAnUserPostsViewData>>({
        url: `/v1/users/${encodeURIComponent(username)}/posts/${encodeURIComponent(url)}?mode=view`,
        method: 'GET',
        headers: cookie ? { cookie } : undefined
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
    tag: string;
    isLiked: boolean;
}

export async function getAnUserPostsEdit(username: string, url: string, cookie?: string) {
    return await axios.request<ResponseData<GetAnUserPostsEditData>>({
        url: `/v1/users/${encodeURIComponent(username)}/posts/${encodeURIComponent(url)}?mode=edit`,
        method: 'GET',
        headers: cookie ? { cookie } : undefined
    });
}

export interface GetAnUserPostsEditData {
    image: string;
    title: string;
    series: string;
    textMd: string;
    tag: string;
    isHide: boolean;
    isAdvertise: boolean;
}

export async function postAnUserPosts(author: string, url: string, data: {}) {
    return await axios.request<ResponseData<any>>({
        url: `/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: objectToForm(data),
    });
}

export async function putAnUserPosts(author: string, url: string, item: string, data = {}) {
    return await axios.request<ResponseData<PutAnUserPostsData>>({
        url: `/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}?${item}=${item}`,
        method: 'PUT',
        
        data: serializeObject(data),
    });
}

export interface PutAnUserPostsData {
    totalLikes?: number;
    isHide?: boolean;
    tag?: string;
}

export async function deleteAnUserPosts(author: string, url: string) {
    return await axios.request<ResponseData<any>>({
        url: `/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}`,
        method: 'DELETE',
    });
}

export async function getFeaturePosts(username: string, exclude: string) {
    return await axios.request<ResponseData<GetFeaturePostsData>>({
        url: `/v1/posts/feature?${serializeObject({username, exclude})}`,
        method: 'GET',
    });
}

export interface GetFeaturePostsData {
    posts: GetFeaturePostsDataPosts[];
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

export async function getFeatureTagPosts(tag: string, exclude: string) {
    return await axios.request<ResponseData<GetFeatureTagPostsData>>({
        url: `/v1/posts/feature/${tag}?${serializeObject({exclude})}`,
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

export async function getPostComments(url: string) {
    return await axios.request<ResponseData<GetPostCommentData>>({
        url: `/v1/posts/${encodeURIComponent(url)}/comments`,
        method: 'GET',
    });
}

export interface GetPostCommentData {
    comments: GetPostCommentDataComment[];
};

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

export async function getPostAnalytics(url: string) {
    return await axios.request<ResponseData<GetPostAnalytics>>({
        url: `/v1/posts/${encodeURIComponent(url)}/analytics`,
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
}

export async function postPostAnalytics(url: string, data: {}, cookie?: string) {
    return await axios.request<ResponseData<PostPostAnalyticsData>>({
        url: `/v1/posts/${encodeURIComponent(url)}/analytics`,
        method: 'POST',
        headers: cookie ? { cookie } : undefined,
        data: serializeObject(data),
    });
}

export interface PostPostAnalyticsData {
    rand: string;
}