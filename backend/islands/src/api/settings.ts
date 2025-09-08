import { http, type Response } from '~/modules/http.module';

interface AnalyticsView {
    username: string;
    total: number;
    views: {
        date: string;
        count: number;
    }[];
}

interface PostView {
    posts: {
        id: number;
        url: string;
        title: string;
        author: string;
        todayCount: number;
        increaseCount: number;
    }[];
}

interface AccountData {
    username: string;
    name: string;
    email: string;
    createdDate: string;
    has2fa: boolean;
}

interface SocialLinksData {
    github?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    threads?: string;
    youtube?: string;
}

interface ProfileData {
    bio?: string;
    avatar?: string;
}

interface NotifyData {
    email: boolean;
    telegram: boolean;
}

interface SeriesData {
    id: number;
    url: string;
    name: string;
    description: string;
    countPosts: number;
}

interface PostData {
    id: number;
    url: string;
    title: string;
    description: string;
    createdDate: string;
    updatedDate: string;
    countViews: number;
    countLikes: number;
    countComments: number;
    isHide: boolean;
    isAdvertise: boolean;
}

interface TempPostData {
    id: number;
    title: string;
    description: string;
    updatedDate: string;
}

interface InvitationData {
    id: string;
    code: string;
    username?: string;
    createdDate: string;
    isUsed: boolean;
}

interface IntegrationData {
    telegram_token?: string;
    github_token?: string;
}

interface FormData {
    id: string;
    name: string;
    description?: string;
    createdDate: string;
    isActive: boolean;
    responses: {
        id: string;
        data: Record<string, string>;
        createdDate: string;
    }[];
}

interface NotifyListData {
    notify: {
        id: number;
        url: string;
        isRead: boolean;
        content: string;
        createdDate: string;
    }[];
    isTelegramSync: boolean;
}

interface NotifyConfigData {
    config: {
        name: string;
        value: boolean;
    }[];
}

interface RefererItem {
    url: string;
    title?: string;
    description?: string;
    time: string;
    posts: {
        author: string;
        url: string;
        title: string;
    };
}

interface RefererAnalytics {
    referers: RefererItem[];
}

export const settingsApi = {
    // Analytics
    getAnalyticsView: async () => {
        const { data } = await http.get<Response<AnalyticsView>>('/v1/setting/analytics-view');
        if (data.status === 'DONE') {
            return {
                ...data,
                dates: data.body.views.map(item => item.date).reverse(),
                counts: data.body.views.map(item => item.count).reverse()
            };
        }
        throw new Error('Failed to fetch analytics view');
    },

    getAnalyticsPostsView: async (date: string) => {
        const { data } = await http.get<Response<PostView>>('/v1/setting/analytics-posts-view', { params: { date } });
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('Failed to fetch analytics posts view');
    },

    getAnalyticsRefererView: async () => {
        const { data } = await http.get<Response<RefererAnalytics>>('/v1/setting/analytics-referer');
        if (data.status === 'DONE') {
            return data.body;
        }
        return null;
    },

    // Account
    getAccount: async () => {
        const { data } = await http<Response<AccountData>>('v1/setting/account', { method: 'GET' });
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('계정 정보를 불러오는데 실패했습니다.');
    },

    updateAccount: async (accountData: Partial<{ username: string; name: string; password: string }>) => {
        const { data } = await http('v1/setting/account', {
            method: 'PUT',
            data: accountData
        });
        return data;
    },

    // 2FA
    toggle2FA: async (enable: boolean) => {
        const { data } = await http('v1/auth/security', { method: enable ? 'POST' : 'DELETE' });
        return data;
    },

    // Social Links
    getSocialLinks: async () => {
        const { data } = await http<Response<SocialLinksData>>('v1/setting/social-links', { method: 'GET' });
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('소셜 링크 정보를 불러오는데 실패했습니다.');
    },

    updateSocialLinks: async (socialData: SocialLinksData) => {
        const { data } = await http('v1/setting/social-links', {
            method: 'PUT',
            data: socialData
        });
        return data;
    },

    // Profile
    getProfile: async () => {
        const { data } = await http<Response<ProfileData>>('v1/setting/profile', { method: 'GET' });
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('프로필 정보를 불러오는데 실패했습니다.');
    },

    updateProfile: async (profileData: ProfileData) => {
        const { data } = await http('v1/setting/profile', {
            method: 'PUT',
            data: profileData
        });
        return data;
    },

    uploadAvatar: async (formData: FormData) => {
        const { data } = await http('v1/setting/profile/avatar', {
            method: 'POST',
            data: formData
        });
        return data;
    },

    // Notifications
    getNotifications: async () => {
        const { data } = await http<Response<NotifyData>>('v1/setting/notify', { method: 'GET' });
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('알림 설정을 불러오는데 실패했습니다.');
    },

    updateNotifications: async (notifyData: NotifyData) => {
        const { data } = await http('v1/setting/notify', {
            method: 'PUT',
            data: notifyData
        });
        return data;
    },

    // Series
    getSeries: async () => {
        const { data } = await http<Response<{ series: SeriesData[] }>>('v1/setting/series', { method: 'GET' });
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('시리즈 목록을 불러오는데 실패했습니다.');
    },

    createSeries: async (seriesData: { name: string; description: string }) => {
        const { data } = await http('v1/setting/series', {
            method: 'POST',
            data: seriesData
        });
        return data;
    },

    updateSeries: async (id: number, seriesData: { name: string; description: string }) => {
        const { data } = await http(`v1/setting/series/${id}`, {
            method: 'PUT',
            data: seriesData
        });
        return data;
    },

    deleteSeries: async (id: number) => {
        const { data } = await http(`v1/setting/series/${id}`, { method: 'DELETE' });
        return data;
    },

    // Posts
    getPosts: async () => {
        const { data } = await http<Response<{ posts: PostData[] }>>('v1/setting/posts', { method: 'GET' });
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('포스트 목록을 불러오는데 실패했습니다.');
    },

    updatePost: async (url: string, postData: Partial<PostData>) => {
        const { data } = await http(`v1/setting/posts/${url}`, {
            method: 'PUT',
            data: postData
        });
        return data;
    },

    deletePost: async (url: string) => {
        const { data } = await http(`v1/setting/posts/${url}`, { method: 'DELETE' });
        return data;
    },

    // Temp Posts
    getTempPosts: async () => {
        const { data } = await http<Response<{ posts: TempPostData[] }>>('v1/setting/temp-posts', { method: 'GET' });
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('임시 포스트 목록을 불러오는데 실패했습니다.');
    },

    deleteTempPost: async (id: number) => {
        const { data } = await http(`v1/setting/temp-posts/${id}`, { method: 'DELETE' });
        return data;
    },

    // Invitations
    getInvitations: async () => {
        const { data } = await http<Response<{ invitations: InvitationData[] }>>('v1/setting/invitation', { method: 'GET' });
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('초대 목록을 불러오는데 실패했습니다.');
    },

    createInvitation: async () => {
        const { data } = await http('v1/setting/invitation', { method: 'POST' });
        return data;
    },

    deleteInvitation: async (id: string) => {
        const { data } = await http(`v1/setting/invitation/${id}`, { method: 'DELETE' });
        return data;
    },

    // Integration
    getIntegration: async () => {
        const { data } = await http<Response<IntegrationData>>('v1/setting/integration', { method: 'GET' });
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('연동 설정을 불러오는데 실패했습니다.');
    },

    updateIntegration: async (integrationData: IntegrationData) => {
        const { data } = await http('v1/setting/integration', {
            method: 'PUT',
            data: integrationData
        });
        return data;
    },

    // Forms
    getForms: async () => {
        const { data } = await http<Response<{ forms: FormData[] }>>('v1/setting/forms', { method: 'GET' });
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('폼 목록을 불러오는데 실패했습니다.');
    },

    createForm: async (formData: { name: string; description?: string }) => {
        const { data } = await http('v1/setting/forms', {
            method: 'POST',
            data: formData
        });
        return data;
    },

    updateForm: async (id: string, formData: { name: string; description?: string; isActive?: boolean }) => {
        const { data } = await http(`v1/setting/forms/${id}`, {
            method: 'PUT',
            data: formData
        });
        return data;
    },

    deleteForm: async (id: string) => {
        const { data } = await http(`v1/setting/forms/${id}`, { method: 'DELETE' });
        return data;
    },

    // Notifications
    getNotifyList: async () => {
        const { data } = await http<Response<NotifyListData>>('v1/setting/notify', { method: 'GET' });
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('알림 목록을 불러오는데 실패했습니다.');
    },

    getNotifyConfig: async () => {
        const { data } = await http<Response<NotifyConfigData>>('v1/setting/notify-config', { method: 'GET' });
        if (data.status === 'DONE') {
            return data.body.config;
        }
        throw new Error('알림 설정을 불러오는데 실패했습니다.');
    },

    updateNotifyRead: async (id: number) => {
        const urlEncodedData = `id=${id}`;
        const { data } = await http('v1/setting/notify', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: urlEncodedData
        });
        return data;
    },

    updateNotifyConfig: async (config: { name: string; value: boolean }[]) => {
        const urlEncodedData = config
            .map(item => `${item.name}=${encodeURIComponent(item.value.toString())}`)
            .join('&');

        const { data } = await http('v1/setting/notify-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: urlEncodedData
        });
        return data;
    }
};
