import request, { serializeObject } from './request';

type GetUserProfileInclude = 'subscribe' | 'profile' | 'social' | 'heatmap' | 'tags' | 'view' | 'most' | 'recent' | 'about';

export interface GetUserProfileResponseData {
    subscribe: {
        hasSubscribe: boolean;
    };
    profile: {
        image: string;
        username: string;
        name: string;
        bio: string;
        homepage: string;
    };
    social?: {
        name: string;
        value: string;
    }[];
    heatmap?: {
        [key: string]: number;
    };
    tags?: {
        name: string;
        count: number;
    }[];
    view?: {
        today: number;
        yesterday: number;
        total: number;
    };
    most?: {
        url: string;
        title: string;
        image: string;
        readTime: number;
        createdDate: string;
        authorImage: string;
        author: string;
    }[];
    recent?: {
        type: string;
        text: string;
        url: string;
    }[];
    about?: string;
}

export async function getUserProfile(author: string, includes: GetUserProfileInclude[]) {
    return await request<GetUserProfileResponseData>({
        url: `/v1/users/${encodeURIComponent(author)}?includes=${includes.join(',')}`,
        method: 'GET'
    });
}

export interface GetUserAboutResponseData {
    aboutMd: string;
}

export async function getUserAbout(author: string) {
    return await request<GetUserAboutResponseData>({
        url: `/v1/users/${encodeURIComponent(author)}?get=about`,
        method: 'GET'
    });
}

interface PutUserFollowResponseData {
    hasSubscribe: boolean;
}

export async function putUserFollow(author: string) {
    return await request<PutUserFollowResponseData>({
        url: `/v1/users/${encodeURIComponent(author)}`,
        method: 'PUT',
        data: serializeObject({ follow: author })
    });
}

interface UpdateUserAboutRequestData {
    aboutMd: string;
}

export async function updateUserAbout(author: string, data: UpdateUserAboutRequestData) {
    return await request<unknown>({
        url: `/v1/users/${encodeURIComponent(author)}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: serializeObject({
            about: true,
            about_md: data.aboutMd
        })
    });
}
