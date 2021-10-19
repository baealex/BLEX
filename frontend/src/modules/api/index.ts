import axios, { AxiosRequestConfig } from 'axios'
import { CONFIG } from '@modules/settings';
import { snackBar } from '@modules/snack-bar';

export default async function axiosRequest<T>(config: AxiosRequestConfig) {
    const { request } = axios.create({
        baseURL: CONFIG.API_SERVER,
        withCredentials: true,
    });

    try {
        return await request<T>(config);
    } catch(e) {
        snackBar(EMOJI.SYSTEM_ERR + '시스템 오류가 발생했습니다.');
        throw e;
    }
}

export * from './auth';
export * from './comments';
export * from './forms';
export * from './image';
export * from './posts';
export * from './search';
export * from './series';
export * from './setting';
export * from './tags';
export * from './telegram';
export * from './users';

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

export const EMOJI = {
    SYSTEM_ERR: '😱 ',
    BEFORE_REQ_ERR: '🤔 ',
    AFTER_REQ_ERR: '😥 ',
    AFTER_REQ_DONE: '😀 '
}

type ErrorCode =
    'error:RJ' | 'error:EP' | 'error:NL' | 'error:SU' |
    'error:DU' | 'error:OF' | 'error:AV' | 'error:AU' |
    'error:AE' | 'error:NT' | 'error:EN' | 'error:UN' ;

export interface ResponseData<T> {
    status: 'DONE' | 'ERROR',
    errorCode?: ErrorCode,
    errorMessage?: string,
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
    Object.keys(obj).forEach((key) => {
        form.append(key, obj[key]);
    });
    return form;
}