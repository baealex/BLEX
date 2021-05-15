import axios from 'axios';

axios.defaults.withCredentials = true;

import Config from '../config.json';

import { ResponseData } from './';

export async function postTelegram(parameter: 'unsync' | 'makeToken') {
    return await axios.request<ResponseData<PostTelegramData>>({
        url: `${Config.API_SERVER}/v1/telegram/${parameter}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        withCredentials: true,
    });
}

interface PostTelegramData {
    token?: string;
}