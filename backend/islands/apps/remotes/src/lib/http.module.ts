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

// CSRF token retrieval with fallback
const getCsrfToken = () => {
    if (typeof document !== 'undefined') {
        return handyCookie.get('csrftoken') || '';
    }
    return '';
};

export const http = axios.create({
    baseURL: '/',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken()
    }
});
