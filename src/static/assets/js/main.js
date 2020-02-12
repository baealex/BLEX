function moveSlide(target, margin = 80) {
  $('html, body').animate({ scrollTop: $('#' + target).offset().top - margin }, 500);
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

function distoryLatelyPosition() {
  document.cookie = 'latelyposition=';
}

function saveLatelyPosition() {
  document.cookie = 'latelyposition=' + $(document).scrollTop();
}

function showThreadModal() {
  if (!document.getElementById('createThread')) {
    $.ajax({
      url: "/api/v1/thread?get=modal",
      type: "get",
    }).done(function (data) {
      $('body').append(data);
      $('#createThread').modal('show')
    });
  }
  else {
    $('#createThread').modal('show')
  }
}

function getTopics() {
  $(document).ready(() => {
    $.ajax({
      url: '/api/v1/topics',
      type: 'get',
    }).done((data) => {
      var result = '';
      data.tags.forEach((element) => {
        result += `<li><a href="/topic/${element.name}">${element.name}<span class="ns">(${element.count})</span></a></li>`
      });
      $('#tagList').html(result);
    });
  });
}