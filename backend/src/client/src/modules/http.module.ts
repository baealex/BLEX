import axios from 'axios';
import { handyCookie } from '@baejino/handy';

export const http = axios.create({
    baseURL: '/',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': handyCookie.get('csrftoken') || '',
    },
});
