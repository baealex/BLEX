import { http, type Response } from '~/modules/http.module';

export interface Webhook {
    id: number;
    name: string;
    url: string;
    provider: string;
    events: string[];
    isActive: boolean;
    secret?: string;
    createdDate: string;
    updatedDate: string;
}

export interface WebhookEvent {
    value: string;
    description: string;
}

export interface WebhookProvider {
    value: string;
    description: string;
}

export interface WebhookLog {
    id: number;
    event: string;
    statusCode: number | null;
    error: string;
    retryCount: number;
    createdDate: string;
}

export interface WebhooksResponse {
    webhooks: Webhook[];
    total: number;
    hasNext: boolean;
}

export interface WebhookEventsResponse {
    events: WebhookEvent[];
    providers: WebhookProvider[];
}

export interface WebhookLogsResponse {
    logs: WebhookLog[];
    total: number;
    hasNext: boolean;
}

/**
 * Get list of webhooks
 */
export const getWebhooks = async (page = 1) => {
    return http.get<Response<WebhooksResponse>>(`v1/developer/webhooks?page=${page}`);
};

/**
 * Get webhook events and providers info
 */
export const getWebhookEvents = async () => {
    return http.get<Response<WebhookEventsResponse>>('v1/developer/webhook-events');
};

/**
 * Get webhook details
 */
export const getWebhook = async (webhookId: number) => {
    return http.get<Response<Webhook>>(`v1/developer/webhooks/${webhookId}`);
};

/**
 * Create new webhook
 */
export const createWebhook = async (data: {
    name: string;
    url: string;
    provider: string;
    events: string[];
    isActive: boolean;
    secret?: string;
}) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('url', data.url);
    formData.append('provider', data.provider);
    data.events.forEach(event => formData.append('events', event));
    formData.append('is_active', data.isActive.toString());
    if (data.secret) {
        formData.append('secret', data.secret);
    }

    return http.post<Response<{ id: number; message: string }>>('v1/developer/webhooks', formData);
};

/**
 * Update webhook
 */
export const updateWebhook = async (webhookId: number, data: {
    name?: string;
    url?: string;
    provider?: string;
    events?: string[];
    isActive?: boolean;
    secret?: string;
}) => {
    return http.put<Response<{ id: number; message: string }>>(`v1/developer/webhooks/${webhookId}`, data);
};

/**
 * Delete webhook
 */
export const deleteWebhook = async (webhookId: number) => {
    return http.delete<Response<{ message: string }>>(`v1/developer/webhooks/${webhookId}`);
};

/**
 * Test webhook
 */
export const testWebhook = async (webhookId: number) => {
    return http.post<Response<{ message: string }>>(`v1/developer/webhooks/${webhookId}/test`);
};

/**
 * Get webhook logs
 */
export const getWebhookLogs = async (webhookId: number, page = 1) => {
    return http.get<Response<WebhookLogsResponse>>(`v1/developer/webhooks/${webhookId}/logs?page=${page}`);
};
