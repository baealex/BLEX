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

function csrfSafeMethod(method) {
  // these HTTP methods do not require CSRF protection
  return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

function moveSlide(target, margin = 80) {
  $('html, body').animate({ scrollTop: $('#' + target).offset().top - margin }, 500);
}

function numberCounter(target_frame, target_number) {
  this.count = 0;
  this.diff = 0;
  this.target_count = parseInt(target_number);
  this.target_frame = document.getElementById(target_frame);
  this.timer = null;
  this.counter();
};

numberCounter.prototype.counter = function () {
  var self = this;
  this.diff = this.target_count - this.count;

  if (this.diff > 0) {
    self.count += Math.ceil(this.diff / 5);
  }
  this.target_frame.innerHTML = this.count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (this.count < this.target_count) {
    this.timer = setTimeout(function () { self.counter(); }, 50);
  } else {
    clearTimeout(this.timer);
  }
};

const msg = {
  login: `<a class="shallow-dark" href="/login?next=${location.pathname}">로그인</a> 후 이용할 수 있습니다.`,
}