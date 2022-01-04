import axiosRequest, {
    ResponseData,
    serializeObject,
} from './index';

export async function getSettingNotify(cookie: string | undefined) {
    return await axiosRequest<ResponseData<GetSettingNotifyData>>({
        url: `/v1/setting/notify`,
        headers: {
            cookie
        },
        method: 'GET'
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

export async function getSettingAcount(cookie: string | undefined) {
    return await axiosRequest<ResponseData<GetSettingAccountData>>({
        url: `/v1/setting/account`,
        headers: {
            cookie
        },
        method: 'GET'
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

export async function getSettingProfile(cookie: string | undefined) {
    return await axiosRequest<ResponseData<GetSettingProfileData>>({
        url: `/v1/setting/profile`,
        headers: {
            cookie
        },
        method: 'GET'
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

export async function getSettingPosts() {
    return await axiosRequest<ResponseData<GetSettingPostsData>>({
        url: `/v1/setting/posts`,
        method: 'GET'
    });
}

export interface GetSettingPostsData {
    author: string
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
};

export interface GetSettingSeriesData {
    username: string;
    series: GetSettingSeriesDataSeries[];
}

export interface GetSettingSeriesDataSeries {
    url: string;
    title: string;
    totalPosts: number;
}

export async function getSettingSeries(cookie: string | undefined) {
    return await axiosRequest<ResponseData<GetSettingSeriesData>>({
        url: `/v1/setting/series`,
        headers: {
            cookie
        },
        method: 'GET'
    });
}

interface getSettingAnalyticsViewProps {
    cookie?: string;
}

export interface GetSettingAnalyticsViewData {
    username: string;
    total: number;
    views: {
        date: string;
        count: number;
    }[];
}

export async function getSettingAnalyticsView({
    cookie
}: getSettingAnalyticsViewProps) {
    return await axiosRequest<ResponseData<GetSettingAnalyticsViewData>>({
        url: `/v1/setting/analytics-view`,
        headers: cookie ? {
            cookie
        } : {},
        method: 'GET'
    });
}

interface getSettingAnalyticsReferrersProps {
    page: number;
    cookie?: string;
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

export async function getSettingAnalyticsReferrers({
    page,
    cookie,
}: getSettingAnalyticsReferrersProps) {
    return await axiosRequest<ResponseData<GetSettingAnalyticsRefererData>>({
        url: `/v1/setting/analytics-referer`,
        params: {
            page
        },
        headers: cookie ? {
            cookie
        } : {},
        method: 'GET'
    });
}

interface getSettingAnalyticsSearchProps {
    cookie?: string;
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

export async function getSettingAnalyticsSearch({
    cookie
}: getSettingAnalyticsSearchProps) {
    return await axiosRequest<ResponseData<GetSettingAnalyticsgSearchData>>({
        url: `/v1/setting/analytics-search`,
        headers: cookie ? {
            cookie
        } : {},
        method: 'GET'
    });
}

export async function getSettingForms(cookie: string | undefined) {
    return await axiosRequest<ResponseData<GetSettingFormsData>>({
        url: `/v1/setting/forms`,
        headers: cookie ? {
            cookie
        } : {},
        method: 'GET'
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