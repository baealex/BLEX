import axiosRequest, { ResponseData } from './index';

export async function postTelegram(parameter: 'unsync' | 'makeToken') {
    return await axiosRequest<ResponseData<PostTelegramData>>({
        url: `/v1/telegram/${parameter}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
    });
}

interface PostTelegramData {
    token?: string;
}