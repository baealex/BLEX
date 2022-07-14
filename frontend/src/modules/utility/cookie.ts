interface CookieOption {
    expire?: number;
    domain?: string;
    path?: string;
}

function createCookie(name: string, value: string, {
    expire,
    domain,
    path
}: CookieOption) {
    let cookie = `${name}=${value};`;
    if (expire) {
        const date = new Date();
        date.setTime(date.getTime() + (expire * 24 * 60 * 60 * 1000));
        cookie += `Expires=${date.toUTCString()};`;
    }
    if (domain) {
        cookie += `Domain=${domain};`;
    }
    if (path) {
        cookie += `Path=${path};`;
    }
    return cookie;
}

export function setCookie(name: string, value: string, options: CookieOption) {
    document.cookie = createCookie(name, value, options);
}

export function getCookie(name: string) {
    const value = document.cookie.match(`(^|;) ?${name}=([^;]*)(;|$)`);
    return value ? value[2] : null;
}
