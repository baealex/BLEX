import { http } from '~/modules/http.module';

export interface AccountData {
    username: string;
    name: string;
    email: string;
    has_two_factor: boolean;
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
    name: string;
    count: number;
}

export interface TempPost {
    token: string;
    title: string;
    description: string;
    created_date: string;
}

/**
 * Get account settings
 */
export const getAccountSettings = async () => {
    return http.get('v1/setting/account');
};

/**
 * Update account settings
 */
export const updateAccountSettings = async (data: AccountUpdateData) => {
    const formData = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            formData.append(key, value);
        }
    });

    return http.put('v1/setting/account', formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
};

/**
 * Get profile settings
 */
export const getProfileSettings = async () => {
    return http.get('v1/setting/profile');
};

/**
 * Update profile settings
 */
export const updateProfileSettings = async (data: ProfileUpdateData) => {
    const formData = new URLSearchParams();
    if (data.bio !== undefined) formData.append('bio', data.bio);
    if (data.homepage !== undefined) formData.append('homepage', data.homepage);

    return http.put('v1/setting/profile', formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
};

/**
 * Upload profile avatar
 */
export const uploadAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    return http.post('v1/setting/avatar', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

/**
 * Update notification configuration
 */
export const updateNotifyConfig = async (config: NotifyConfig) => {
    const formData = new URLSearchParams();
    Object.entries(config).forEach(([key, value]) => {
        formData.append(key, value.toString());
    });

    return http.put('v1/setting/notify-config', formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
};

/**
 * Get user tags
 */
export const getTags = async () => {
    return http.get('v1/setting/tag');
};

/**
 * Get user series
 */
export const getSeries = async () => {
    return http.get('v1/setting/series');
};

/**
 * Get temporary posts
 */
export const getTempPosts = async () => {
    return http.get('v1/temp-posts');
};

/**
 * Delete temporary post
 */
export const deleteTempPost = async (token: string) => {
    return http.delete(`v1/temp-posts/${token}`);
};
