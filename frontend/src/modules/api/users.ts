import axios from 'axios';

axios.defaults.withCredentials = true;

import Config from '../config.json';

import {
    ResponseData,
    serializeObject,
} from './index';

export async function getUserProfile(author: string, includes: GetUserProfileInclude[]) {
    return await axios.request<ResponseData<GetUserProfileData>>({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}?includes=${includes.join(',')}`,
        method: 'GET'
    });
}

type GetUserProfileInclude = 'profile' | 'social' | 'heatmap' | 'tags' | 'view' | 'most' | 'recent' | 'about';

export interface GetUserProfileData {
    profile: {
        image: string;
        username: string;
        realname: string;
        bio: string;
    },
    social?: {
        username: string;
        github?: string;
        twitter?: string;
        youtube?: string;
        facebook?: string;
        instagram?: string;
    },
    heatmap?: {
        [key: string]: number;
    };
    tags?: {
        name: string;
        count: number;
    }[],
    view?: {
        today: number;
        yesterday: number;
        total: number;
    },
    most?: {
        url: string;
        title: string;
        image: string;
        readTime: number;
        createdDate: string;
        authorImage: string;
        author: string;
    }[],
    recent?: {
        type: string;
        text: string;
        url: string;
    }[],
    about?: string;
}

export async function getUserAbout(author: string) {
    return await axios.request<ResponseData<GetUserAboutData>>({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}?get=about`,
        method: 'GET'
    });
}

export interface GetUserAboutData {
    aboutMd: string;
}

export async function putUserAbout(author: string, aboutMarkdown: string, aboutMarkup: string) {
    return await axios.request<ResponseData<any>>({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            about: author,
            about_md: aboutMarkdown,
            about_html: aboutMarkup
        }),
        withCredentials: true,
    });
}

export async function putUsername(username: string, newUsername: string) {
    return await axios.request<ResponseData<any>>({
        url: `${Config.API_SERVER}/v1/users/@${encodeURIComponent(username)}`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            username: username,
            new_username: newUsername
        }),
        withCredentials: true,
    });
}