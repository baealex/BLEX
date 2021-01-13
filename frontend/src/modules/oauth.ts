import Cookie from '@modules/cookie';
import Config from '@modules/config.json';

export function oauth(social: 'google' | 'github') {
    Cookie.set('oauth_redirect', location.href, {
        path: '/',
        expire: 0.1,
    });
    let url = '';
    switch(social) {
        case 'google':
            url += 'https://accounts.google.com/o/oauth2/auth';
            url += `?client_id=${Config.GOOGLE_OAUTH_CLIENT_ID}.apps.googleusercontent.com`;
            url += `&redirect_uri=${window.location.protocol}//${window.location.hostname}/login/callback/google`;
            url += '&response_type=code';
            url += '&scope=openid profile email'
            url += '&approval_prompt=force'
            url += '&access_type=offline'
            break;
        case 'github':
            url += 'https://github.com/login/oauth/authorize';
            url += `?client_id=${Config.GITHUB_OAUTH_CLIENT_ID}`;
            url += `&redirect_uri=${window.location.protocol}//${window.location.hostname}/login/callback/github`;
            break;
    }
    location.href = url;
}