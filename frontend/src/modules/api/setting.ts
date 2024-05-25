import request, { serializeObject } from './request';
import type { Headers } from './request';

export interface GetSettingNotifyResponseData {
    notify: {
        id: number;
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

type NotifyConfig =
    'NOTIFY_POSTS_COMMENT' |
    'NOTIFY_POSTS_LIKE' |
    'NOTIFY_POSTS_THANKS' |
    'NOTIFY_POSTS_NO_THANKS' |
    'NOTIFY_COMMENT_LIKE' |
    'NOTIFY_FOLLOW' |
    'NOTIFY_MENTION';

export interface GetSettingNotifyConfigResponseData {
    config: {
        name: NotifyConfig;
        value: boolean;
    }[];
}

export async function getSettingNotifyConfig(headers?: Headers) {
    return await request<GetSettingNotifyConfigResponseData>({
        url: '/v1/setting/notify-config',
        method: 'GET',
        headers
    });
}

export interface GetSettingAccountResponseData {
    username: string;
    name: string;
    email: string;
    createdDate: string;
}

export async function getSettingAccount(headers?: Headers) {
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
    social: {
        id: number;
        name: string;
        value: string;
        order: number;
    }[];
}

export async function getSettingProfile(headers?: Headers) {
    return await request<GetSettingProfileResponseData>({
        url: '/v1/setting/profile',
        method: 'GET',
        headers
    });
}

interface GetSettingPostsParams {
    tag: string;
    series: string;
    search: string;
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
        countLikes: number;
        countComments: number;
        todayCount: number;
        readTime: number;
        yesterdayCount: number;
        tag: string;
        series: string;
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

interface GetSettingReservedPostsParams {
    order: string;
    page: number;
}

export interface GetSettingReservedPostsResponseData {
    username: string;
    posts: {
        url: string;
        title: string;
        createdDate: string;
        readTime: number;
        tag: string;
    }[];
    lastPage: number;
}

export async function getSettingReservedPosts(params: GetSettingReservedPostsParams, headers?: Headers) {
    return await request<GetSettingReservedPostsResponseData>({
        url: '/v1/setting/reserved-posts',
        method: 'GET',
        params,
        headers
    });
}

interface GetSettingDraftPostsParams {
    page: number;
}

export interface GetSettingDraftPostsResponseData {
    username: string;
    posts: {
        token: string;
        title: string;
        createdDate: string;
        updatedDate: string;
        tag: string;
    }[];
    lastPage: number;
}

export async function getSettingDraftPosts(params: GetSettingDraftPostsParams, headers?: Headers) {
    return await request<GetSettingDraftPostsResponseData>({
        url: '/v1/setting/temp-posts',
        method: 'GET',
        params,
        headers
    });
}

export interface GetSettingTagResponseData {
    username: string;
    tags: {
        name: string;
        count: number;
    }[];
}

export async function getSettingTag(headers?: Headers) {
    return await request<GetSettingTagResponseData>({
        url: '/v1/setting/tag',
        method: 'GET',
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

export interface GetSettingAnalyticsPostsViewParams {
    date: string;
}

export interface GetSettingAnalyticsPostsViewResponseData {
    posts: {
        id: number;
        url: string;
        title: string;
        author: string;
        todayCount: number;
        increaseCount: number;
    }[];
}

export async function getSettingAnalyticsPostsView(params: GetSettingAnalyticsPostsViewParams, headers?: Headers) {
    return await request<GetSettingAnalyticsPostsViewResponseData>({
        url: '/v1/setting/analytics-posts-view',
        method: 'GET',
        params,
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
        posts: {
            author: string;
            title: string;
            url: string;
        };
    }[];
}

export async function getSettingAnalyticsReferer(headers?: Headers) {
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

export async function putSetting(item: string, data: object) {
    return await request<unknown>({
        url: `/v1/setting/${item}`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
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

export type GetSettingIntegrationTelegramResponseData = {
    isConnected: true;
    telegramId: string;
} | {
    isConnected: false;
};

export async function getSettingIntegrationTelegram(headers?: Headers) {
    return await request<GetSettingIntegrationTelegramResponseData>({
        url: '/v1/setting/integration-telegram',
        method: 'GET',
        headers
    });
}

export type GetSettingIntegrationOpenAIResponseData = {
    isConnected: true;
    apiKey: string;
    usageHistories: {
        id: number;
        query: string;
        response: string;
        createdDate: string;
    }[];
} | {
    isConnected: false;
};

export async function getSettingIntegrationOpenAI(headers?: Headers) {
    return await request<GetSettingIntegrationOpenAIResponseData>({
        url: '/v1/setting/integration-openai',
        method: 'GET',
        headers
    });
}

export interface PostSettingIntegrationTelegramResponseData {
    api_key: string;
}

export async function postSettingIntegrationOpenAI(data: PostSettingIntegrationTelegramResponseData) {
    return await request<unknown>({
        url: '/v1/setting/integration-openai',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject(data)
    });
}

export async function deleteSettingIntegrationOpenAI() {
    return await request<unknown>({
        url: '/v1/setting/integration-openai',
        method: 'DELETE'
    });
}
