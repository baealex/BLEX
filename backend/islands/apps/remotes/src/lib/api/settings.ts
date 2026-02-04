import { http, type Response } from '../http.module';

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
    cover: string | null;
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

export const uploadCover = async (file: File) => {
    const formData = new FormData();
    formData.append('cover', file);

    return http.post<Response<{ url: string | null }>>('v1/setting/cover', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const updateNotifyConfig = async (config: Record<string, boolean>) => {
    return http.put<Response<{ success: boolean }>>('v1/setting/notify-config', config, { headers: { 'Content-Type': 'application/json' } });
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

// Banner API
export interface BannerData {
    id: number;
    title: string;
    contentHtml: string;
    bannerType: 'horizontal' | 'sidebar';
    position: 'top' | 'bottom' | 'left' | 'right';
    isActive: boolean;
    order: number;
    createdDate?: string;
    updatedDate?: string;
}

export interface BannerCreateData {
    title: string;
    content_html: string;
    banner_type: 'horizontal' | 'sidebar';
    position: 'top' | 'bottom' | 'left' | 'right';
    is_active?: boolean;
    order?: number;
}

export interface BannerUpdateData {
    title?: string;
    content_html?: string;
    banner_type?: 'horizontal' | 'sidebar';
    position?: 'top' | 'bottom' | 'left' | 'right';
    is_active?: boolean;
    order?: number;
}

export const getBanners = async () => {
    return http.get<Response<{ banners: BannerData[] }>>('v1/banners');
};

export const getBanner = async (id: number) => {
    return http.get<Response<BannerData>>(`v1/banners/${id}`);
};

export const createBanner = async (data: BannerCreateData) => {
    return http.post<Response<BannerData>>('v1/banners', data, { headers: { 'Content-Type': 'application/json' } });
};

export const updateBanner = async (id: number, data: BannerUpdateData) => {
    return http.put<Response<BannerData>>(`v1/banners/${id}`, data, { headers: { 'Content-Type': 'application/json' } });
};

export const deleteBanner = async (id: number) => {
    return http.delete<Response<{ message: string }>>(`v1/banners/${id}`);
};

export const updateBannerOrder = async (order: [number, number][]) => {
    return http.put<Response<{ message: string }>>('v1/banners/order', { order }, { headers: { 'Content-Type': 'application/json' } });
};

// Pinned Posts API
export interface PinnedPostData {
    id: number;
    order: number;
    post: {
        url: string;
        title: string;
        image: string | null;
        createdDate: string;
    };
}

export interface PinnablePostData {
    url: string;
    title: string;
    image: string | null;
    createdDate: string;
}

export const getPinnedPosts = async () => {
    return http.get<Response<{ pinnedPosts: PinnedPostData[]; username: string; maxCount: number }>>('v1/setting/pinned-posts');
};

export const getPinnablePosts = async () => {
    return http.get<Response<{ posts: PinnablePostData[] }>>('v1/setting/pinnable-posts');
};

export const addPinnedPost = async (postUrl: string) => {
    const formData = new URLSearchParams();
    formData.append('post_url', postUrl);

    return http.post<Response<{ success: boolean }>>('v1/setting/pinned-posts', formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
};

export const removePinnedPost = async (postUrl: string) => {
    const formData = new URLSearchParams();
    formData.append('post_url', postUrl);

    return http.delete<Response<{ success: boolean }>>('v1/setting/pinned-posts', {
        data: formData,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
};

export const updatePinnedPostsOrder = async (postUrls: string[]) => {
    const formData = new URLSearchParams();
    formData.append('post_urls', JSON.stringify(postUrls));

    return http.put<Response<{ success: boolean }>>('v1/setting/pinned-posts/order', formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
};

// Webhook Channel API
export interface WebhookChannel {
    id: number;
    name: string;
    webhookUrl: string;
    isActive: boolean;
    failureCount: number;
    createdDate: string;
}

export const getWebhookChannels = async () => {
    return http.get<Response<{ channels: WebhookChannel[] }>>('v1/webhook/channels');
};

export const addWebhookChannel = async (data: { webhook_url: string; name?: string }) => {
    return http.post<Response<{ success: boolean; channelId: number }>>('v1/webhook/channels', data, { headers: { 'Content-Type': 'application/json' } });
};

export const deleteWebhookChannel = async (channelId: number) => {
    return http.delete<Response<{ success: boolean }>>(`v1/webhook/channels/${channelId}`);
};

export const testWebhook = async (webhookUrl: string) => {
    return http.post<Response<{ success: boolean }>>('v1/webhook/test', { webhook_url: webhookUrl }, { headers: { 'Content-Type': 'application/json' } });
};
