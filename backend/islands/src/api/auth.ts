import { type Response } from '~/modules/http.module';

const getCsrfToken = (): string => {
    const token = document.querySelector<HTMLInputElement>('[name=csrfmiddlewaretoken]')?.value;
    return token || '';
};

interface LoginResponse {
    security?: boolean;
}

interface SocialProvider {
    name: string;
    url: string;
    icon: string;
}

export const authApi = {
    // Regular login
    login: async (username: string, password: string, captchaToken?: string | null) => {
        const requestBody = new URLSearchParams({
            'username': username,
            'password': password
        });

        if (captchaToken) {
            requestBody.append('h-captcha-response', captchaToken);
        }

        const response = await fetch('/v1/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCsrfToken()
            },
            body: requestBody
        });

        const data = await response.json() as Response<LoginResponse>;
        return data;
    },

    // Two-factor authentication
    verifyTwoFactor: async (code: string) => {
        const response = await fetch('/v1/auth/security/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCsrfToken()
            },
            body: new URLSearchParams({ 'code': code })
        });

        const data = await response.json() as Response<unknown>;
        return data;
    },

    // Get social login providers
    getSocialProviders: async () => {
        const response = await fetch('/v1/auth/social', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json() as Response<{ providers: SocialProvider[] }>;

        if (data.status !== 'DONE') {
            throw new Error('Failed to fetch social providers');
        }

        return data.body.providers;
    },

    // Submit invitation request
    submitInvitationRequest: async (email: string, reason: string) => {
        const response = await fetch('/v1/auth/invitation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCsrfToken()
            },
            body: new URLSearchParams({
                'email': email,
                'reason': reason
            })
        });

        const data = await response.json() as Response<unknown>;
        return data;
    }
};
