import axios, {
    ResponseData,
    serializeObject,
} from './index';

export async function postForms(title: string, content: string) {
    return axios.request<ResponseData<PostFormsData>>({
        url: `/v1/forms`,
        method: 'POST',
        data: serializeObject({
            title,
            content,
        })
    })
};

export interface PostFormsData {
    id: number;
}

export async function deleteForms(id: number) {
    return axios.request<ResponseData<any>>({
        url: `/v1/forms/${id}`,
        method: 'DELETE',
    })
};

export async function getForm(id: number) {
    return axios.request<ResponseData<GetFormData>>({
        url: `/v1/forms/${id}`,
        method: 'GET',
    })
}

export interface GetFormData {
    title: string;
    content: string;
}