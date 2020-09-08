class Cookie {
    set(name, value, info) {
        let willCookie = name + '=' + value + ';';
        if (info.expire) {
            let date = new Date();
            date.setTime(date.getTime() + (info.expire * 24 * 60 * 60 * 1000));
            willCookie += 'Expires=' + date.toUTCString() + ';';
        }
        if (info.domain) {
            willCookie += 'Domain=' + info.domain + ';';
        }
        if (info.path) {
            willCookie += 'Path=' + info.path + ';';
        }
        document.cookie = willCookie;
    }

    get(name) {
        let value = document.cookie.match(`(^|;) ?${name}=([^;]*)(;|$)`);
        return value ? value[2] : null;
    }
}

export default new Cookie()