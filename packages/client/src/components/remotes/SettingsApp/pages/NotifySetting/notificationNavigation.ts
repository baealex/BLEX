const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Validate stored notification destinations before assigning browser location.
 * Legacy records remain readable, but executable schemes are never navigated.
 */
export const getSafeNotificationNavigationUrl = (
    url: string,
    baseUrl: string
): string | null => {
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
