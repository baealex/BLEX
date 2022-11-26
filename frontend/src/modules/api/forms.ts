import request, { serializeObject } from './request';

export interface UserFormModel {
    title: string;
    content: string;
}

export interface CreateUserFormResponseData {
    id: number;
}

export async function createUserForm(data: UserFormModel) {
    return request<CreateUserFormResponseData>({
        url: '/v1/forms',
        method: 'POST',
        data: serializeObject(data)
    });
}

export async function getUserForm(id: number) {
    return request<UserFormModel>({
        url: `/v1/forms/${id}`,
        method: 'GET'
    });
}

export async function updateUserForm(id: number, data: UserFormModel) {
    return request<UserFormModel>({
        url: `/v1/forms/${id}`,
        method: 'PUT',
        data: serializeObject(data)
    });
}

export async function deleteForms(id: number) {
    return request<unknown>({
        url: `/v1/forms/${id}`,
        method: 'DELETE'
    });
}
