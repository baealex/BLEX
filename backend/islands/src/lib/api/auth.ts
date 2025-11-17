import { http } from '~/modules/http.module';

export interface LoginRequest {
    username: string;
    password: string;
    captcha_token?: string;
}

export interface LoginResponse {
    status: 'DONE' | 'ERROR' | 'NEED_2FA';
    body?: {
        url: string;
    };
    errorMessage?: string;
}

export interface SecurityCodeRequest {
    auth_code: string;
}

export interface SocialProvider {
    provider: string;
    url: string;
}

/**
 * Login with username and password
 */
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await fetch('/v1/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    return response.json();
};

/**
 * Submit 2FA verification code
 */
export const submit2FACode = async (data: SecurityCodeRequest): Promise<LoginResponse> => {
    const response = await fetch('/v1/auth/security/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    return response.json();
};

/**
 * Get available social login providers
 */
export const getSocialProviders = async (): Promise<SocialProvider[]> => {
    const response = await fetch('/v1/social-providers');
    return response.json();
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
