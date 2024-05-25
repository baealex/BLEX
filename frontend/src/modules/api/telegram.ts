import request  from './request';

interface PostTelegramResponseData {
    token?: string;
}

export async function postTelegram(parameter: 'unsync' | 'makeToken') {
    return await request<PostTelegramResponseData>({
        url: `/v1/telegram/${parameter}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
}
