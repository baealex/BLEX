/* LexQuery */

class Item {
    private el: HTMLInputElement;
    
    constructor(q: string) {
        this.el = document.querySelector(q);
    }

    on(e: string, f: any): void {
        this.el.addEventListener(e, f);
    }
    
    html(h: string): void {
        this.el.innerHTML = h;
    }

    text(t: string): void {
        this.el.textContent = t;
    }

    val(v?: string): string {
        if(v !== undefined) {
            this.el.value = v;
        }
        return this.el.value;
    }

    addClass(c: string): void {
        this.el.classList.add(c);
    }

    hasClass(c: string): boolean {
        return this.el.classList.contains(c);
    }

    removeClass(c: string): void {
        this.el.classList.remove(c);
    }
    
    swapClass(rm: string, add: string): void {
        this.el.classList.remove(rm);
        this.el.classList.add(add);
    }

    remove(): void {
        this.el.remove();
    }

    append(h: string): void {
        this.el.insertAdjacentHTML("afterend", h);
    }

    prepend(h: string): void {
        this.el.insertAdjacentHTML("afterbegin", h);
    }

    attr(a: string, v?: string): string {
        if(v !== undefined) {
            this.el.setAttribute(a, v);
        }
        return this.el.getAttribute(a);
    }

    href(): string {
        return this.attr('href');
    }

    direct(): HTMLInputElement {
        return this.el;
    }

    exist(): boolean {
        if(this.el) {
            return true;
        }
        return false;
    }
}

class Items {
    private els: NodeListOf<Element>;

    constructor(q: string) {
        this.els = document.querySelectorAll(q);
    }

    on(e: string, f: any): void {
        this.els.forEach((el) => {
            el.addEventListener(e, f);
        });
    }

    direct(): NodeListOf<Element> {
        return this.els;
    }
}

function select(q) {
    return new Item(q);
}

function selects(q) {
    return new Items(q);
}

/* Common Function */

function safeExternal(query: string, level: string = 'origin'): void {
    selects(query).on('click', function(this: any) {
        if (!this.getAttribute('href').includes('javascript')) {
            this.href = this.getAttribute('href');
            event.preventDefault();
            if (this.href.includes('' + location.host)) {
                location.href = this.href;
            } else {
                location.href = '/external?url=' + encodeURIComponent(this.href) + '&level=' + level;
            }
        }
    });
}

function getRandomInt (min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

function copyToClipboard(val: string): void {
    var t = document.createElement("textarea");
    document.body.appendChild(t);
    t.value = val;
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
}

function night(): void {
    if (select('#night i').hasClass('fa-moon')) {
        select('body').addClass('dark');
        cookie.set('nightmode', 'true', {
            path: '/',
            expire: 365,
        });
        select('#night').html('<i class="fas fa-sun"></i>');
    } else {
        select('body').removeClass('dark');
        cookie.set('nightmode', '', {
            path: '/',
            expire: -1,
        });
        select('#night').html('<i class="fas fa-moon"></i>');
    }
}

function csrfSafeMethod(method: string): boolean {
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

function moveSlide(id: string, space = 15): void {
    window.scrollTo({
        top: window.pageYOffset + select(`#${id}`).direct().getBoundingClientRect().top - space,
        behavior: 'smooth'
    });
}

function loading(isStart): void {
    if (isStart) {
        var number = getRandomInt(0, 3);
        var squre = '';
        switch (number) {
            case 0:
                squre = 'dot-revolution';
                break;
            case 1:
                squre = 'dot-pulse';
                break;
            case 2:
                squre = 'dot-bricks';
                break;
        }
        select('#loading').html(`<div class="full-mask light"><div style="margin: 48vh auto;" class="${squre}"></div></div>`);
    }
    else
        select('#loading').html('');
}

let cacheContent = {
    isReady: true,
};
function changing(id: string, href: string, option?: {moveTop?: boolean, callback?: Function}): void {
    function swap(title: string, content: string) {
        document.title = title;
        $(`#${id}`).html(content);
        lazy.image();
        lazy.video();
        safeExternal('#' + id + ' a');
        option && option.moveTop && window.scrollTo({ top: 0 });
        option && option.callback && option.callback();
    }

    const prevKey = document.location.pathname;
    cacheContent[prevKey] = {
        'title': document.title,
        'content': $(`#${id}`).html(),
    }

    const key = href;
    if(cacheContent[key] !== undefined) {
        swap(
            cacheContent[key].title,
            cacheContent[key].content
        );
    } else {
        if(cacheContent.isReady) {
            $.ajax({
                url: href,
                type: 'GET',
            }).done((data) => {
                swap(
                    $(data).filter('title').text(),
                    $(data).find(`#${id}`).html()
                );
                cacheContent.isReady = true;
            });
            cacheContent.isReady = false;
        }
    }
}

function getParameter(param: string): string {
    let returnValue;
    let url = location.href;
    let parameters = (url.slice(url.indexOf('?') + 1, url.length)).split('&');
    for (let i = 0; i < parameters.length; i++) {
        let name = parameters[i].split('=')[0];
        if (name.toUpperCase() == param.toUpperCase()) {
            returnValue = parameters[i].split('=')[1];
            return decodeURIComponent(returnValue);
        }
    }
}

const cookie = {
    set: function(name: string, value: string, info: {expire?: number, domain?: string, path?: string}): void {
        let willCookie: string = name + '=' + value + ';';
        if (info.expire) {
            let date: Date = new Date();
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
    },
    get: function(name: string): string {
        let value: RegExpMatchArray = document.cookie.match(`(^|;) ?${name}=([^;]*)(;|$)`);
        return value ? value[2] : null;
    }
}

const lazy = {
    image: function(): void {
        let lazyImages = [].slice.call(document.querySelectorAll("img.lazy"));

        if ("IntersectionObserver" in window) {
            let lazyImageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        let lazyImage: any = entry.target;
                        lazyImage.src = lazyImage.dataset.src;
                        lazyImage.classList.remove("lazy");
                        lazyImageObserver.unobserve(lazyImage);
                    }
                });
            });

            lazyImages.forEach((lazyImage) => {
                lazyImageObserver.observe(lazyImage);
            });
        } else {
            // Possibly fall back to a more compatible method here
        }
    },
    video: function(): void {
        var lazyVideos = [].slice.call(document.querySelectorAll("video.lazy"));

        if ("IntersectionObserver" in window) {
            var lazyVideoObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((video: any) => {
                    if (video.isIntersecting) {
                        for (var source in video.target.children) {
                            var videoSource: any = video.target.children[source];
                            if (typeof videoSource.tagName === "string" && videoSource.tagName === "SOURCE") {
                                videoSource.src = videoSource.dataset.src;
                            }
                        }
                        video.target.load();
                        video.target.classList.remove("lazy");
                        lazyVideoObserver.unobserve(video.target);
                    }
                });
            });

            lazyVideos.forEach((lazyVideo) => {
                lazyVideoObserver.observe(lazyVideo);
            });
        }
    }
}

/* Common Message */

const msg = {
    login: `<a class="shallow-dark" href="/login?next=${location.pathname}">로그인</a> 후 이용할 수 있습니다.`,
}