import { http, type Response } from '~/modules/http.module';

export interface TelegramStatus {
    isConnected: boolean;
    username?: string;
}

/**
 * Check Telegram connection status
 */
export const getTelegramStatus = async () => {
    return http.get<Response<TelegramStatus>>('v1/setting/integration-telegram');
};

/**
 * Generate Telegram authentication token
 */
export const generateTelegramToken = async () => {
    return http.post<Response<{ token: string }>>('v1/telegram/makeToken');
};

/**
 * Disconnect Telegram integration
 */
export const disconnectTelegram = async () => {
    return http.post<Response<{ success: boolean }>>('v1/telegram/unsync');
};
