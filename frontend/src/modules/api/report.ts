import request, { serializeObject } from './request';

export interface PostReportErrorRequestData {
    user?: string;
    path: string;
    content: string;
}

export async function postReportError(data: PostReportErrorRequestData) {
    return await request<unknown>({
        url: '/v1/report/error',
        method: 'POST',
        data: serializeObject(data)
    });
}
