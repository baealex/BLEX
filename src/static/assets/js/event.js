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
            } else if(data == 'ERROR:NM') {
                $('#idCheck').removeClass('alert-success');
                $('#idCheck').addClass('alert-danger');
                $('#idCheck').text('소문자와 숫자로만 구성할 수 있습니다!');
            } else {
                $('#idCheck').removeClass('alert-danger');
                $('#idCheck').addClass('alert-success');
                $('#idCheck').text(window.location.protocol + '//' + window.location.hostname + '/@' + $('#id_username').val());
                if(document.getElementById('idButton')) {
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

    function isClosed() {
        return $('.closer').hasClass('closed');
    }

    function sidebarClose() {
        $('.closer').html('<i class="fas fa-chevron-right"></i>');
        $('.home').removeClass('closed');
        for(var i=0; i<className.length; i++) {
            $(className[i]).addClass('closed');
        }
    }

    function sidebarOpen() {
        $('.closer').html('<i class="fas fa-chevron-left"></i>');
        $('.home').addClass('closed');
        for(var i=0; i<className.length; i++) {
            $(className[i]).removeClass('closed');
        }
    }

    $('.story-read').on('click', function() {
        var href = $(this).data('href');
        changing('content', href);
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
    
    $('.home').on('click', function() {
        location.href = '/';
    });

    $(document).ready(function() {
        if($(window).width() < 700) {
            sidebarClose();
        }
        safeExternal('#content a');
    });
};

var writeEvent = function() {
    var state = '';
    var component = function(elements) {
        var list = '';
        elements.forEach(function(element) {
            list += `<li><a href="/write?token=${element.token}">${element.title} (${element.date} 전)</a></li>`;
        });
        return `
        <div class="full-mask blurring write-closer">
            <div class="center-list">
                <ul class="serif">
                    ${list}
                    <li><a href="/write">새 글 쓰기</a></li>
                    <li><a class="write-closer" href="javascript:void(0);">닫기</a></li>
                </ul>
            </div>
        </div>`;
    }
    var render = function(state) {
        $('#write-selector').html(component(state.result));
        $('.write-closer').on('click', function() {
            $('#write-selector').html('');
        });
    }
    $('#write-btn').on('click', function() {
        if(state == '') {
            $.ajax({
                url: '/api/v1/posts/temp',
                type: 'GET',
                data: { get: 'list'} ,
            }).done(function (data) {
                this.state = data;
                render(this.state);
            });
        } else {
            render(this.state);
        }
    });
};

(function() {
    document.addEventListener("DOMContentLoaded", function() {
        lazyLoadImage();
        lazyLoadVideo(); 
    });
    if(document.getElementById('write-btn')) {
        writeEvent();
    }
    if(document.getElementById('thread-detail')) {
        threadEvent();
    }
})();