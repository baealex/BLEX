import type {
    AxiosRequestConfig,
    RawAxiosRequestHeaders
} from 'axios';
import axios from 'axios';

import { CONFIG } from '~/modules/settings';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

type ErrorCode =
    'error:RJ' | 'error:EP' | 'error:AT' | 'error:OF' |
    'error:NL' | 'error:AV' | 'error:AU' | 'error:AC' |
    'error:AE' | 'error:NT' | 'error:NO' | 'error:EN' |
    'error:UN' | 'error:VA';

export const ERROR = {
    REJECT: 'error:RJ',
    EXPIRED: 'error:EP',
    VALIDATE: 'error:VA',
    NEED_LOGIN: 'error:NL',
    AUTHENTICATION: 'error:AT',
    SIZE_OVERFLOW: 'error:OF',
    ALREADY_EXISTS: 'error:AE',
    ALREADY_CONNECTED: 'error:AC',
    ALREADY_DISCONNECTED: 'error:AU',
    ALREADY_VERIFICATION: 'error:AV',
    NEED_TELEGRAM: 'error:NT',
    NEED_OPENAI: 'error:NO',
    EMAIL_NOT_MATCH: 'error:EN',
    USERNAME_NOT_MATCH: 'error:UN'
};

export interface ResponseData<T> {
    status: 'DONE' | 'ERROR';
    errorCode?: ErrorCode;
    errorMessage?: string;
    body: T;
}

export type Headers = RawAxiosRequestHeaders & {
    'Cookie'?: string;
    'Content-Type'?: string;
};

const { request } = axios.create({
    baseURL: CONFIG.API_SERVER,
    withCredentials: true
});

export default async function axiosRequest<T>(config: AxiosRequestConfig) {
    const isBrowser = typeof window !== 'undefined';

    if (config.headers) {
        const { headers } = config;
        Object.keys(headers).forEach(key => {
            if (!headers[key]) {
                delete headers[key];
            }
        });
        config.headers = headers;
    }

    try {
        return await request<ResponseData<T>>(config);
    } catch (e) {
        if (axios.isAxiosError(e)) {
            if (isBrowser) {
                if (e.response) {
                    const { status } = e.response;
                    if (status >= 400 && status < 500) {
                        snackBar(message('SYSTEM_ERR', '적절하지 않은 요청입니다.'));
                        throw e;
                    }
                    if (status >= 500) {
                        snackBar(message('SYSTEM_ERR', '시스템 오류가 발생했습니다.'));
                        throw e;
                    }
                }
                snackBar(message('SYSTEM_ERR', '알 수 없는 오류가 발생했습니다.'));
                throw e;
            }
        }
        throw e;
    }
}

export function serializeObject<T extends object>(record: T) {
    let result = '';

    for (const key in record) {
        if (record[key] === undefined) {
            continue;
        }
        result += `${key}=${encodeURIComponent(record[key] as string)}&`;
    }
    return result.slice(0, -1);
}

export function objectToForm<T extends object>(record: T) {
    const form = new FormData();

    for (const key in record) {
        if (record[key] === undefined) {
            continue;
        }
        form.append(key, record[key] as string);
    }
    return form;
}
