import { http } from '~/modules/http.module';

export interface TelegramStatus {
    connected: boolean;
    username?: string;
}

/**
 * Check Telegram connection status
 */
export const getTelegramStatus = async () => {
    return http.get('v1/setting/integration-telegram');
};

/**
 * Generate Telegram authentication token
 */
export const generateTelegramToken = async () => {
    return http.post('v1/telegram/makeToken');
};

/**
 * Disconnect Telegram integration
 */
export const disconnectTelegram = async () => {
    return http.post('v1/telegram/unsync');
};
