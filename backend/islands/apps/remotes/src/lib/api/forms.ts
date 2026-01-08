import { http, type Response } from '../http.module';

export interface Form {
    id: number;
    title: string;
    description: string;
    fields: FormField[];
    created_date: string;
    updated_date: string;
}

export interface FormField {
    name: string;
    type: string;
    label: string;
    required: boolean;
    options?: string[];
}

export interface CreateFormData {
    title: string;
    content: string;
}

export interface UpdateFormData {
    title?: string;
    content?: string;
}

interface FormsListResponse {
    forms: Form[];
}

interface FormDetailResponse {
    id: number;
    title: string;
    content?: string;
}

interface FormActionResponse {
    success: boolean;
}

export const getForms = async () => {
    return http.get<Response<FormsListResponse>>('/v1/forms');
};

export const getForm = async (formId: number) => {
    return http.get<Response<FormDetailResponse>>(`/v1/forms/${formId}`);
};

export const createForm = async (data: CreateFormData) => {
    return http.post<Response<FormActionResponse>>('/v1/forms', data);
};

export const updateForm = async (formId: number, data: UpdateFormData) => {
    return http.put<Response<FormActionResponse>>(`/v1/forms/${formId}`, data);
};

export const deleteForm = async (formId: number) => {
    return http.delete<Response<FormActionResponse>>(`/v1/forms/${formId}`);
};
