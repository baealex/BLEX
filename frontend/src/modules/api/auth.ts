import type { Headers } from './request';
import request, { serializeObject } from './request';

export interface GetLoginResponseData {
    username: string;
    name: string;
    email: string;
    avatar: string;
    notifyCount: number;
    isFirstLogin: boolean;
    hasConnectedTelegram: boolean;
    hasConnectedOpenai: boolean;
    hasConnected2fa: boolean;
    hasEditorRole: boolean;
}

export async function getLogin(headers?: Headers) {
    return await request<GetLoginResponseData>({
        url: '/v1/login',
        method: 'GET',
        headers
    });
}

interface PatchSignResponseData {
    username?: string;
    name?: string;
}

export async function patchSign(data: PatchSignResponseData) {
    return await request<unknown>({
        url: '/v1/sign',
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject(data)
    });
}

export interface PostLoginResponseData extends GetLoginResponseData {
    security?: boolean;
}

export async function postLogin(username: string, password: string) {
    return await request<PostLoginResponseData>({
        url: '/v1/login',
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            username,
            password
        })
    });
}

export async function postLogout() {
    return await request<unknown>({
        url: '/v1/logout',
        method: 'POST'
    });
}

export async function postSign(username: string, password: string, email: string, name: string) {
    return await request<undefined>({
        url: '/v1/sign',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            username,
            name,
            password,
            email
        })
    });
}

export async function deleteSign() {
    return await request<unknown>({
        url: '/v1/sign',
        method: 'DELETE'
    });
}

export async function postSignSocialLogin(social: string, code: string) {
    return await request<PostLoginResponseData>({
        url: `/v1/sign/${social}`,
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            code
        })
    });
}

export async function postSecurity() {
    return await request<unknown>({
        url: '/v1/auth/security',
        method: 'POST'
    });
}

export async function deleteSecurity() {
    return await request<unknown>({
        url: '/v1/auth/security',
        method: 'DELETE'
    });
}

export async function postSecuritySend(authToken: string) {
    return await request<GetLoginResponseData>({
        url: '/v1/auth/security/send',
        method: 'POST',
        data: serializeObject({
            auth_token: authToken
        })
    });
}

export interface GetEmailVerifyResponseData {
    firstName: string;
}

export async function getEmailVerify(token: string) {
    return await request<GetEmailVerifyResponseData>({
        url: `/v1/auth/email-verify/${token}`,
        method: 'GET'
    });
}

export async function postEmailVerify(token: string, hctoken?: string) {
    return await request<GetLoginResponseData>({
        url: `/v1/auth/email-verify/${token}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            hctoken
        })
    });
}

export interface CheckChangeUsernameRequestData {
    username: string;
}

export interface CheckChangeUsernameResponseData {
    oldUsername: string;
    newUsername: string;
    createdDate: string;
}

export function checkRedirect(data: CheckChangeUsernameRequestData) {
    return request<CheckChangeUsernameResponseData>({
        url: `/v1/users/${encodeURIComponent(data.username)}/check-redirect`,
        method: 'GET',
        data: serializeObject(data)
    });
}
