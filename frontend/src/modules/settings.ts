import getConfig from 'next/config';

interface Config {
    API_KEY?: string;
    API_SERVER: string;
    STATIC_SERVER: string;
    GOOGLE_OAUTH_CLIENT_ID: string;
    GITHUB_OAUTH_CLIENT_ID: string;
    GOOGLE_ANALYTICS_V4: string;
    MICROSOFT_CLARITY: string;
    HCAPTCHA_SITE_KEY: string;
    GOOGLE_ADSENSE_CLIENT_ID: string;
}

const {
    publicRuntimeConfig,
    serverRuntimeConfig
} = getConfig();

export const CONFIG: Config = {
    ...publicRuntimeConfig,
    ...serverRuntimeConfig,
};
