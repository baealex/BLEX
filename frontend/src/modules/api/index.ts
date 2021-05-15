export * from './auth';
export * from './comments';
export * from './forms';
export * from './posts';
export * from './series';
export * from './setting';
export * from './tags';
export * from './users';

import axios from 'axios';

axios.defaults.withCredentials = true;

import NProgress from 'nprogress';

import Config from '../config.json';

export const ERROR = {
    REJECT: 'error:RJ',
    EXPIRE: 'error:EP',
    NOT_LOGIN: 'error:NL',
    SAME_USER: 'error:SU',
    DIFF_USER: 'error:DU',
    OVER_FLOW: 'error:OF',
    ALREADY_VERIFY: 'error:AV',
    ALREADY_UNSYNC: 'error:AU',
    ALREADY_EXISTS: 'error:AE',
    NEED_TELEGRAM: 'error:NT',
    EMAIL_NOT_MATCH: 'error:EN',
    USERNAME_NOT_MATCH: 'error:UN',
};

type ErrorCode =
    'error:RJ' | 'error:EP' | 'error:NL' | 'error:SU' |
    'error:DU' | 'error:OF' | 'error:AV' | 'error:AU' |
    'error:AE' | 'error:NT' | 'error:EN' | 'error:UN' ;

export interface ResponseData<T> {
    status: 'DONE' | 'ERROR',
    errorCode?: ErrorCode,
    body: T
}

export function serializeObject(obj: {
    [key: string]: any
}) {
    return Object.keys(obj).reduce((acc, cur) => {
        return acc += `${cur}=${obj[cur] === undefined ? '' : encodeURIComponent(obj[cur])}&`;
    }, '').slice(0, -1);
}

export function objectToForm(obj: {
    [key: string]: any
}) {
    const form = new FormData();
    Object.keys(obj).forEach((item) => {
        form.append(item, obj[item]);
    });
    return form;
}

export async function telegram(parameter: 'unsync' | 'makeToken') {
    return await axios({
        url: `${Config.API_SERVER}/v1/telegram/${parameter}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        withCredentials: true,
    });
}

export async function uploadImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    NProgress.start();
    try {
        const formData = new FormData();
        formData.append('image', file);
        const response = await axios({
            url: `${Config.API_SERVER}/v1/image/upload`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: formData,
            withCredentials: true,
        });
        NProgress.done();
        return response;
    } catch(e) {
        NProgress.done();
        return e;
    }
}