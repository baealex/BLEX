import request, { serializeObject } from './request';

export interface PostFormsRequestData {
    title: string;
    content: string;
}

export interface PostFormsResponseData {
    id: number;
}

export async function postForms(data: PostFormsRequestData) {
    return request<PostFormsResponseData>({
        url: '/v1/forms',
        method: 'POST',
        data: serializeObject(data)
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
