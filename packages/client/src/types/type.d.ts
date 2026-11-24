import type { AppLocale } from '../i18n/locale';

declare global {
    interface Window {
        configuration: {
            media: string;
            static: string;
            locale: AppLocale;
            timeZone: string;
            user?: {
                isAuthenticated: 'True';
                username: string;
            };
        };
        NEXT_URL: string;
    }
}
