const fs = require('fs');

const {
    API_KEY = '',
    API_SERVER = 'http://localhost:20202',
    STATIC_SERVER = '',
    GOOGLE_OAUTH_CLIENT_ID = '',
    GITHUB_OAUTH_CLIENT_ID = '',
    GOOGLE_ANALYTICS_V4 = '',
    MICROSOFT_CLARITY = '',
    HCAPTCHA_SITE_KEY = '',
    GOOGLE_ADSENSE_CLIENT_ID = '',
} = process.env;

fs.writeFileSync('modules/settings.ts',
`export const CONFIG = {
    "API_KEY": "${API_KEY}",
    "API_SERVER": "${API_SERVER}",
    "STATIC_SERVER": "${STATIC_SERVER}",
    "GOOGLE_OAUTH_CLIENT_ID": "${GOOGLE_OAUTH_CLIENT_ID}",
    "GITHUB_OAUTH_CLIENT_ID": "${GITHUB_OAUTH_CLIENT_ID}",
    "GOOGLE_ANALYTICS_V4": "${GOOGLE_ANALYTICS_V4}",
    "MICROSOFT_CLARITY": "${MICROSOFT_CLARITY}",
    "HCAPTCHA_SITE_KEY": "${HCAPTCHA_SITE_KEY}",
    "GOOGLE_ADSENSE_CLIENT_ID": "${GOOGLE_ADSENSE_CLIENT_ID}",
}`)