export const CONFIG = {
    "API_KEY": "",
    "API_SERVER": typeof window === "undefined"
        ? "http://host.docker.internal:9000"
        : "http://localhost:9000",
    "STATIC_SERVER": "",
    "GOOGLE_OAUTH_CLIENT_ID": "",
    "GITHUB_OAUTH_CLIENT_ID": "",
    "GOOGLE_ANALYTICS_V4": "",
    "MICROSOFT_CLARITY": "",
    "HCAPTCHA_SITE_KEY": "",
    "GOOGLE_ADSENSE_CLIENT_ID": "",
}