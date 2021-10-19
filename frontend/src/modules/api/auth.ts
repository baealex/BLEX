import axiosRequest, {
    ResponseData,
    serializeObject,
} from './index';

export async function getLogin(cookie='') {
    return await axiosRequest<ResponseData<GetLoginData>>({
        url: `/v1/login`,
        method: 'GET',
        headers: cookie ? {
            'Cookie': cookie
        } : {}
    });
}

export interface GetLoginData {
    username: string;
    avatar: string;
    notify: {
        pk: number;
        url: string;
        isRead: boolean;
        content: string;
        createdDate: string;
    }[];
    isTelegramSync: boolean;
    is2faSync: boolean;
}

export async function postLogin(username: string, password: string) {
    return await axiosRequest<ResponseData<PostLoginData>>({
        url: `/v1/login`,
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

export interface PostLoginData extends GetLoginData {
    security?: boolean;
}

export async function postLogout() {
    return await axiosRequest<ResponseData<any>>({
        url: `/v1/logout`,
        method: 'POST'
    });
}

export async function postSign(username: string, password: string, email: string, realname: string) {
    return await axiosRequest<ResponseData<any>>({
        url: `/v1/sign`,
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
    });
}

export async function deleteSign() {
    return await axiosRequest<ResponseData<any>>({
        url: `/v1/sign`,
        method: 'DELETE',
    });
}

export async function postSignSocialLogin(social: string, code: string) {
    return await axiosRequest<ResponseData<PostLoginData>>({
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
    return await axiosRequest<ResponseData<any>>({
        url: `/v1/auth/security`,
        method: 'POST',
    });
}

export async function deleteSecurity() {
    return await axiosRequest<ResponseData<any>>({
        url: `/v1/auth/security`,
        method: 'DELETE',
    });
}

export async function postSecuritySend(authToken: string) {
    return await axiosRequest<ResponseData<GetLoginData>>({
        url: `/v1/auth/security/send`,
        method: 'POST',
        data: serializeObject({
            auth_token: authToken
        })
    });
}

export async function getEmailVerify(token: string) {
    return await axiosRequest<ResponseData<GetEmailVerifyData>>({
        url: `/v1/auth/email-verify/${token}`,
        method: 'GET',
    });
}

export interface GetEmailVerifyData {
    firstName: string;
}

export async function postEmailVerify(token: string, hctoken?: string) {
    return await axiosRequest<ResponseData<GetLoginData>>({
        url: `/v1/auth/email-verify/${token}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            hctoken
        }),
    });
}