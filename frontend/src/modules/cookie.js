class Cookie {
    set(name, value, option) {
        let willCookie = `${name}=${value};`;
        if(option.expire) {
            let date = new Date();
            date.setTime(date.getTime() + (option.expire * 24 * 60 * 60 * 1000));
            willCookie += `Expires=${date.toUTCString()};`;
        }
        if(option.domain) {
            willCookie += `Domain=${option.domain};`;
        }
        if(option.path) {
            willCookie += `Path=${option.path};`;
        }
        document.cookie = willCookie;
    }

    get(name) {
        let value = document.cookie.match(`(^|;) ?${name}=([^;]*)(;|$)`);
        return value ? value[2] : null;
    }
}

export default new Cookie()