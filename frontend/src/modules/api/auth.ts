import axios from 'axios';

axios.defaults.withCredentials = true;

import Config from '../config.json';

import {
    ResponseData,
    serializeObject,
} from './index';

export async function getLogin(cookie='') {
    return await axios.request<ResponseData<GetLoginData>>({
        url: `${Config.API_SERVER}/v1/login`,
        method: 'GET',
        headers: cookie ? {
            'Cookie': cookie
        } : {}
    });
}

export interface GetLoginData {
    username: string;
    notifyCount: number;
}

export async function postLogin(username: string, password: string) {
    return await axios.request<ResponseData<PostLoginData>>({
        url: `${Config.API_SERVER}/v1/login`,
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

export interface PostLoginData {
    username: string;
    security?: boolean;
    notifyCount?: number;
}

export async function postLogout() {
    return await axios.request<ResponseData<any>>({
        url: `${Config.API_SERVER}/v1/logout`,
        method: 'POST'
    });
}

export async function postSign(username: string, password: string, email: string, realname: string) {
    return await axios.request<ResponseData<any>>({
        url: `${Config.API_SERVER}/v1/sign`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            username,
            realname,
            password,
            email
        }),
        withCredentials: true,
    });
}

export async function deleteSign() {
    return await axios.request<ResponseData<any>>({
        url: `${Config.API_SERVER}/v1/sign`,
        method: 'DELETE',
        withCredentials: true,
    });
}

export async function postSignSocialLogin(social: string, code: string) {
    return await axios.request<ResponseData<PostLoginData>>({
        url: `${Config.API_SERVER}/v1/sign/${social}`,
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
    return await axios.request<ResponseData<any>>({
        url: `${Config.API_SERVER}/v1/auth/security`,
        method: 'POST',
        withCredentials: true,
    });
}

export async function deleteSecurity() {
    return await axios.request<ResponseData<any>>({
        url: `${Config.API_SERVER}/v1/auth/security`,
        method: 'DELETE',
        withCredentials: true,
    });
}

export async function postSecuritySend(authToken: string) {
    return await axios.request<ResponseData<GetLoginData>>({
        url: `${Config.API_SERVER}/v1/auth/security/send`,
        method: 'POST',
        withCredentials: true,
        data: serializeObject({
            auth_token: authToken
        })
    });
}

export async function getEmailVerify(token: string) {
    return await axios.request<ResponseData<GetEmailVerifyData>>({
        url: `${Config.API_SERVER}/v1/auth/email-verify/${token}`,
        method: 'GET',
    });
}

export interface GetEmailVerifyData {
    firstName: string;
}

export async function postEmailVerify(token: string, hctoken?: string) {
    return await axios.request<ResponseData<GetLoginData>>({
        url: `${Config.API_SERVER}/v1/auth/email-verify/${token}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            hctoken
        }),
        withCredentials: true,
    });
}