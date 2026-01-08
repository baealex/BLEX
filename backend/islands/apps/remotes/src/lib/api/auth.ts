import { http, type Response } from '../http.module';

export interface LoginRequest {
    username?: string;
    password?: string;
    code?: string;
    captcha_token?: string;
    oauth_token?: string;
}

export interface LoginResponseBody {
    url: string;
    security?: boolean;
}

export type LoginResponse = Response<LoginResponseBody>;

export interface SecurityCodeRequest {
    username: string;
    code: string;
}

export interface SocialProvider {
    key: string;
    name: string;
    color: string;
}

export type SocialProvidersResponse = Response<SocialProvider[]>;

export const login = async (data: LoginRequest) => {
    return http.post<LoginResponse>('v1/login', data);
};

export const submit2FACode = async (data: SecurityCodeRequest) => {
    return http.post<LoginResponse>('v1/auth/security/send', data);
};

export const getSocialProviders = async () => {
    return http.get<SocialProvidersResponse>('v1/social-providers');
};

export interface Enable2FAResponseBody {
    qrCode: string;
    recoveryKey: string;
}

export type Enable2FAResponse = Response<Enable2FAResponseBody>;

export const enable2FA = async () => {
    return http.post<Enable2FAResponse>('v1/auth/security');
};

export const verify2FASetup = async (code: string) => {
    return http.post<Response<{ message: string }>>('v1/auth/security/verify', { code });
};

export const disable2FA = async () => {
    return http.delete('v1/auth/security');
};
