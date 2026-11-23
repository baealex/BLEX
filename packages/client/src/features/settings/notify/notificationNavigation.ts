const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Rejects executable schemes before navigating to a stored notification destination. */
export const getSafeNotificationNavigationUrl = (url: string, baseUrl: string): string | null => {
    try {
        const normalizedUrl = url.trim();
        const parsedUrl = new URL(normalizedUrl, baseUrl);

        if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
            return null;
        }

        return normalizedUrl;
    } catch {
        return null;
    }
};
