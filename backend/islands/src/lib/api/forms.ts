import { http } from '~/modules/http.module';

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
    description: string;
    fields: FormField[];
}

export interface UpdateFormData {
    title?: string;
    description?: string;
    fields?: FormField[];
}

/**
 * Get all user forms
 */
export const getForms = async () => {
    return http.get('/v1/forms');
};

/**
 * Get a specific form
 */
export const getForm = async (formId: number) => {
    return http.get(`/v1/forms/${formId}`);
};

/**
 * Create a new form
 */
export const createForm = async (data: CreateFormData) => {
    return http.post('/v1/forms', data);
};

/**
 * Update a form
 */
export const updateForm = async (formId: number, data: UpdateFormData) => {
    return http.put(`/v1/forms/${formId}`, data);
};

/**
 * Delete a form
 */
export const deleteForm = async (formId: number) => {
    return http.delete(`/v1/forms/${formId}`);
};
