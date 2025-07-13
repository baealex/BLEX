import axios from 'axios';
import { handyCookie } from '@baejino/handy';

export interface Response<T> {
    status: number;
    body: T;
}

export const http = axios.create({
    baseURL: '/',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': handyCookie.get('csrftoken') || '',
    },
});
