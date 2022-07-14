import request, { serializeObject } from './index';

export interface PostFormsResponseData {
    id: number;
}

export async function postForms(title: string, content: string) {
    return request<PostFormsResponseData>({
        url: '/v1/forms',
        method: 'POST',
        data: serializeObject({
            title,
            content
        })
    });
}

export async function deleteForms(id: number) {
    return request<unknown>({
        url: `/v1/forms/${id}`,
        method: 'DELETE'
    });
}

export async function getForm(id: number) {
    return request<GetFormResponseData>({
        url: `/v1/forms/${id}`,
        method: 'GET'
    });
}

export interface GetFormResponseData {
    title: string;
    content: string;
}