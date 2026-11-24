import { http, type Response } from '../http.module';

export interface AccountData {
    username: string;
    name: string;
    email: string;
    has2fa: boolean;
    createdDate: string;
    regionalPreferences: RegionalPreferences;
    accountDeletionRedirectUrl?: string;
}

export interface RegionalPreferences {
    language: string | null;
    timeZone: string;
    defaultLanguage: string;
    defaultTimeZone: string;
    languages: { code: string; label: string }[];
    timeZones: string[];
}

export const updateRegionalPreferences = (language: string | null, timeZone: string) =>
    http.put<Response<Record<string, never>>>('v1/setting/regional-preferences', {
        language,
        timeZone
    });

export interface AccountUpdateData {
    username?: string;
    name?: string;
    password?: string;
    revokeTokens?: boolean;
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
    image: string | null;
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
            formData.append(key, String(value));
        }
    });

    return http.put<Response<{ success: boolean }>>('v1/setting/account', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
};

export const getProfileSettings = async () => {
    return http.get<Response<ProfileData>>('v1/setting/profile');
};

export const updateProfileSettings = async (data: ProfileUpdateData) => {
    const formData = new URLSearchParams();
    if (data.bio !== undefined) formData.append('bio', data.bio);
    if (data.homepage !== undefined) formData.append('homepage', data.homepage);

    return http.put<Response<{ success: boolean }>>('v1/setting/profile', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
};

export const uploadAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);

    return http.post<Response<{ url: string }>>('v1/setting/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

export const uploadCover = async (file: File) => {
    const formData = new FormData();
    formData.append('cover', file);

    return http.post<Response<{ url: string | null }>>('v1/setting/cover', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

export const deleteCover = async () => {
    return http.delete<Response<{ url: string | null }>>('v1/setting/cover');
};

export const updateNotifyConfig = async (config: Record<string, boolean>) => {
    return http.put<Response<{ success: boolean }>>('v1/setting/notify-config', config, {
        headers: { 'Content-Type': 'application/json' }
    });
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

    return http.put<Response<{ success: boolean }>>('v1/setting/notify', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
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
    postIds?: number[];
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
    return http.put<Response<{ success: boolean }>>(
        'v1/series/order',
        { order },
        { headers: { 'Content-Type': 'application/json' } }
    );
};

export const getSeriesDetail = async (seriesId: number) => {
    return http.get<Response<SeriesDetailData>>(`v1/series/${seriesId}`);
};

export const createSeries = async (data: SeriesMutationData) => {
    return http.post<Response<SeriesMutationResult>>('v1/series', data, {
        headers: { 'Content-Type': 'application/json' }
    });
};

export const updateSeries = async (seriesId: number, data: SeriesMutationData) => {
    return http.put<Response<SeriesMutationResult>>(`v1/series/${seriesId}`, data, {
        headers: { 'Content-Type': 'application/json' }
    });
};

export const deleteSeriesById = async (seriesId: number) => {
    return http.delete<Response<{ message: string }>>(`v1/series/${seriesId}`);
};

export const getAvailablePosts = async (seriesId?: number) => {
    const query = seriesId !== undefined ? `?seriesId=${seriesId}` : '';
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

    return http.put<Response<SocialLink[]>>('v1/setting/social', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
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
    contentHtml: string;
    bannerType: 'horizontal' | 'sidebar';
    position: 'top' | 'bottom' | 'left' | 'right';
    isActive?: boolean;
    order?: number;
}

export interface BannerUpdateData {
    title?: string;
    contentHtml?: string;
    bannerType?: 'horizontal' | 'sidebar';
    position?: 'top' | 'bottom' | 'left' | 'right';
    isActive?: boolean;
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
    return http.put<Response<BannerData>>(`v1/banners/${id}`, data, {
        headers: { 'Content-Type': 'application/json' }
    });
};

export const deleteBanner = async (id: number) => {
    return http.delete<Response<{ message: string }>>(`v1/banners/${id}`);
};

export const updateBannerOrder = async (order: [number, number][]) => {
    return http.put<Response<{ message: string }>>(
        'v1/banners/order',
        { order },
        { headers: { 'Content-Type': 'application/json' } }
    );
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

export interface PinnablePostsPaginationData {
    page: number;
    limit: number;
    lastPage: number;
    totalCount: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

export const getPinnedPosts = async () => {
    return http.get<
        Response<{
            pinnedPosts: PinnedPostData[];
            username: string;
            maxCount: number;
            reservedCount?: number;
        }>
    >('v1/setting/pinned-posts');
};

export const getPinnablePosts = async (options: { query?: string; limit?: number; page?: number } = {}) => {
    return http.get<Response<{ posts: PinnablePostData[] } & PinnablePostsPaginationData>>(
        'v1/setting/pinnable-posts',
        {
            params: {
                q: options.query || undefined,
                limit: options.limit,
                page: options.page
            }
        }
    );
};

export const addPinnedPost = async (postUrl: string) => {
    const formData = new URLSearchParams();
    formData.append('postUrl', postUrl);

    return http.post<Response<{ success: boolean }>>('v1/setting/pinned-posts', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
};

export const removePinnedPost = async (postUrl: string) => {
    const formData = new URLSearchParams();
    formData.append('postUrl', postUrl);

    return http.delete<Response<{ success: boolean }>>('v1/setting/pinned-posts', {
        data: formData,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
};

export const updatePinnedPostsOrder = async (postUrls: string[]) => {
    const formData = new URLSearchParams();
    formData.append('postUrls', JSON.stringify(postUrls));

    return http.put<Response<{ success: boolean }>>('v1/setting/pinned-posts/order', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
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

export const addWebhookChannel = async (data: { webhookUrl: string; name?: string }) => {
    return http.post<Response<{ success: boolean; channelId: number }>>('v1/webhook/channels', data, {
        headers: { 'Content-Type': 'application/json' }
    });
};

export const deleteWebhookChannel = async (channelId: number) => {
    return http.delete<Response<{ success: boolean }>>(`v1/webhook/channels/${channelId}`);
};

export const getGlobalWebhookChannels = async () => {
    return http.get<Response<{ channels: WebhookChannel[] }>>('v1/webhook/global-channels');
};

export const addGlobalWebhookChannel = async (data: { webhookUrl: string; name?: string }) => {
    return http.post<Response<{ success: boolean; channelId: number }>>('v1/webhook/global-channels', data, {
        headers: { 'Content-Type': 'application/json' }
    });
};

export const deleteGlobalWebhookChannel = async (channelId: number) => {
    return http.delete<Response<{ success: boolean }>>(`v1/webhook/global-channels/${channelId}`);
};

export const testWebhook = async (webhookUrl: string) => {
    return http.post<Response<{ success: boolean }>>(
        'v1/webhook/test',
        { webhookUrl },
        { headers: { 'Content-Type': 'application/json' } }
    );
};

// Developer API Token API
export type DeveloperTokenScope = 'posts:read' | 'posts:write';

export interface DeveloperTokenData {
    id: number;
    name: string;
    tokenPrefix: string;
    scopes: DeveloperTokenScope[];
    expiresAt: string | null;
    revokedAt: string | null;
    lastUsedAt: string | null;
    createdAt: string;
}

export interface CreatedDeveloperTokenData extends DeveloperTokenData {
    token: string;
}

export interface DeveloperTokenCreateData {
    name?: string;
    scopes: DeveloperTokenScope[];
    expiresInDays?: number;
}

export const getDeveloperTokens = async () => {
    return http.get<Response<{ tokens: DeveloperTokenData[] }>>('v1/developer-tokens');
};

export const createDeveloperToken = async (data: DeveloperTokenCreateData) => {
    return http.post<Response<CreatedDeveloperTokenData>>('v1/developer-tokens', data, {
        headers: { 'Content-Type': 'application/json' }
    });
};

export const revokeDeveloperToken = async (tokenId: number) => {
    return http.delete<Response<DeveloperTokenData>>(`v1/developer-tokens/${tokenId}`);
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
    metaDescription?: string;
    isPublished?: boolean;
    showInFooter?: boolean;
    order?: number;
}

export interface StaticPageUpdateData {
    title?: string;
    slug?: string;
    content?: string;
    metaDescription?: string;
    isPublished?: boolean;
    showInFooter?: boolean;
    order?: number;
}

export const getStaticPages = async () => {
    return http.get<Response<{ pages: StaticPageData[] }>>('v1/static-pages');
};

export const getStaticPage = async (id: number) => {
    return http.get<Response<StaticPageData>>(`v1/static-pages/${id}`);
};

export const createStaticPage = async (data: StaticPageCreateData) => {
    return http.post<Response<StaticPageData>>('v1/static-pages', data, {
        headers: { 'Content-Type': 'application/json' }
    });
};

export const updateStaticPage = async (id: number, data: StaticPageUpdateData) => {
    return http.put<Response<StaticPageData>>(`v1/static-pages/${id}`, data, {
        headers: { 'Content-Type': 'application/json' }
    });
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
    isActive?: boolean;
}

export interface NoticeUpdateData {
    title?: string;
    url?: string;
    isActive?: boolean;
}

export const getNotices = async () => {
    return http.get<Response<{ notices: NoticeData[] }>>('v1/notices');
};

export const createNotice = async (data: NoticeCreateData) => {
    return http.post<Response<NoticeData>>('v1/notices', data, { headers: { 'Content-Type': 'application/json' } });
};

export const updateNotice = async (id: number, data: NoticeUpdateData) => {
    return http.put<Response<NoticeData>>(`v1/notices/${id}`, data, {
        headers: { 'Content-Type': 'application/json' }
    });
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
    isActive?: boolean;
}

export interface GlobalNoticeUpdateData {
    title?: string;
    url?: string;
    isActive?: boolean;
}

export const getGlobalNotices = async () => {
    return http.get<Response<{ notices: GlobalNoticeData[] }>>('v1/global-notices');
};

export const createGlobalNotice = async (data: GlobalNoticeCreateData) => {
    return http.post<Response<GlobalNoticeData>>('v1/global-notices', data, {
        headers: { 'Content-Type': 'application/json' }
    });
};

export const updateGlobalNotice = async (id: number, data: GlobalNoticeUpdateData) => {
    return http.put<Response<GlobalNoticeData>>(`v1/global-notices/${id}`, data, {
        headers: { 'Content-Type': 'application/json' }
    });
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
    contentHtml: string;
    bannerType: 'horizontal' | 'sidebar';
    position: 'top' | 'bottom' | 'left' | 'right';
    isActive?: boolean;
    order?: number;
}

export interface GlobalBannerUpdateData {
    title?: string;
    contentHtml?: string;
    bannerType?: 'horizontal' | 'sidebar';
    position?: 'top' | 'bottom' | 'left' | 'right';
    isActive?: boolean;
    order?: number;
}

export const getGlobalBanners = async () => {
    return http.get<Response<{ banners: GlobalBannerData[] }>>('v1/global-banners');
};

export const getGlobalBanner = async (id: number) => {
    return http.get<Response<GlobalBannerData>>(`v1/global-banners/${id}`);
};

export const createGlobalBanner = async (data: GlobalBannerCreateData) => {
    return http.post<Response<GlobalBannerData>>('v1/global-banners', data, {
        headers: { 'Content-Type': 'application/json' }
    });
};

export const updateGlobalBanner = async (id: number, data: GlobalBannerUpdateData) => {
    return http.put<Response<GlobalBannerData>>(`v1/global-banners/${id}`, data, {
        headers: { 'Content-Type': 'application/json' }
    });
};

export const deleteGlobalBanner = async (id: number) => {
    return http.delete<Response<{ message: string }>>(`v1/global-banners/${id}`);
};

export const updateGlobalBannerOrder = async (order: [number, number][]) => {
    return http.put<Response<{ message: string }>>(
        'v1/global-banners/order',
        { order },
        { headers: { 'Content-Type': 'application/json' } }
    );
};

// The server returns the HTML public pages show for this input, so previews never insert the raw source.
export const previewBannerHtml = async (scope: 'user' | 'global', contentHtml: string) => {
    return http.post<Response<{ html: string }>>(
        scope === 'global' ? 'v1/global-banners/preview' : 'v1/banners/preview',
        { contentHtml },
        { headers: { 'Content-Type': 'application/json' } }
    );
};

export const previewStaticPageHtml = async (content: string) => {
    return http.post<Response<{ html: string }>>(
        'v1/static-pages/preview',
        { content },
        { headers: { 'Content-Type': 'application/json' } }
    );
};

// Site Setting API
export interface SocialAuthProviderSetting {
    key: string;
    name: string;
    isEnabled: boolean;
    clientId: string;
    hasClientSecret: boolean;
}

export interface SiteSettingData {
    siteName: string;
    siteDescription: string;
    logoSvgUrl: string;
    logoSvgDarkUrl: string;
    iconSvgUrl: string;
    iconSvgDarkUrl: string;
    faviconUrl: string;
    iconPngUrls: Record<string, string>;
    hasCustomLogo: boolean;
    hasCustomLogoDark: boolean;
    hasCustomIcon: boolean;
    hasCustomIconDark: boolean;
    headerScript: string;
    footerScript: string;
    canManageScripts: boolean;
    seoEnabled: boolean;
    robotsTxtExtraRules: string;
    robotsTxtDefault: string;
    aeoEnabled: boolean;
    updatedDate: string;
}

export interface SocialAuthProviderUpdateData {
    key: string;
    isEnabled?: boolean;
    clientId?: string;
    clientSecret?: string;
    clearClientSecret?: boolean;
}

export interface SiteSettingUpdateData {
    siteName?: string;
    headerScript?: string;
    footerScript?: string;
    seoEnabled?: boolean;
    robotsTxtExtraRules?: string;
    aeoEnabled?: boolean;
}

export interface LoginSettingData {
    welcomeNotificationMessage: string;
    welcomeNotificationUrl: string;
    accountDeletionRedirectUrl: string;
    hcaptchaEnabled: boolean;
    hcaptchaSiteKey: string;
    hcaptchaHasSecretKey: boolean;
    updatedDate: string;
    socialAuthProviders: SocialAuthProviderSetting[];
}

export interface LoginSettingUpdateData {
    welcomeNotificationMessage?: string;
    welcomeNotificationUrl?: string;
    accountDeletionRedirectUrl?: string;
    hcaptchaEnabled?: boolean;
    hcaptchaSiteKey?: string;
    hcaptchaSecretKey?: string;
    clearHcaptchaSecretKey?: boolean;
    socialAuthProviders?: SocialAuthProviderUpdateData[];
}

export type TelegramConnectionState =
    | 'disabled'
    | 'connected'
    | 'not_connected'
    | 'invalid_token'
    | 'rejected'
    | 'delivery_failed'
    | 'unreachable';

export interface IntegrationSettingData {
    telegramEnabled: boolean;
    telegramBotUsername: string;
    telegramHasBotToken: boolean;
    telegramConnection: {
        state: TelegramConnectionState;
        detail: string;
    };
    updatedDate: string;
}

export interface IntegrationSettingUpdateData {
    telegramEnabled?: boolean;
    telegramBotUsername?: string;
    telegramBotToken?: string;
    clearTelegramBotToken?: boolean;
}

export const getSiteSettings = async () => {
    return http.get<Response<SiteSettingData>>('v1/site-settings');
};

export const updateSiteSettings = async (data: SiteSettingUpdateData) => {
    return http.put<Response<SiteSettingData>>('v1/site-settings', data, {
        headers: { 'Content-Type': 'application/json' }
    });
};

export const getLoginSettings = async () => {
    return http.get<Response<LoginSettingData>>('v1/login-settings');
};

export const updateLoginSettings = async (data: LoginSettingUpdateData) => {
    return http.put<Response<LoginSettingData>>('v1/login-settings', data, {
        headers: { 'Content-Type': 'application/json' }
    });
};

export const getIntegrationSettings = async () => {
    return http.get<Response<IntegrationSettingData>>('v1/integration-settings');
};

export const updateIntegrationSettings = async (data: IntegrationSettingUpdateData) => {
    return http.put<Response<IntegrationSettingData>>('v1/integration-settings', data, {
        headers: { 'Content-Type': 'application/json' }
    });
};

export type BrandAssetType = 'logo' | 'icon';
export type BrandAssetTheme = 'default' | 'dark';

export const uploadBrandAsset = async (data: FormData) => {
    return http.post<Response<SiteSettingData>>('v1/site-settings/brand-assets', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

export const deleteBrandAsset = async (assetType: BrandAssetType, theme: BrandAssetTheme) => {
    return http.delete<Response<SiteSettingData>>('v1/site-settings/brand-assets', {
        data: {
            assetType,
            theme
        },
        headers: { 'Content-Type': 'application/json' }
    });
};

// Utility API
export interface UtilityStats {
    totalPosts: number;
    publicPosts: number;
    publishedPosts: number;
    scheduledPosts: number;
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
    developerRequestLogCount: number;
}

interface CleanupConfirmation {
    confirmationToken?: string;
}

export interface TagCleanResult extends CleanupConfirmation {
    totalTags: number;
    usedTags: number;
    unusedTags: number;
    topTags: { name: string; count: number }[];
    cleanedCount: number;
    cleanedTags: string[];
    dryRun: boolean;
}

export interface SessionCleanResult extends CleanupConfirmation {
    totalSessions: number;
    expiredSessions: number;
    cleanedCount: number;
    cleanAll: boolean;
    dryRun: boolean;
}

export interface LogCleanResult extends CleanupConfirmation {
    logCount: number;
    adminAuditLogRetentionDays: number;
    expiredLogCount: number;
    cleanedCount: number;
    developerRequestLogCount: number;
    developerApiLogRetentionDays: number;
    expiredDeveloperRequestLogCount: number;
    cleanedDeveloperRequestLogCount: number;
    dryRun: boolean;
}

export interface DuplicateFileInfo {
    duplicateUrl: string;
    duplicateSizeKb: number;
    originalUrl: string;
    originalSizeKb: number;
    hash: string;
}

export interface ImageCleanResult extends CleanupConfirmation {
    totalUnused: number;
    totalSizeMb: number;
    totalDuplicates: number;
    totalDuplicateSizeMb: number;
    totalSavedMb: number;
    messages: string[];
    hasErrors: boolean;
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

const cleanupConfirmationBody = (dryRun: boolean, confirmationToken?: string) => ({
    dryRun,
    ...(confirmationToken ? { confirmationToken } : {})
});

export const cleanTags = async (dryRun: boolean, confirmationToken?: string) => {
    return http.post<Response<TagCleanResult>>(
        'v1/utilities/clean-tags',
        cleanupConfirmationBody(dryRun, confirmationToken),
        { headers: { 'Content-Type': 'application/json' } }
    );
};

export const cleanSessions = async (dryRun: boolean, cleanAll: boolean, confirmationToken?: string) => {
    return http.post<Response<SessionCleanResult>>(
        'v1/utilities/clean-sessions',
        {
            ...cleanupConfirmationBody(dryRun, confirmationToken),
            cleanAll
        },
        { headers: { 'Content-Type': 'application/json' } }
    );
};

export const cleanLogs = async (dryRun: boolean, confirmationToken?: string) => {
    return http.post<Response<LogCleanResult>>(
        'v1/utilities/clean-logs',
        cleanupConfirmationBody(dryRun, confirmationToken),
        { headers: { 'Content-Type': 'application/json' } }
    );
};

export const cleanImages = async (
    dryRun: boolean,
    target: string,
    removeDuplicates: boolean,
    confirmationToken?: string
) => {
    return http.post<Response<ImageCleanResult>>(
        'v1/utilities/clean-images',
        {
            ...cleanupConfirmationBody(dryRun, confirmationToken),
            target,
            removeDuplicates
        },
        { headers: { 'Content-Type': 'application/json' } }
    );
};

// Admin User Management API
export type ManagedUserRole = 'READER' | 'EDITOR';
export type ManagedUserRoleFilter = 'all' | 'reader' | 'editor' | 'admin';
export type ManagedUserOrdering = 'username' | '-username' | 'postCount' | '-postCount' | 'dateJoined' | '-dateJoined';

export interface ManagedUser {
    id: number;
    username: string;
    name: string;
    email: string;
    role: ManagedUserRole;
    isActive: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    hasTwoFactor: boolean;
    canChangeRole: boolean;
    canChangeStatus: boolean;
    canDelete: boolean;
    canResetPassword: boolean;
    canResetTwoFactor: boolean;
    postCount: number;
    dateJoined: string | null;
    lastLogin: string | null;
}

export interface ManagedUsersPagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

export interface ManagedUsersStats {
    total: number;
    editors: number;
    readers: number;
    admins: number;
}

export interface ManagedUsersResult {
    users: ManagedUser[];
    pagination: ManagedUsersPagination;
    stats: ManagedUsersStats;
}

export const getManagedUsers = async (
    query = '',
    page = 1,
    pageSize = 20,
    role: ManagedUserRoleFilter = 'all',
    ordering: ManagedUserOrdering = 'username'
) => {
    const search = query.trim();
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (role !== 'all') params.set('role', role);
    params.set('ordering', ordering);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));

    return http.get<Response<ManagedUsersResult>>(`v1/admin/users?${params.toString()}`);
};

export const updateManagedUserRole = async (userId: number, role: ManagedUserRole) => {
    return http.patch<Response<{ user: ManagedUser }>>(
        `v1/admin/users/${userId}/role`,
        { role },
        { headers: { 'Content-Type': 'application/json' } }
    );
};

export const updateManagedUserStatus = async (userId: number, isActive: boolean) => {
    return http.patch<Response<{ user: ManagedUser }>>(
        `v1/admin/users/${userId}/status`,
        { isActive },
        { headers: { 'Content-Type': 'application/json' } }
    );
};

export const deleteManagedUser = async (userId: number, username: string) => {
    return http.delete<Response<{ username: string }>>(`v1/admin/users/${userId}`, {
        data: { username },
        headers: { 'Content-Type': 'application/json' }
    });
};

export const resetManagedUserTwoFactor = async (userId: number) => {
    return http.delete<Response<{ user: ManagedUser }>>(`v1/admin/users/${userId}/two-factor`);
};

export const createManagedUserPasswordLink = async (userId: number) => {
    return http.post<Response<{ url: string; expiresDate: string }>>(`v1/admin/users/${userId}/password-link`);
};

export type ModeratedPostStatus = 'public' | 'hidden' | 'trash';
export type ModeratedPostFilter = 'all' | ModeratedPostStatus;

export interface ModeratedPost {
    id: number;
    title: string;
    path: string;
    author: string;
    authorActive: boolean;
    status: ModeratedPostStatus;
    commentCount: number;
    likeCount: number;
    publishedDate: string | null;
    deletedDate: string | null;
}

export interface ModeratedComment {
    id: number;
    excerpt: string;
    author: string;
    isReply: boolean;
    isEdited: boolean;
    postTitle: string;
    postPath: string;
    createdDate: string | null;
}

export const getModeratedPosts = async (query: string, status: ModeratedPostFilter, page: number) => {
    const params = new URLSearchParams({ page: String(page) });
    if (query.trim()) params.set('q', query.trim());
    if (status !== 'all') params.set('status', status);
    return http.get<Response<{ posts: ModeratedPost[]; pagination: ManagedUsersPagination }>>(
        `v1/admin/posts?${params.toString()}`
    );
};

export const setModeratedPostHidden = async (postId: number, isHidden: boolean) => {
    return http.patch<Response<ModeratedPost>>(
        `v1/admin/posts/${postId}`,
        { isHidden },
        { headers: { 'Content-Type': 'application/json' } }
    );
};

export const moveModeratedPostToTrash = async (postId: number) => {
    return http.post<Response<ModeratedPost>>(`v1/admin/posts/${postId}/trash`);
};

export const restoreModeratedPost = async (postId: number) => {
    return http.post<Response<ModeratedPost>>(`v1/admin/posts/${postId}/restore`);
};

export const getModeratedComments = async (query: string, page: number) => {
    const params = new URLSearchParams({ page: String(page) });
    if (query.trim()) params.set('q', query.trim());
    return http.get<Response<{ comments: ModeratedComment[]; pagination: ManagedUsersPagination }>>(
        `v1/admin/comments?${params.toString()}`
    );
};

export const deleteModeratedComment = async (commentId: number) => {
    return http.delete<Response<{ id: number }>>(`v1/admin/comments/${commentId}`);
};

export interface AuthorInvite {
    id: number;
    code: string;
    note: string;
    signupUrl: string;
    isActive: boolean;
    isClaimed: boolean;
    createdBy: string;
    claimedBy: string;
    createdDate: string | null;
    claimedDate: string | null;
}

export const getAuthorInvites = async () => {
    return http.get<Response<{ invites: AuthorInvite[] }>>('v1/admin/author-invites');
};

export const createAuthorInvite = async (note = '') => {
    return http.post<Response<{ invite: AuthorInvite }>>(
        'v1/admin/author-invites',
        { note },
        { headers: { 'Content-Type': 'application/json' } }
    );
};

export const deleteAuthorInvite = async (inviteId: number) => {
    return http.delete<Response<{ success?: boolean }>>(`v1/admin/author-invites/${inviteId}`);
};

// Author Subscription API
export interface AuthorSubscription {
    username: string;
    name: string;
    avatar: string;
    bio: string;
    isPublishing: boolean;
    subscribedDate: string;
}

export interface AuthorSubscriptionState {
    canSubscribe: boolean;
    isSubscribed: boolean;
}

export const getAuthorSubscriptions = async () => {
    return http.get<
        Response<{
            subscriptions: AuthorSubscription[];
            isTelegramConnected: boolean;
        }>
    >('v1/subscriptions');
};

export const unsubscribeAuthor = async (username: string) => {
    return http.delete<Response<AuthorSubscriptionState>>(`v1/users/@${encodeURIComponent(username)}/subscription`);
};
