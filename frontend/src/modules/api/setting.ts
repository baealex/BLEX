import axios from 'axios';

axios.defaults.withCredentials = true;

import Config from '../config.json';

import {
    ResponseData,
    serializeObject,
} from './index';

export async function getSettingNotify(cookie: string | undefined) {
    return await axios.request<ResponseData<GetSettingNotifyData>>({
        url: `${Config.API_SERVER}/v1/setting/notify`,
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
    return await axios.request<ResponseData<GetSettingAccountData>>({
        url: `${Config.API_SERVER}/v1/setting/account`,
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
    hasTwoFactorAuth: boolean;
    agreeEmail: boolean;
    agreeHistory: boolean;
}

export async function getSettingProfile(cookie: string | undefined) {
    return await axios.request<ResponseData<GetSettingProfileData>>({
        url: `${Config.API_SERVER}/v1/setting/profile`,
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

export async function getSettingPosts(cookie: string | undefined, order: string, page: number) {
    return await axios.request<ResponseData<GetSettingPostsData>>({
        url: `${Config.API_SERVER}/v1/setting/posts?order=${order}&page=${page}`,
        headers: {
            cookie
        },
        method: 'GET'
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

export async function getSettingSeries(cookie: string | undefined) {
    return await axios.request<ResponseData<GetSettingSeriesData>>({
        url: `${Config.API_SERVER}/v1/setting/series`,
        headers: {
            cookie
        },
        method: 'GET'
    });
}

export interface GetSettingSeriesData {
    username: string;
    series: {
        url: string;
        title: string;
        totalPosts: number;
    }[];
}

export interface GetSettingSeriesDataSeries {
    url: string;
    title: string;
    totalPosts: number;
}

export async function getSettingView(cookie: string | undefined) {
    return await axios.request<ResponseData<GetSettingViewData>>({
        url: `${Config.API_SERVER}/v1/setting/view`,
        headers: {
            cookie
        },
        method: 'GET'
    });
}

export interface GetSettingViewData {
    username: string;
    total: number;
    views: {
        date: string;
        count: number;
    }[];
}

export async function getSettingReferrers(cookie: string | undefined, page: number) {
    return await axios.request<ResponseData<GetSettingRefererData>>({
        url: `${Config.API_SERVER}/v1/setting/referer?page=${page}`,
        headers: cookie ? {
            cookie
        } : {},
        method: 'GET'
    });
}

export interface GetSettingRefererData {
    referers: {
        time: string;
        url: string;
        title: string;
        image: string;
        description: string;
    }[];
}

export async function getSettingForms(cookie: string | undefined) {
    return await axios.request<ResponseData<GetSettingFormsData>>({
        url: `${Config.API_SERVER}/v1/setting/forms`,
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
    return await axios.request<ResponseData<any>>({
        url: `${Config.API_SERVER}/v1/setting/${item}`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject(data),
        withCredentials: true,
    });
}

export async function postSettingAvatar(data: FormData) {
    return await axios.request<ResponseData<PostSettingAvatarData>>({
        url: `${Config.API_SERVER}/v1/setting/avatar`,
        method: 'POST',
        data: data,
        withCredentials: true,
    });
}

export interface PostSettingAvatarData {
    url: string;
}