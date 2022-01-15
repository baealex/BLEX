import axiosRequest, {
    ResponseData,
    serializeObject,
} from './index';

export async function getUserProfile(author: string, includes: GetUserProfileInclude[]) {
    return await axiosRequest<ResponseData<GetUserProfileData>>({
        url: `/v1/users/${encodeURIComponent(author)}?includes=${includes.join(',')}`,
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
    return await axiosRequest<ResponseData<GetUserAboutData>>({
        url: `/v1/users/${encodeURIComponent(author)}?get=about`,
        method: 'GET'
    });
}

export interface GetUserAboutData {
    aboutMd: string;
}

export async function putUserAbout(author: string, aboutMarkdown: string, aboutMarkup: string) {
    return await axiosRequest<ResponseData<any>>({
        url: `/v1/users/${encodeURIComponent(author)}`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            about: author,
            about_md: aboutMarkdown,
            about_html: aboutMarkup
        }),
    });
}