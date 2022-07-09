const path = require('path');
const withTM = require('next-transpile-modules')(
    ['react-frappe-charts', 'frappe-charts']
);

module.exports = withTM({
    experimental: {
        scrollRestoration: true,
    },
    sassOptions: {
        includePaths: [path.join(__dirname, 'styles')],
    },
    serverRuntimeConfig: {
        API_KEY: process.env.API_KEY,
        API_SERVER: process.env.PROXY_API_SERVER,
    },
    publicRuntimeConfig: {
        API_SERVER: process.env.PUBLIC_API_SERVER,
        STATIC_SERVER: process.env.PUBLIC_STATIC_SERVER,
        GOOGLE_OAUTH_CLIENT_ID: process.env.PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
        GITHUB_OAUTH_CLIENT_ID: process.env.PUBLIC_GITHUB_OAUTH_CLIENT_ID,
        GOOGLE_ANALYTICS_V4: process.env.PUBLIC_GOOGLE_ANALYTICS_V4,
        MICROSOFT_CLARITY: process.env.PUBLIC_MICROSFT_CLARITY,
        HCAPTCHA_SITE_KEY: process.env.PUBLIC_HCAPTCHA_SITE_KEY,
        GOOGLE_ADSENSE_CLIENT_ID: process.env.PUBLIC_GOOGLE_ADSENESE_CLIENT_ID,
    },
});
