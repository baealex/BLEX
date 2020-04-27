function setCookie(cookie) {
  var willCookie = '';
  if (cookie.name != undefined && cookie.value != undefined)
    willCookie += cookie.name + '=' + cookie.value + ';';
  if (cookie.expire != undefined)
    willCookie += 'Expires=' + cookie.expire + ';';
  if (cookie.expireDay != undefined) {
    var date = new Date();
    date.setTime(date.getTime() + (cookie.expireDay * 24 * 60 * 60 * 1000));
    willCookie += 'Expires=' + date.toGMTString() + ';';
  }
  if (cookie.damain != undefined)
    willCookie += 'Domain=' + cookie.domain + ';';
  if (cookie.path != undefined)
    willCookie += 'Path=' + cookie.path + ';';
  document.cookie = willCookie;
}

function getCookie(name) {
  var cookieValue = null;
  if (document.cookie && document.cookie != '') {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var cookie = jQuery.trim(cookies[i]);
      // Does this cookie string begin with the name we want?
      if (cookie.substring(0, name.length + 1) == (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function getParameter(param) {
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
};

function copyToClipboard(val) {
  var t = document.createElement("textarea");
  document.body.appendChild(t);
  t.value = val;
  t.select();
  document.execCommand('copy');
  document.body.removeChild(t);
}

function getPath() {
  return location.protocol + '//' + location.host + location.pathname;
}

function night() {
  if($('#night i').hasClass('fa-moon')) {
    $('body').addClass('dark');
    setCookie({
      name: 'nightmode',
      value: 'true',
      path: '/',
      expireDay: 365,
    });
    $('#night').html('<i class="fas fa-sun"></i>');
    $('#top-nav').removeClass('bg-rlight');
    $('#top-nav').removeClass('navbar-light');
    $('#top-nav').addClass('bg-rdark');
    $('#top-nav').addClass('navbar-dark');
    $('#top-nav img').attr('src', 'https://static.blex.me/assets/images/logor.png');
  } else {
    $('body').removeClass('dark');
    setCookie({
      name: 'nightmode',
      value: '',
      path: '/',
      expireDay: -1,
    });
    $('#night').html('<i class="fas fa-moon"></i>');
    $('#top-nav').removeClass('bg-rdark');
    $('#top-nav').removeClass('navbar-dark');
    $('#top-nav').addClass('bg-rlight');
    $('#top-nav').addClass('navbar-light');
    $('#top-nav img').attr('src', 'https://static.blex.me/assets/images/logo.png');
  }
}

function lazyLoadImage() {
  var lazyImages = [].slice.call(document.querySelectorAll("img.lazy"));

  if ("IntersectionObserver" in window) {
      let lazyImageObserver = new IntersectionObserver(function(entries, observer) {
          entries.forEach(function(entry) {
              if (entry.isIntersecting) {
                  let lazyImage = entry.target;
                  lazyImage.src = lazyImage.dataset.src;
                  lazyImage.classList.remove("lazy");
                  lazyImageObserver.unobserve(lazyImage);
              }
          });
      });

      lazyImages.forEach(function(lazyImage) {
          lazyImageObserver.observe(lazyImage);
      });
  } else {
      // Possibly fall back to a more compatible method here
  }
}

function lazyLoadVideo() {
  var lazyVideos = [].slice.call(document.querySelectorAll("video.lazy"));

  if ("IntersectionObserver" in window) {
      var lazyVideoObserver = new IntersectionObserver(function(entries, observer) {
          entries.forEach(function(video) {
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

      lazyVideos.forEach(function(lazyVideo) {
          lazyVideoObserver.observe(lazyVideo);
      });
  }
}

function csrfSafeMethod(method) {
  // these HTTP methods do not require CSRF protection
  return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

function moveSlide(target, margin = 80) {
  $('html, body').animate({ scrollTop: $('#' + target).offset().top - margin }, 500);
}

function changing(id, href) {
  $.ajax({
    url: href,
    type: 'GET',
  }).done(function (data) {
    $('#' + id).html($(data).find('#' + id).html());
    document.title = $(data).filter('title').text();
    window.scrollTo({top: 0});
    lazyLoadImage();
    lazyLoadVideo();
  });
}

const msg = {
  login: `<a class="shallow-dark" href="/login?next=${location.pathname}">로그인</a> 후 이용할 수 있습니다.`,
}

function makeChart(data, id) {
  am4core.ready(function() {
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