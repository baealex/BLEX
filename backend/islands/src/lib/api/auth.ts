import { http, type Response } from '~/modules/http.module';

export interface LoginRequest {
    username: string;
    password: string;
    captcha_token?: string;
}

export interface LoginResponseBody {
    url: string;
    security?: boolean;
}

export type LoginResponse = Response<LoginResponseBody>;

export interface SecurityCodeRequest {
    auth_code: string;
}

export interface SocialProvider {
    key: string;
    name: string;
    color: string;
}

export type SocialProvidersResponse = Response<SocialProvider[]>;

/**
 * Login with username and password
 */
export const login = async (data: LoginRequest) => {
    return http.post<LoginResponse>('v1/login', data);
};

/**
 * Submit 2FA verification code
 */
export const submit2FACode = async (data: SecurityCodeRequest) => {
    return http.post<LoginResponse>('v1/auth/security/send', data);
};

/**
 * Get available social login providers
 */
export const getSocialProviders = async () => {
    return http.get<SocialProvidersResponse>('v1/social-providers');
};

/**
 * Enable 2FA for account
 */
export const enable2FA = async () => {
    return http.post('v1/auth/security');
};

/**
 * Disable 2FA for account
 */
export const disable2FA = async () => {
    return http.delete('v1/auth/security');
};
