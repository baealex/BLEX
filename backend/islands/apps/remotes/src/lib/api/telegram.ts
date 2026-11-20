import { http, type Response } from '../http.module';

export const TELEGRAM_CONNECT_LINK_QUERY_KEY = ['telegram-connect-link'];

export interface TelegramConnectLink {
    token: string;
    link: string;
    qrCode: string;
}

export interface TelegramStatus {
    isConnected: boolean;
    isConfigured: boolean;
    botUsername: string;
    username?: string;
}

/**
 * Check Telegram connection status
 */
export const getTelegramStatus = async () => {
    return http.get<Response<TelegramStatus>>('v1/setting/integration-telegram');
};

/**
 * Issue a one-time Telegram deep link, its QR code, and the code it carries
 */
export const generateTelegramToken = async () => {
    return http.post<Response<TelegramConnectLink>>('v1/telegram/makeToken');
};

/**
 * Disconnect Telegram integration
 */
export const disconnectTelegram = async () => {
    return http.post<Response<{ success: boolean }>>('v1/telegram/unsync');
};
