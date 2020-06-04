var item = function (q) {
    this.el = document.querySelector(q);
}

item.prototype.direct = function () {
    return this.el;
}

item.prototype.get = function (a) {
    return this.el.getAttribute(a);
}

item.prototype.on = function(e, f) {
    this.el.addEventListener(e, f);
}

item.prototype.html = function(h) {
    this.el.innerHTML = h;
}

item.prototype.text = function(t) {
    this.el.textContent = t;
}

item.prototype.val = function(t) {
    this.el.value = t;
}

item.prototype.addClass = function (c) {
    this.el.classList.add(c)
}

item.prototype.removeClass = function (c) {
    this.el.classList.remove(c)
}

item.prototype.hasClass = function(c) {
    return this.el.classList.contains(c);
}

item.prototype.remove = function() {
    this.el.remove();
}

item.prototype.prepend = function (h) {
    this.el.insertAdjacentHTML("afterbegin", h);
}

item.prototype.append = function (h) {
    this.el.insertAdjacentHTML("afterend", h);
}

var items = function (q) {
    this.els = document.querySelectorAll(q);
}

items.prototype.get = function () {
    return this.els;
}

items.prototype.on = function (e, f) {
    this.els.forEach(function (el) {
        el.addEventListener(e, f);
    });
}

var urlib = {
    getParameter: function (param) {
        var returnValue;
        var url = location.href;
        var parameters = (url.slice(url.indexOf('?') + 1, url.length)).split('&');
        for (var i = 0; i < parameters.length; i++) {
            var varName = parameters[i].split('=')[0];
            if (varName.toUpperCase() == param.toUpperCase()) {
                returnValue = parameters[i].split('=')[1];
                return decodeURIComponent(returnValue);
            }
        }
    }
}

var cookie = {
    set: function (name, value, info = {}) {
        var willCookie = name + '=' + value + ';';
        if (info.expire) {
            var date = new Date();
            date.setTime(date.getTime() + (info.expire * 24 * 60 * 60 * 1000));
            willCookie += 'Expires=' + date.toGMTString() + ';';
        }
        if (info.domain) {
            willCookie += 'Domain=' + info.domain + ';';
        }
        if (info.path) {
            willCookie += 'Path=' + info.path + ';';
        }
        document.cookie = willCookie;
    },
    get: function (name) {
        var cookieValue = null;
        if (document.cookie && document.cookie != '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = jQuery.trim(cookies[i]);
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
}

var lazy = {
    image: function () {
        var lazyImages = [].slice.call(document.querySelectorAll("img.lazy"));

        if ("IntersectionObserver" in window) {
            let lazyImageObserver = new IntersectionObserver(function (entries, observer) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        let lazyImage = entry.target;
                        lazyImage.src = lazyImage.dataset.src;
                        lazyImage.classList.remove("lazy");
                        lazyImageObserver.unobserve(lazyImage);
                    }
                });
            });

            lazyImages.forEach(function (lazyImage) {
                lazyImageObserver.observe(lazyImage);
            });
        } else {
            // Possibly fall back to a more compatible method here
        }
    },
    video: function () {
        var lazyVideos = [].slice.call(document.querySelectorAll("video.lazy"));

        if ("IntersectionObserver" in window) {
            var lazyVideoObserver = new IntersectionObserver(function (entries, observer) {
                entries.forEach(function (video) {
                    if (video.isIntersecting) {
                        for (var source in video.target.children) {
                            var videoSource = video.target.children[source];
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

            lazyVideos.forEach(function (lazyVideo) {
                lazyVideoObserver.observe(lazyVideo);
            });
        }
    }
}

var safeExternal = function(query, level='origin') {
    new items(query).on('click', function(e) {
        if (!this.href.includes('javascript')) {
            event.preventDefault();
            if (this.href.includes('' + location.host)) {
                location.href = this.href;
            } else {
                location.href = '/external?url=' + encodeURIComponent(this.href) + '&level=' + level;
            }
        }
    });
}

var getRandomInt = function(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

var copyToClipboard = function(val) {
    var t = document.createElement("textarea");
    document.body.appendChild(t);
    t.value = val;
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
}

var night = function() {
    if ($('#night i').hasClass('fa-moon')) {
        $('body').addClass('dark');
        cookie.set('nightmode', 'true', {
            path: '/',
            expire: 365,
        });
        $('#night').html('<i class="fas fa-sun"></i>');
        $('#top-nav').removeClass('bg-rlight');
        $('#top-nav').removeClass('navbar-light');
        $('#top-nav').addClass('bg-rdark');
        $('#top-nav').addClass('navbar-dark');
        $('#top-nav img').attr('src', 'https://static.blex.me/assets/images/logor.png');
    } else {
        $('body').removeClass('dark');
        cookie.set('nightmode', '', {
            path: '/',
            expire: -1,
        });
        $('#night').html('<i class="fas fa-moon"></i>');
        $('#top-nav').removeClass('bg-rdark');
        $('#top-nav').removeClass('navbar-dark');
        $('#top-nav').addClass('bg-rlight');
        $('#top-nav').addClass('navbar-light');
        $('#top-nav img').attr('src', 'https://static.blex.me/assets/images/logo.png');
    }
}

var csrfSafeMethod = function(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

var moveSlide = function(target, margin = 80) {
    $('html, body').animate({ scrollTop: $('#' + target).offset().top - margin }, 500);
}

var loading = function(isStart) {
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
        $('#loading').html(`<div class="full-mask light"><div style="margin: 48vh auto;" class="${squre}"></div></div>`);
    }
    else
        $('#loading').html('');
}

var changing = function(id, href) {
    $.ajax({
        url: href,
        type: 'GET',
    }).done(function (data) {
        $('#' + id).html($(data).find('#' + id).html());
        document.title = $(data).filter('title').text();
        window.scrollTo({ top: 0 });
        lazy.image();
        lazy.video();
        safeExternal('#' + id + ' a');
    });
}

var msg = {
    login: `<a class="shallow-dark" href="/login?next=${location.pathname}">로그인</a> 후 이용할 수 있습니다.`,
}

var makeChart = function(data, id) {
    am4core.ready(function () {
        am4core.useTheme(am4themes_dataviz);
        // am4core.useTheme(am4themes_animated);

        var chart = am4core.create(id, am4charts.XYChart);

        chart.data = data;
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
}