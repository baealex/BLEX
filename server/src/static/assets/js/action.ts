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
        this.el.insertAdjacentHTML("beforeend", h);
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

/* Actions */

var Posts = (function() {
    var url = '/api/v1/posts';
    var isWait = false;

    return {
        like: function(pk) {
            if(isWait) {
                Notify.append('잠시 후 다시 사용할 수 있습니다.');
                return;
            }
            $.ajax({
                url: `${url}/${pk}`,
                type: 'PUT',
                data: {like: 'like'},
            }).done(function (data) {
                if(data=='error:NL') {
                    Notify.append(msg.login);
                }
                else if(data=='error:SU') {
                    Notify.append('자신의 글은 추천할 수 없습니다.');
                }
                else {
                    isWait = true;
                    setTimeout(function() {
                        isWait = false;
                    }, 1000 * 60);
                    var heart = select('#heart i');
                    if(heart.hasClass('fas')) {
                        heart.removeClass('fas');
                        heart.addClass('far');
                    } else {
                        heart.removeClass('far');
                        heart.addClass('fas');
                    }
                    select('#like-count').text(data);
                }
            });
        },
        remove: function(pk) {
            if(confirm('정말 삭제하십니까?')){
                $.ajax({
                    url: `${url}/${pk}`,
                    type: 'DELETE',
                }).done(function (data) {
                    if(document.getElementById(`item-${pk}`)) {
                        Notify.append('포스트가 정상적으로 삭제되었습니다.');
                        select('#item-' + pk).remove();
                    } else {
                        Notify.append('포스트가 정상적으로 삭제되었습니다.');
                    }
                });
            }
        },
        lock: function(pk) {
            $.ajax({
                url: `/api/v1/posts/${pk}`,
                type: "PUT",
                data: {hide: 'changed'}
            }).done(function(data) {
                var lock = select(`#item-${pk} .element-lock i`);
                if(data.hide) {
                    lock.removeClass('fa-lock-open');
                    lock.addClass('fa-lock');
                    Notify.append('포스트가 숨겨집니다.');
                } else {
                    lock.removeClass('fa-lock');
                    lock.addClass('fa-lock-open');
                    Notify.append('포스트가 공개됩니다.');
                }
            });
        },
        changeTag: function(pk) {
            if($(`#item-${pk} form`).find('[name=tag]').val() == '') {
                Notify.append('태그를 비워둔 상태로 변경할 수 없습니다.');
                return;
            }
            $.ajax({
                url: `/api/v1/posts/${pk}`,
                type: "PUT",
                data: $(`#item-${pk} form`).serialize(),
            }).done(function(data) {
                Notify.append('태그가 변경되었습니다.');
                $(`#item-${pk} form`).find('[name=tag]').val(data.tag);
            });
        },
    }
})();
var Comment = (function() {
    var url = '/api/v1/comments';
    var tempResource = '';
    var isWait = false;
    const render = (element) => {
        const component = () => {
            return `
            <div class="comment-list s-shadow">
                <div class="back-image thumb comment-thumb" style="background-image:url(${element.thumbnail})"></div>
                <a class="font-weight-bold deep-dark">${element.author}</a>
                <br>
                <small>${element.created_date}전 <span class="vs">${element.edited}</span></small>
                <ul class="none-list">
                    <li><a class="vs shallow-dark" href="javascript:void(0)" onclick="Comment.edit(${element.pk})">수정</a></li>
                    <li><a class="vs shallow-dark" href="javascript:void(0)" onclick="Comment.remove(${element.pk});">삭제</a></li>
                </ul>
                <div class="mt-4 comment-content">${element.content}</div>
                <ul class="none-list">
                    <li>
                        <a class="shallow-dark" href="javascript:void(0);" onclick="Comment.like(${element.pk})">
                            <i class="fas fa-angle-up"></i> <span id="clc${element.pk}">${element.total_likes}</span>
                        </a>
                    </li>
                </ul>
            </div>`;
        };
        return component();
    };

    var uploadImage = function(formData) {
        var cursorPos = $('#id_text_md').prop('selectionStart');
        var text = $('#id_text_md').val();
        var textBefore = text.substring(0,  cursorPos);
        var textAfter  = text.substring(cursorPos, text.length);

        $('#id_text_md').val(textBefore + '[Image Upload...]()' + textAfter);
        text = $('#id_text_md').val();

        $.ajax({
            url: '/upload/image',
            type: 'POST',
            data: formData,
            contentType: false,
            cache: false,
            processData: false,
        }).done(function (data) {
            var result = '';
            if(data.includes('.mp4')) {
                result = `@gif[${data}]`;
            } else {
                result = `![](${data})`;
            }
            $('#id_text_md').val(text.replace('[Image Upload...]()', result));
        }).fail(function () {
            Notify.append('이미지 업로드에 실패했습니다.');
        });
    };

    if(select('#comment-form #id_text_md').exist()) {
        select('#comment-form #id_text_md').on("drop", async function(e) {
            e.stopPropagation();
            e.preventDefault();
            e.dataTransfer = e.originalEvent.dataTransfer;
            var files = e.target.files || e.dataTransfer.files;
            if(files.length > 1) {
                Notify.append('하나씩 업로드 할 수 있습니다.');
                return;
            }
            if(!files[0].type.match(/image.*/)) {
                Notify.append('이미지 파일이 아닙니다.');
                return;
            }
            var formData = new FormData();
            formData.append('image', files[0]);
            await uploadImage(formData);
        });
    }

    return {
        reload: function(element) {
            select(`#comment-${element.pk}`).html(render(element));
            safeExternal('#comment a');
        },
        write: function(fk) {
            if($('#id_text').val() == '') {
                Notify.append('댓글의 내용을 작성해주세요!');
                return;
            }
            $.ajax({
                url: `${url}?fk=${fk}`,
                type: 'POST',
                data: $('#comment-form').serialize(),
            }).done(function(data) {
                if(data.state == 'true') {
                    select('#comment').append(`<div id='comment-${data.element.pk}'>${render(data.element)}</div>`);
                    if(document.getElementById('comment-empty')) {
                        select('#comment-empty').remove();
                    }
                    select('#comment-form textarea').val('');
                    safeExternal('#comment a');
                }
            });
        },
        remove: function(pk) {
            if (confirm('댓글을 정말 삭제합니까?')) {
                $.ajax({
                    url: `${url}/${pk}`,
                    type: 'DELETE',
                }).done(function(data) {
                    select(`#comment-${data.pk}`).remove();
                    Notify.append('댓글이 삭제되었습니다.');
                });
            } else {
                return;
            }
        },
        edit: function(pk) {
            $.ajax({
                url: `${url}/${pk}?get=form`,
                type: 'GET',
            }).done(function(data) {
                tempResource = $(`#comment-${pk}`).html();
                select(`#comment-${pk}`).html(data);
            });
        },
        like: function(pk) {
            if(isWait) {
                Notify.append('잠시 후 다시 사용할 수 있습니다.');
                return;
            }
            $.ajax({
                url: `${url}/${pk}`,
                type: 'PUT',
                data: {like: 'like'},
            }).done(function(data) {
                if(data=='error:NL') {
                    Notify.append(msg.login);
                }
                else if(data=='error:SU') {
                    Notify.append('자신의 댓글은 추천할 수 없습니다.')
                }
                else {
                    isWait = true;
                    setTimeout(function() {
                        isWait = false;
                    }, 1000 * 60);
                    $(`#clc${pk}`).html(data);
                }
            });
        },
        update: function(pk) {
            $.ajax({
                url: `${url}/${pk}`,
                type: 'PUT',
                data: $(`#comment-${pk}-form`).serialize(),
            }).done(function(data) {
                if(data.state == 'true') {
                    Comment.reload(data.element);
                }
            });
        },
        editCancle: function(pk) {
            select(`#comment-${pk}`).html(tempResource);
            tempResource = '';
        }
    }
})();
var Series = (function() {
    var url = '/api/v1/series';
    return {
        edit: function(pk) {
            if (!document.getElementById('series-modal')) {
                $.ajax({
                    url: `${url}/${pk}?get=modal`,
                    type: 'GET',
                }).done(function (data) {
                    $('body').append(data);
                    $('#series-modal').modal('show');
                });
            }
            else {
                $('#series-modal').modal('show');
            }
        },
        remove: function(pk) {
            if(confirm('정말 삭제하십니까?')) {
                $.ajax({
                    url: `${url}/${pk}`,
                    type: 'DELETE',
                }).done(function(data) {
                    if(data == 'DONE') {
                        alert('시리즈가 삭제되었습니다.')
                        location.href = '/';
                    }
                });
            }
        }
    }
})();
var Notify = (function() {
    const render = (element) => {
        const component = () => {
            return `
            <div id="pretoast${element.pk}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <img src="https://static.blex.me/assets/images/logo.png" class="rounded mr-2" width="20px">
                    <strong class="mr-auto">알림</strong>
                    <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="toast-body">
                    ${element.info}
                </div>
            </div>`;
        }
        return component();
    }
    var url = '/api/v1/users';
    var counter = 0;
    return {
        append: function(info) {
            var pk = counter++;
            $('#notify-content').append(
                render({
                    pk: pk,
                    info: info
                })
            );
            $('.toast').toast({
                'delay': 4000,
            });
            $('.toast').toast('show');
            setTimeout(function() {
                select(`#pretoast${pk}`).remove();
            }, 4000);
        },
        read: (username: string, pk: number) => {
            $.ajax({
                url: `${url}/${username}`,
                type: 'GET',
                data: {
                    'get': 'notify',
                    'id': pk,
                },
            }).done(() => {
                select(`#toast${pk}`).remove();
            });
        },
        go: function(username, pk) {
            $.ajax({
                url: `${url}/${username}`,
                type: 'GET',
                data: {
                    'get': 'notify',
                    'id': pk,
                },
            }).done(function(data) {
                location.href = data;
            });
        }
    }
})();
var Telegram = (function() {
    var url = '/api/v1/telegram';
    return {
        pair: function() {
            $.ajax({
                url: url + '/makeToken',
                type: 'POST',
            }).done(function(data) {
                select(`#telegram-token`).text(data);
            });
        },
        unpair: function() {
            $.ajax({
                url: url + '/unpair',
                type: 'POST',
            }).done(function(data) {
                location.reload();
            });
        }
    }
})();
var User = (function() {
    var url = '/api/v1/users';
    return {
        activity: function(username) {
            $.ajax({
                url: `${url}/${username}`,
                type: 'GET',
                data: {get: 'activity'},
            }).done(function(data) {
                let count = 0;
                for(let key in data.data) {
                    count += Number(data.data[key]);
                }
                let option = {
                    type: 'heatmap',
                    title: count + ' activity in the last year',
                    data: {
                        dataPoints: data.data,
                    },
                    width: 800,
                    countLabel: 'Activity',
                    discreteDomains: 0,
                }
                if(select('body').hasClass('dark')) {
                    option['colors'] = ['#14120f', '#391b74', '#843690', '#dc65c4', '#e69ed8'];
                }
                new frappe.Chart("#heatmap", option);
            });
        },
        follow: function(username) {
            $.ajax({
                url: `${url}/${username}`,
                type: 'PUT',
                data: {follow: 'follow'},
            }).done(function(data) {
                if(data=='error:NL') {
                    Notify.append(msg.login);
                }
                else if(data=='error:SU') {
                    Notify.append('자신은 구독할 수 없습니다.');
                }
                else {
                    select('#user-follow').text(data);
                }
            });
        },
        editAbout: function(username) {
            if(select('#no-about').exist()) {
                select('#no-about').remove();
            }
            if(select('#aboutButton').hasClass('edit')) {
                $.ajax({
                    method: 'GET',
                    url: `/api/v1/users/${username}?get=about-form`,
                }).done(function (data) {
                    select('#about').html(data);
                    var btn = select('#aboutButton');
                    btn.text('완료');
                    btn.addClass('submit');
                    btn.removeClass('edit');
                });
            } else {
                $.ajax({
                    method: 'PUT',
                    url: `/api/v1/users/${username}`,
                    data: $('form').serialize()
                }).done(function (data) {
                    select('#about').html(data);
                    var btn = select('#aboutButton');
                    btn.text('편집');
                    btn.addClass('edit');
                    btn.removeClass('submit');
                });
            }
        },
        appendTag: function(username) {
            let textValue = $('#id_text_md').val();
            $('#id_text_md').val(textValue + (`\`@${username}\` `)).focus();
        }
    }
})();
var Analytics = (function() {
    var url = '/api/v1/users';
    const renderModal = (elements, pk) => {
        const component = () => {
            const refererList = elements.map(function(element) {
                return `<li class="list-group-item">${element.time} - <a class="shallow-dark" href="${element.from}">${element.from}</a></li>`
            });
            return `
            <div class="modal fade noto" id="item-${pk}-detail" tabindex="-1" role="dialog" aria-hidden="true">
                <div class="modal-dialog modal-lg" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title noto">동향 분석</h5>
                            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div id="chart-${pk}" style="width:100%; height:500px;"></div>
                            <ul class="list-group list-group-flush">
                                ${refererList.join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }
        return component();
    }
    return {
        modal: function(username, type, pk) {
            if(document.getElementById(`item-${pk}-detail`)) {
                $(`#item-${pk}-detail`).modal('show');
            } else {
                $.ajax({
                    url: `${url}/${username}?get=${type}&pk=${pk}`,
                    type: 'GET',
                }).done(function(data) {
                    data.items.reverse();
                    
                    $('body').append(renderModal(data.referers, pk));
                    $(`#item-${pk}-detail`).modal('show');

                    am4core.ready(function () {
                        select('body').hasClass('dark') ? am4core.useTheme(am4themes_dark) : am4core.useTheme(am4themes_dataviz);
                        
                        var chart = am4core.create(`chart-${pk}`, am4charts.XYChart);
                        
                        chart.data = data.items;
                        chart.dateFormatter.inputDateFormat = "yyyy-MM-dd";
                        
                        var dateAxis = chart.xAxes.push(new am4charts.DateAxis());
                        var valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
                        
                        var series = chart.series.push(new am4charts.LineSeries());
                        series.dataFields.valueY = "count";
                        series.dataFields.dateX = "date";
                        series.tooltipText = "{count}"
                        series.strokeWidth = 2;
                        series.minBulletDistance = 15;
                
                        series.tooltip.background.cornerRadius = 20;
                        series.tooltip.background.strokeOpacity = 0;
                        series.tooltip.pointerOrientation = "vertical";
                        series.tooltip.label.minWidth = 40;
                        series.tooltip.label.minHeight = 40;
                        series.tooltip.label.textAlign = "middle";
                        series.tooltip.label.textValign = "middle";
                
                        var bullet = series.bullets.push(new am4charts.CircleBullet());
                        bullet.circle.strokeWidth = 2;
                        bullet.circle.radius = 4;
                        bullet.circle.fill = am4core.color("#fff");
                
                        var bullethover = bullet.states.create("hover");
                        bullethover.properties.scale = 1.3;
                
                        chart.cursor = new am4charts.XYCursor();
                        chart.cursor.behavior = "panXY";
                        chart.cursor.xAxis = dateAxis;
                        chart.cursor.snapToSeries = series;
                
                        chart.scrollbarX = new am4charts.XYChartScrollbar();
                        chart.scrollbarX.series.push(series);
                        chart.scrollbarX.parent = chart.bottomAxesContainer;
                
                        dateAxis.start = 0.5;
                        dateAxis.keepSelection = true;
                    });

                    safeExternal(`#item-${pk}-detail a`);
                });
            }
        },
    }
})();

$('#id_avatar').on('change',function() {
    var fileName = $(this).val();
    $(this).next('.custom-file-label').html(fileName);
});

$('#id_image').on('change', function() {
    var fileName = $(this).val();
    $(this).next('.custom-file-label').html(fileName);
});

$('.gp').on('click', function() {
    location.href='?page=' + $('.pn').val();
});

$('.pn').on('submit', function() {
    location.href='?page=' + $('.pn').val();
});

$('#idButton').on('click', function() {
    if($('#id_username').val() != '') {
        $.ajax({
            url: '/signup/help/id',
            type: 'POST',
            data: { 'id': $('#id_username').val() },
        }).done(function(data) {
            $('#idCheck').addClass('alert');
            if(data == 'ERROR:OL') {
                $('#idCheck').removeClass('alert-success');
                $('#idCheck').addClass('alert-danger');
                $('#idCheck').text('이미 사용중인 필명입니다!');
                if(document.getElementById('idButton')) {
                    var idButton = $('#idButton');
                    idButton.text('아이디 확인');
                    idButton.prop('type', 'button');
                }
            } else if(data == 'ERROR:NM') {
                $('#idCheck').removeClass('alert-success');
                $('#idCheck').addClass('alert-danger');
                $('#idCheck').text('소문자와 숫자로만 구성할 수 있습니다!');
                if(document.getElementById('idButton')) {
                    var idButton = $('#idButton');
                    idButton.text('아이디 확인');
                    idButton.prop('type', 'button');
                }
            } else {
                $('#idCheck').removeClass('alert-danger');
                $('#idCheck').addClass('alert-success');
                $('#idCheck').text(window.location.protocol + '//' + window.location.hostname + '/@' + $('#id_username').val());
                if(document.getElementById('idButton')) {
                    var idButton = $('#idButton');
                    idButton.text('아이디 사용');
                    idButton.prop('type', 'submit');
                    $('#id_username').on('propertychange change keyup paste input', function() {
                        var idButton = $('#idButton');
                        idButton.text('아이디 확인');
                        idButton.prop('type', 'button');
                    });
                }
            }
        });
    }
});

$('#signup input').on('focusout', function(){
    if(select('#id_username').val() != '') {
        $.ajax({
            url: '/signup/help/id',
            type: 'POST',
            data: {id: select('#id_username').val()},
        }).done(data => {
            select('#idCheck').addClass('alert');
            if(data == 'ERROR:OL') {
                select('#idCheck').swapClass('alert-success', 'alert-danger');
                select('#idCheck').text('이미 사용중인 필명입니다!');
            } else if(data == 'ERROR:NM') {
                select('#idCheck').swapClass('alert-success', 'alert-danger');
                select('#idCheck').text('소문자와 숫자로만 구성할 수 있습니다!');
            } else {
                select('#idCheck').swapClass('alert-danger', 'alert-success');
                select('#idCheck').text(window.location.protocol + '//' + window.location.hostname + '/@' + select('#id_username').val());
                if(select('#idButton').exist()) {
                    var idButton = $('#idButton');
                    idButton.text('완료');
                    idButton.prop('type', 'submit');
                }
            }
        });
    }
});

$('#github-login').on('click', function() {
    var url = '';
    url += 'https://github.com/login/oauth/authorize';
    url += '?client_id=c5b001b86e3e77f2af1f';
    url += '&redirect_uri=' + window.location.protocol + '//' + window.location.hostname + '/login/callback/github';
    location.href = url;
});

if(select('.profile-tab').exist()) {
    let runOnce = true;
    $('.profile-tab li').on('click', function() {
        let href = $(this).data('href');
        let option = {
            callback: undefined,
        };
        if(runOnce && $(this).text() === '개요') {
            option.callback = function() {
                let username = href.split('/@')[1];
                User.activity(username);
            }
            runOnce = false;
        }
        changing('content', href, option);
        history.pushState({}, href, href);
        $('.profile-tab li').each(function(index, item) {
            $(item).removeClass('active');
        });
        $(this).addClass('active');
    });

    $(window).on('popstate', function(event) {
        window.location = document.location.href;
    });
}

$('#google-login').on('click', function() {
    var url = '';
    url += 'https://accounts.google.com/o/oauth2/auth';
    url += '?client_id=230716131865-ann8gcfd9b3oq3d6funkkb5r8k1d9d3o.apps.googleusercontent.com';
    url += '&redirect_uri=' + window.location.protocol + '//' + window.location.hostname + '/login/callback/google';
    url += '&response_type=code';
    url += '&scope=openid profile email'
    url += '&approval_prompt=force'
    url += '&access_type=offline'
    location.href = url;
});

var threadEvent = function() {
    var className = ['.closer', '.thread-sidebar', 'body'];
    let menu = select('.menu').direct();

    function isClosed() {
        return $('.closer').hasClass('closed');
    }

    function sidebarClose() {
        $('.closer').html('<i class="fas fa-chevron-right"></i>');
        for(var i=0; i<className.length; i++) {
            $(className[i]).addClass('closed');
        }
        menu.style.display = 'none';
        select('.menu').swapClass('on', 'off');
        select('.side-menu').swapClass('on', 'off');
        select('.menu img').direct().src = 'https://static.blex.me/assets/images/logo.png';
    }

    function sidebarOpen() {
        $('.closer').html('<i class="fas fa-chevron-left"></i>');
        for(var i=0; i<className.length; i++) {
            $(className[i]).removeClass('closed');
        }
        menu.style.display = 'block';
    }

    $('.story-read').on('click', function() {
        var href = $(this).data('href');
        let option = {
            moveTop: true,
        };
        changing('content', href, option);
        history.pushState({}, href, href);
        $('.story-read').each(function(index, item) {
            $(item).removeClass('active');
        });
        $(this).addClass('active');

        if($(window).width() < 700) {
            sidebarClose();
        }
    });
    
    $(window).on('popstate', function(event) {
        window.location = document.location.href;
    });
    
    $('.closer').on('click', function() {
        if(isClosed()) {
            sidebarOpen();
        } else {
            sidebarClose();
        }
    });

    $(document).ready(function() {
        if($(window).width() < 700) {
            sidebarClose();
        }
        safeExternal('#content a');
    });
};

class WriteEvent {
    private state: any;

    private render() {
        const component = () => {
            let list = this.state.result.map((element) => {
                return `
                <li>
                    <a href="/write?token=${element.token}">
                        ${element.title} (${element.date} 전)
                    </a>
                </li>`;
            });

            return `
            <div class="full-mask blurring write-closer">
                <div class="center-list">
                    <ul class="serif">
                        ${list.join('')}
                        <li><a href="/write">새 글 쓰기</a></li>
                        <li><a class="write-closer" href="javascript:void(0);">닫기</a></li>
                    </ul>
                </div>
            </div>`;
        };

        select('#write-selector').html(component());
        select('.write-closer').on('click', () => {
            select('#write-selector').html('');
        });
    }

    constructor() {
        $('#write-btn').on('click', () => {
            if(this.state === undefined) {
                $.ajax({
                    url: '/api/v1/posts/temp',
                    type: 'GET',
                    data: { get: 'list'} ,
                }).done((data) => {
                    this.state = data;
                    this.render();
                });
            } else {
                this.render();
            }
        });
    }
}

(function() {
    document.addEventListener("DOMContentLoaded", function() {
        lazy.image();
        lazy.video(); 
    });

    if(select('.menu').exist()) {
        select('.menu').on('click', () => {
            let menuImage = select('.menu img').direct();
            menuImage.style.opacity = '1';
            let sideMenu = select('.side-menu').direct();
        
            if(select('.menu').hasClass('off')) {
                menuImage.src = 'https://static.blex.me/assets/images/logor.png';
                select('.menu').swapClass('off', 'on');
                select('.side-menu').swapClass('off', 'on');
                sideMenu.style.borderRadius = '0';
            } else {
                menuImage.src = 'https://static.blex.me/assets/images/logo.png';
                select('.menu').swapClass('on', 'off');
                select('.side-menu').swapClass('on', 'off');
                sideMenu.removeAttribute('style');
            }
        });
    }

    if(select('#write-btn').exist()) {
        new WriteEvent();
    }

    // 스레드 활성화 이벤트
    if(select('#thread-detail').exist()) {
        threadEvent();
    } else {
        let preScreenPosition = 0;
        let menuImage = select('.menu img').direct();
        window.addEventListener('scroll', () => {
            if(select('.menu').hasClass('off')) {
                let screenPosition = window.pageYOffset;
                if(preScreenPosition > screenPosition) {
                    menuImage.style.opacity = '1';
                } else {
                    menuImage.style.opacity = '0.1';
                }
                preScreenPosition = screenPosition;
            }
        });
    }
})();