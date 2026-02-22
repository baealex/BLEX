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

export interface DraftPost {
    url: string;
    title: string;
    createdDate: string;
    updatedDate: string;
    tag: string;
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

export const getDraftPosts = async () => {
    return http.get<Response<{ drafts: DraftPost[] }>>('v1/drafts');
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

export interface SeriesDetailData {
    id: number;
    name: string;
    url: string;
    description: string;
    postIds: number[];
    postCount: number;
}

export interface SeriesMutationResult {
    id: number;
    name: string;
    url: string;
    description: string;
    postCount: number;
}

export interface SeriesMutationData {
    name?: string;
    url?: string;
    description?: string;
    post_ids?: number[];
}

export interface AvailableSeriesPost {
    id: number;
    title: string;
    publishedDate: string | null;
}

export const getSeriesWithUsername = async () => {
    return http.get<Response<{ username: string; series: SeriesWithId[] }>>('v1/setting/series');
};

export const updateSeriesOrder = async (order: [number, number][]) => {
    return http.put<Response<{ success: boolean }>>('v1/series/order', { order }, { headers: { 'Content-Type': 'application/json' } });
};

export const getSeriesDetail = async (seriesId: number) => {
    return http.get<Response<SeriesDetailData>>(`v1/series/${seriesId}`);
};

export const createSeries = async (data: SeriesMutationData) => {
    return http.post<Response<SeriesMutationResult>>('v1/series', data, { headers: { 'Content-Type': 'application/json' } });
};

export const updateSeries = async (seriesId: number, data: SeriesMutationData) => {
    return http.put<Response<SeriesMutationResult>>(`v1/series/${seriesId}`, data, { headers: { 'Content-Type': 'application/json' } });
};

export const deleteSeriesById = async (seriesId: number) => {
    return http.delete<Response<{ message: string }>>(`v1/series/${seriesId}`);
};

export const getAvailablePosts = async (seriesId?: number) => {
    const query = seriesId !== undefined ? `?series_id=${seriesId}` : '';
    return http.get<Response<AvailableSeriesPost[]>>(`v1/series/valid-posts${query}`);
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

export const getGlobalWebhookChannels = async () => {
    return http.get<Response<{ channels: WebhookChannel[] }>>('v1/webhook/global-channels');
};

export const addGlobalWebhookChannel = async (data: { webhook_url: string; name?: string }) => {
    return http.post<Response<{ success: boolean; channelId: number }>>('v1/webhook/global-channels', data, { headers: { 'Content-Type': 'application/json' } });
};

export const deleteGlobalWebhookChannel = async (channelId: number) => {
    return http.delete<Response<{ success: boolean }>>(`v1/webhook/global-channels/${channelId}`);
};

export const testWebhook = async (webhookUrl: string) => {
    return http.post<Response<{ success: boolean }>>('v1/webhook/test', { webhook_url: webhookUrl }, { headers: { 'Content-Type': 'application/json' } });
};

// Static Page API
export interface StaticPageData {
    id: number;
    title: string;
    slug: string;
    content: string;
    metaDescription: string;
    isPublished: boolean;
    showInFooter: boolean;
    order: number;
    createdDate: string;
    updatedDate: string;
}

export interface StaticPageCreateData {
    title: string;
    slug: string;
    content: string;
    meta_description?: string;
    is_published?: boolean;
    show_in_footer?: boolean;
    order?: number;
}

export interface StaticPageUpdateData {
    title?: string;
    slug?: string;
    content?: string;
    meta_description?: string;
    is_published?: boolean;
    show_in_footer?: boolean;
    order?: number;
}

export const getStaticPages = async () => {
    return http.get<Response<{ pages: StaticPageData[] }>>('v1/static-pages');
};

export const getStaticPage = async (id: number) => {
    return http.get<Response<StaticPageData>>(`v1/static-pages/${id}`);
};

export const createStaticPage = async (data: StaticPageCreateData) => {
    return http.post<Response<StaticPageData>>('v1/static-pages', data, { headers: { 'Content-Type': 'application/json' } });
};

export const updateStaticPage = async (id: number, data: StaticPageUpdateData) => {
    return http.put<Response<StaticPageData>>(`v1/static-pages/${id}`, data, { headers: { 'Content-Type': 'application/json' } });
};

export const deleteStaticPage = async (id: number) => {
    return http.delete<Response<{ message: string }>>(`v1/static-pages/${id}`);
};

// Notice API (user notices)
export interface NoticeData {
    id: number;
    title: string;
    url: string;
    isActive: boolean;
    createdDate: string;
    updatedDate: string;
}

export interface NoticeCreateData {
    title: string;
    url: string;
    is_active?: boolean;
}

export interface NoticeUpdateData {
    title?: string;
    url?: string;
    is_active?: boolean;
}

export const getNotices = async () => {
    return http.get<Response<{ notices: NoticeData[] }>>('v1/notices');
};

export const createNotice = async (data: NoticeCreateData) => {
    return http.post<Response<NoticeData>>('v1/notices', data, { headers: { 'Content-Type': 'application/json' } });
};

export const updateNotice = async (id: number, data: NoticeUpdateData) => {
    return http.put<Response<NoticeData>>(`v1/notices/${id}`, data, { headers: { 'Content-Type': 'application/json' } });
};

export const deleteNotice = async (id: number) => {
    return http.delete<Response<{ message: string }>>(`v1/notices/${id}`);
};

// Global Notice API
export interface GlobalNoticeData {
    id: number;
    title: string;
    url: string;
    isActive: boolean;
    createdDate: string;
    updatedDate: string;
}

export interface GlobalNoticeCreateData {
    title: string;
    url: string;
    is_active?: boolean;
}

export interface GlobalNoticeUpdateData {
    title?: string;
    url?: string;
    is_active?: boolean;
}

export const getGlobalNotices = async () => {
    return http.get<Response<{ notices: GlobalNoticeData[] }>>('v1/global-notices');
};

export const createGlobalNotice = async (data: GlobalNoticeCreateData) => {
    return http.post<Response<GlobalNoticeData>>('v1/global-notices', data, { headers: { 'Content-Type': 'application/json' } });
};

export const updateGlobalNotice = async (id: number, data: GlobalNoticeUpdateData) => {
    return http.put<Response<GlobalNoticeData>>(`v1/global-notices/${id}`, data, { headers: { 'Content-Type': 'application/json' } });
};

export const deleteGlobalNotice = async (id: number) => {
    return http.delete<Response<{ message: string }>>(`v1/global-notices/${id}`);
};

// Global Banner API
export interface GlobalBannerData {
    id: number;
    title: string;
    contentHtml: string;
    bannerType: 'horizontal' | 'sidebar';
    position: 'top' | 'bottom' | 'left' | 'right';
    isActive: boolean;
    order: number;
    createdBy: string | null;
    createdDate?: string;
    updatedDate?: string;
}

export interface GlobalBannerCreateData {
    title: string;
    content_html: string;
    banner_type: 'horizontal' | 'sidebar';
    position: 'top' | 'bottom' | 'left' | 'right';
    is_active?: boolean;
    order?: number;
}

export interface GlobalBannerUpdateData {
    title?: string;
    content_html?: string;
    banner_type?: 'horizontal' | 'sidebar';
    position?: 'top' | 'bottom' | 'left' | 'right';
    is_active?: boolean;
    order?: number;
}

export const getGlobalBanners = async () => {
    return http.get<Response<{ banners: GlobalBannerData[] }>>('v1/global-banners');
};

export const createGlobalBanner = async (data: GlobalBannerCreateData) => {
    return http.post<Response<GlobalBannerData>>('v1/global-banners', data, { headers: { 'Content-Type': 'application/json' } });
};

export const updateGlobalBanner = async (id: number, data: GlobalBannerUpdateData) => {
    return http.put<Response<GlobalBannerData>>(`v1/global-banners/${id}`, data, { headers: { 'Content-Type': 'application/json' } });
};

export const deleteGlobalBanner = async (id: number) => {
    return http.delete<Response<{ message: string }>>(`v1/global-banners/${id}`);
};

export const updateGlobalBannerOrder = async (order: [number, number][]) => {
    return http.put<Response<{ message: string }>>('v1/global-banners/order', { order }, { headers: { 'Content-Type': 'application/json' } });
};

// Site Setting API
export interface SiteSettingData {
    headerScript: string;
    footerScript: string;
    welcomeNotificationMessage: string;
    welcomeNotificationUrl: string;
    accountDeletionRedirectUrl: string;
    updatedDate: string;
}

export interface SiteSettingUpdateData {
    header_script?: string;
    footer_script?: string;
    welcome_notification_message?: string;
    welcome_notification_url?: string;
    account_deletion_redirect_url?: string;
}

export const getSiteSettings = async () => {
    return http.get<Response<SiteSettingData>>('v1/site-settings');
};

export const updateSiteSettings = async (data: SiteSettingUpdateData) => {
    return http.put<Response<SiteSettingData>>('v1/site-settings', data, { headers: { 'Content-Type': 'application/json' } });
};

// Utility API
export interface UtilityStats {
    totalPosts: number;
    publishedPosts: number;
    hiddenPosts: number;
    draftPosts: number;
    totalComments: number;
    totalUsers: number;
    activeProfiles: number;
    totalSeries: number;
    imageCacheCount: number;
    totalSessions: number;
    expiredSessions: number;
    dbSize?: string;
    logCount: number;
}

export interface TagCleanResult {
    totalTags: number;
    usedTags: number;
    unusedTags: number;
    topTags: { name: string; count: number }[];
    cleanedCount: number;
    cleanedTags: string[];
    dryRun: boolean;
}

export interface SessionCleanResult {
    totalSessions: number;
    expiredSessions: number;
    cleanedCount: number;
    cleanAll: boolean;
    dryRun: boolean;
}

export interface LogCleanResult {
    logCount: number;
    cleanedCount: number;
    dryRun: boolean;
}

export interface DuplicateFileInfo {
    duplicateUrl: string;
    duplicateSizeKb: number;
    originalUrl: string;
    originalSizeKb: number;
    hash: string;
}

export interface ImageCleanResult {
    totalUnused: number;
    totalSizeMb: number;
    totalDuplicates: number;
    totalDuplicateSizeMb: number;
    totalSavedMb: number;
    messages: string[];
    dryRun: boolean;
    unusedFiles?: {
        path: string;
        url: string;
        sizeKb: number;
    }[];
    duplicateFiles?: DuplicateFileInfo[];
}

export const getUtilityStats = async () => {
    return http.get<Response<UtilityStats>>('v1/utilities/stats');
};

export const cleanTags = async (dryRun: boolean) => {
    return http.post<Response<TagCleanResult>>('v1/utilities/clean-tags', { dry_run: dryRun }, { headers: { 'Content-Type': 'application/json' } });
};

export const cleanSessions = async (dryRun: boolean, cleanAll: boolean) => {
    return http.post<Response<SessionCleanResult>>('v1/utilities/clean-sessions', {
        dry_run: dryRun,
        clean_all: cleanAll
    }, { headers: { 'Content-Type': 'application/json' } });
};

export const cleanLogs = async (dryRun: boolean) => {
    return http.post<Response<LogCleanResult>>('v1/utilities/clean-logs', { dry_run: dryRun }, { headers: { 'Content-Type': 'application/json' } });
};

export const cleanImages = async (dryRun: boolean, target: string, removeDuplicates: boolean) => {
    return http.post<Response<ImageCleanResult>>('v1/utilities/clean-images', {
        dry_run: dryRun,
        target,
        remove_duplicates: removeDuplicates
    }, { headers: { 'Content-Type': 'application/json' } });
};
