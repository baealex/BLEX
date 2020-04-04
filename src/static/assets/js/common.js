function setCookie(cookie) {
  var willCookie = '';
  if (cookie.name != undefined && cookie.value != undefined)
    willCookie += cookie.name + '=' + cookie.value + ';';
  if (cookie.expire != undefined)
    willCookie += 'Expires=' + cookie.expire + ';';
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

function csrfSafeMethod(method) {
  // these HTTP methods do not require CSRF protection
  return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

function moveSlide(target, margin = 80) {
  $('html, body').animate({ scrollTop: $('#' + target).offset().top - margin }, 500);
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