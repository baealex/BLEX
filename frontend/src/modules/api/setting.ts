import axiosRequest, {
    ResponseData,
    Headers,
    serializeObject,
} from './index';

export async function getSettingNotify(headers?: Headers) {
    return await axiosRequest<ResponseData<GetSettingNotifyData>>({
        url: `/v1/setting/notify`,
        method: 'GET',
        headers,
    });
}

export interface GetSettingNotifyData {
    notify: {
        pk: number;
        url: string;
        isRead: boolean;
        content: string;
        createdDate: string;
    }[];
    isTelegramSync: boolean;
}

export async function getSettingAcount(headers?: Headers) {
    return await axiosRequest<ResponseData<GetSettingAccountData>>({
        url: `/v1/setting/account`,
        method: 'GET',
        headers,
    });
}

export interface GetSettingAccountData {
    username: string;
    realname: string;
    createdDate: string;
    email: string;
    showEmail: boolean;
    agreeEmail: boolean;
    agreeHistory: boolean;
}

export async function getSettingProfile(headers?: Headers) {
    return await axiosRequest<ResponseData<GetSettingProfileData>>({
        url: `/v1/setting/profile`,
        method: 'GET',
        headers,
    });
}

export interface GetSettingProfileData {
    avatar: string;
    bio: string;
    homepage: string;
    github: string;
    twitter: string;
    youtube: string;
    facebook: string;
    instagram: string;
}

interface GetSettingPostsPrams {
    order: string;
    page: number;
}

export async function getSettingPosts(params: GetSettingPostsPrams, headers?: Headers) {
    return await axiosRequest<ResponseData<GetSettingPostsData>>({
        url: `/v1/setting/posts`,
        method: 'GET',
        params,
        headers,
    });
}

export interface GetSettingPostsData {
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

export interface GetSettingSeriesData {
    username: string;
    series: GetSettingSeriesDataSeries[];
}

export interface GetSettingSeriesDataSeries {
    url: string;
    title: string;
    totalPosts: number;
}

export async function getSettingSeries(headers?: Headers) {
    return await axiosRequest<ResponseData<GetSettingSeriesData>>({
        url: `/v1/setting/series`,
        method: 'GET',
        headers,
    });
}

export interface GetSettingAnalyticsViewData {
    username: string;
    total: number;
    views: {
        date: string;
        count: number;
    }[];
}

export async function getSettingAnalyticsView(headers?: Headers) {
    return await axiosRequest<ResponseData<GetSettingAnalyticsViewData>>({
        url: `/v1/setting/analytics-view`,
        method: 'GET',
        headers
    });
}

export interface GetSettingAnalyticsRefererData {
    referers: {
        time: string;
        url: string;
        title: string;
        image: string;
        description: string;
    }[];
}

export async function getSettingAnalyticsReferrers(headers?: Headers) {
    return await axiosRequest<ResponseData<GetSettingAnalyticsRefererData>>({
        url: `/v1/setting/analytics-referer`,
        method: 'GET',
        headers,
    });
}

export interface GetSettingAnalyticsgSearchData {
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
    return await axiosRequest<ResponseData<GetSettingAnalyticsgSearchData>>({
        url: `/v1/setting/analytics-search`,
        method: 'GET',
        headers,
    });
}

export async function getSettingForms(headers?: Headers) {
    return await axiosRequest<ResponseData<GetSettingFormsData>>({
        url: `/v1/setting/forms`,
        method: 'GET',
        headers,
    });
}

export interface GetSettingFormsData {
    forms: GetSettingFormsDataForms[];
}

export interface GetSettingFormsDataForms {
    id: number;
    title: string;
    createdDate: string;
}

export async function putSetting(item: string, data: object) {
    return await axiosRequest<ResponseData<any>>({
        url: `/v1/setting/${item}`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject(data),
    });
}

export async function postSettingAvatar(data: FormData) {
    return await axiosRequest<ResponseData<PostSettingAvatarData>>({
        url: `/v1/setting/avatar`,
        method: 'POST',
        data: data,
    });
}

export interface PostSettingAvatarData {
    url: string;
}