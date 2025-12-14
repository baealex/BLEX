import { http, type Response } from '~/modules/http.module';

export interface AccountData {
    username: string;
    name: string;
    email: string;
    has2fa: boolean;
    createdDate: string;
    accountDeletionRedirectUrl?: string;
}

export interface AccountUpdateData {
    username?: string;
    name?: string;
    new_password?: string;
    password?: string;
}

export interface ProfileData {
    bio: string;
    homepage: string;
    avatar: string;
}

export interface ProfileUpdateData {
    bio?: string;
    homepage?: string;
}

export interface NotifyConfig {
    notify_posts_liked?: boolean;
    notify_posts_commented?: boolean;
    notify_comment_liked?: boolean;
    notify_new_follower?: boolean;
}

export interface Tag {
    name: string;
    count: number;
}

export interface Series {
    id: number;
    url: string;
    title: string;
    totalPosts: number;
}

export interface TempPost {
    token: string;
    title: string;
    description: string;
    createdDate: string;
}

export const getAccountSettings = async () => {
    return http.get<Response<AccountData>>('v1/setting/account');
};

export const updateAccountSettings = async (data: AccountUpdateData) => {
    const formData = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            formData.append(key, value);
        }
    });

    return http.put<Response<{ success: boolean }>>('v1/setting/account', formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
};

export const getProfileSettings = async () => {
    return http.get<Response<ProfileData>>('v1/setting/profile');
};

export const updateProfileSettings = async (data: ProfileUpdateData) => {
    const formData = new URLSearchParams();
    if (data.bio !== undefined) formData.append('bio', data.bio);
    if (data.homepage !== undefined) formData.append('homepage', data.homepage);

    return http.put<Response<{ success: boolean }>>('v1/setting/profile', formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
};

export const uploadAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);

    return http.post<Response<{ url: string }>>('v1/setting/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const updateNotifyConfig = async (config: NotifyConfig) => {
    const formData = new URLSearchParams();
    Object.entries(config).forEach(([key, value]) => {
        formData.append(key, value.toString());
    });

    return http.put<Response<{ success: boolean }>>('v1/setting/notify-config', formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
};

export const getTags = async () => {
    return http.get<Response<{ tags: Tag[] }>>('v1/setting/tag');
};

export const getSeries = async () => {
    return http.get<Response<{ series: Series[] }>>('v1/setting/series');
};

export const getTempPosts = async () => {
    return http.get<Response<{ temps: TempPost[] }>>('v1/temp-posts');
};

export const deleteTempPost = async (token: string) => {
    return http.delete<Response<{ success: boolean }>>(`v1/temp-posts/${token}`);
};

export interface NotifyItem {
    id: number;
    url: string;
    isRead: boolean;
    content: string;
    createdDate: string;
}

export interface Activity {
    type: 'post' | 'comment' | 'like' | 'series';
    title?: string;
    postTitle?: string;
    url: string;
    date: string;
}

export const getNotifications = async () => {
    return http.get<Response<{ notify: NotifyItem[]; isTelegramSync: boolean }>>('v1/setting/notify');
};

export const markNotificationAsRead = async (notifyId: number) => {
    const formData = new URLSearchParams();
    formData.append('id', notifyId.toString());

    return http.put<Response<{ success: boolean }>>('v1/setting/notify', formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
};

export const getNotifyConfig = async () => {
    return http.get<Response<{ config: { name: string; value: boolean }[] }>>('v1/setting/notify-config');
};

export const getHeatmap = async () => {
    return http.get<Response<{ [key: string]: number }>>('v1/setting/heatmap');
};

export const getRecentActivities = async () => {
    return http.get<Response<{ recentActivities: Activity[] }>>('v1/dashboard/activities');
};

export interface SeriesWithId extends Series {
    id: number;
}

export const getSeriesWithUsername = async () => {
    return http.get<Response<{ username: string; series: SeriesWithId[] }>>('v1/setting/series');
};

export const updateSeriesOrder = async (order: [number, number][]) => {
    return http.put<Response<{ success: boolean }>>('v1/series/order', { order }, { headers: { 'Content-Type': 'application/json' } });
};

export const deleteSeries = async (username: string, seriesUrl: string) => {
    return http.delete<Response<{ success: boolean }>>(`v1/users/@${username}/series/${seriesUrl}`);
};

export interface SocialLink {
    id: number;
    name: string;
    value: string;
    order: number;
}

export const getSocialLinks = async () => {
    const response = await http.get<Response<ProfileData & { social: SocialLink[] }>>('v1/setting/profile');
    return response;
};

export const updateSocialLinks = async (data: { update: string; create: string; delete: string }) => {
    const formData = new URLSearchParams();
    formData.append('update', data.update);
    formData.append('create', data.create);
    formData.append('delete', data.delete);

    return http.put<Response<SocialLink[]>>('v1/setting/social', formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
};

export const deleteAccount = async () => {
    return http.delete<Response<{ success: boolean }>>('v1/sign');
};
