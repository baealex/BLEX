import axios from 'axios';
import { handyCookie } from '@baejino/handy';

export interface DoneResponse<T> {
    status: 'DONE';
    body: T;
}

export interface ErrorResponse {
    status: 'ERROR';
    errorCode: string;
    errorMessage: string;
}

export type Response<T> = DoneResponse<T> | ErrorResponse;

const getCsrfToken = () => {
    if (typeof document !== 'undefined') {
        const inputToken = document.querySelector<HTMLInputElement>('[name=csrfmiddlewaretoken]')?.value;
        return inputToken || handyCookie.get('csrftoken') || '';
    }
    return '';
};

export const http = axios.create({
    baseURL: '/',
    headers: { 'Content-Type': 'application/json' }
});

http.interceptors.request.use((config) => {
    config.headers.set('X-CSRFToken', getCsrfToken());
    return config;
});
