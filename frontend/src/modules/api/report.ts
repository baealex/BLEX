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

export interface PostReportArticleRequestData {
    url: string;
    content: string;
}

export async function postReportArticle(data: PostReportArticleRequestData) {
    return await request<unknown>({
        url: `/v1/report/article/${data.url}`,
        method: 'POST',
        data: serializeObject({ content: data.content })
    });
}
