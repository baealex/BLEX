import request, {
    Headers,
    serializeObject
} from './index';

export interface GetSettingNotifyResponseData {
    notify: {
        pk: number;
        url: string;
        isRead: boolean;
        content: string;
        createdDate: string;
    }[];
    isTelegramSync: boolean;
}

export async function getSettingNotify(headers?: Headers) {
    return await request<GetSettingNotifyResponseData>({
        url: '/v1/setting/notify',
        method: 'GET',
        headers
    });
}

export interface GetSettingAccountResponseData {
    username: string;
    realname: string;
    createdDate: string;
    email: string;
    agreeDisplayEmail: boolean;
    agreeSendEmail: boolean;
}

export async function getSettingAcount(headers?: Headers) {
    return await request<GetSettingAccountResponseData>({
        url: '/v1/setting/account',
        method: 'GET',
        headers
    });
}

export interface GetSettingProfileResponseData {
    avatar: string;
    bio: string;
    homepage: string;
    github: string;
    twitter: string;
    youtube: string;
    facebook: string;
    instagram: string;
}

export async function getSettingProfile(headers?: Headers) {
    return await request<GetSettingProfileResponseData>({
        url: '/v1/setting/profile',
        method: 'GET',
        headers
    });
}

interface GetSettingPostsParams {
    tag_filter: string;
    order: string;
    page: number;
}

export interface GetSettingPostsResponseData {
    username: string;
    posts: {
        url: string;
        title: string;
        createdDate: string;
        updatedDate: string;
        isHide: boolean;
        totalLikes: number;
        totalComments: number;
        todayCount: number;
        readTime: number;
        yesterdayCount: number;
        tag: string;
    }[];
    lastPage: number;
}

export async function getSettingPosts(params: GetSettingPostsParams, headers?: Headers) {
    return await request<GetSettingPostsResponseData>({
        url: '/v1/setting/posts',
        method: 'GET',
        params,
        headers
    });
}

export interface GetSettingSeriesResponseData {
    username: string;
    series: {
        url: string;
        title: string;
        totalPosts: number;
    }[];
}

export async function getSettingSeries(headers?: Headers) {
    return await request<GetSettingSeriesResponseData>({
        url: '/v1/setting/series',
        method: 'GET',
        headers
    });
}

export interface GetSettingAnalyticsViewResponseData {
    username: string;
    total: number;
    views: {
        date: string;
        count: number;
    }[];
}

export async function getSettingAnalyticsView(headers?: Headers) {
    return await request<GetSettingAnalyticsViewResponseData>({
        url: '/v1/setting/analytics-view',
        method: 'GET',
        headers
    });
}

export interface GetSettingAnalyticsPostsViewResponseData {
    posts: {
        id: number;
        title: string;
        today: number;
        increaseRate: number;
    }[];
}

export async function getSettingAnalyticsPostsView(headers?: Headers) {
    return await request<GetSettingAnalyticsPostsViewResponseData>({
        url: '/v1/setting/analytics-posts-view',
        method: 'GET',
        headers
    });
}

export interface GetSettingAnalyticsRefererResponseData {
    referers: {
        time: string;
        url: string;
        title: string;
        image: string;
        description: string;
    }[];
}

export async function getSettingAnalyticsReferrers(headers?: Headers) {
    return await request<GetSettingAnalyticsRefererResponseData>({
        url: '/v1/setting/analytics-referer',
        method: 'GET',
        headers
    });
}

export interface GetSettingAnalyticsSearchResponseData {
    platformTotal: {
        네이버: number;
        덕덕고: number;
        다음: number;
        구글: number;
        줌: number;
    };
    topSearches: {
        keyword: string;
        platform: string;
        count: number;
    }[];
}

export async function getSettingAnalyticsSearch(headers?: Headers) {
    return await request<GetSettingAnalyticsSearchResponseData>({
        url: '/v1/setting/analytics-search',
        method: 'GET',
        headers
    });
}

export interface GetSettingFormsResponseData {
    forms: {
        id: number;
        title: string;
        createdDate: string;
    }[];
}

export async function getSettingForms(headers?: Headers) {
    return await request<GetSettingFormsResponseData>({
        url: '/v1/setting/forms',
        method: 'GET',
        headers
    });
}

export async function putSetting(item: string, data: object) {
    return await request<unknown>({
        url: `/v1/setting/${item}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: serializeObject(data)
    });
}

export interface PostSettingAvatarResponseData {
    url: string;
}

export async function postSettingAvatar(data: FormData) {
    return await request<PostSettingAvatarResponseData>({
        url: '/v1/setting/avatar',
        method: 'POST',
        data: data
    });
}
