import axios from 'axios';
import { handyCookie } from '@baejino/handy';

export interface DoneResponse<T> {
    status: 'DONE';
    body: T;
}

export interface ErrorResponse {
    status: 'ERROR';
    errorMessage: string;
}

export type Response<T> = DoneResponse<T> | ErrorResponse;

export const http = axios.create({
    baseURL: '/',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': handyCookie.get('csrftoken') || ''
    }
});
