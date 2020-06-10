function captureReturnKey(e) {
    if(e.keyCode==13) return false;
}

const preventExit = (function() {
    isSubmit = false;
    return {
        getSubmit: function() {
            return isSubmit;
        },
        preSubmit: function() {
            isSubmit = true;
        },
        notSubmit: function() {
            isSubmit = false;
        }
    }
})();

$(window).bind("beforeunload", function (e){
    if(!preventExit.getSubmit()) return "변경 사항이 적용되지 않습니다. 정말 종료합니까?";
});

$(document).ready(function() {
    var csrftoken = cookie.get('csrftoken');
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
                xhr.setRequestHeader("X-CSRFToken", csrftoken);
            }
        }
    });
});

const Notify = (function() {
    var counter = 0;
    return {
        append: (info) => {
            var pk = counter++;
            $('#notify-content').append(`
            <div id="pretoast${pk}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <img src="https://static.blex.me/assets/images/logo.png" class="rounded mr-2" width="20px">
                    <strong class="mr-auto">알림</strong>
                    <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="toast-body">
                    ${info}
                </div>
            </div>
            `);
            $('.toast').toast({
                'delay': 3000,
            });
            $('.toast').toast('show');
            setTimeout(() => {
                $(`#pretoast${pk}`).remove();
            }, 3000);
        },
    }
})();

const Save = (function() {
    const url = '/api/v1/posts/temp';
    const token = getParameter('token');
    var isWait = false;

    if(token) {
        $.ajax({
            url: url,
            data: {token: token},
            type: 'GET',
        }).done(function(data) {
            $('#id_title').val(data.title);
            $('#id_text_md').text(data.text_md);
            $('#id_tag').val(data.tag);
        });
    }
    
    return {
        sendState: function() {
            if(isWait) {
                Notify.append('임시 저장은 1분 간격으로 사용할 수 있습니다.');
                return;
            }

            let data = {
                'title': $('#id_title').val(),
                'text_md': $('#id_text_md').val(),
                'tag': $('#id_tag').val(),
            }
            if(!data.title) {
                let date = new Date();
                data.title = date.toLocaleString();
            }

            if(token) { data.token = token; }

            $.ajax({
                url: url,
                type: token ? 'PUT' : 'POST',
                data: data,
            }).done(function(data) {
                if(data == 'Error:EG') {
                    Notify.append('임시 저장은 5개까지 가능합니다.');
                } else {
                    if(token) {
                        Notify.append('임시 저장이 완료되었습니다.');
                        $('#detailModal').modal('hide');
                        isWait = true;
                        setTimeout(function() {
                            isWait = false;
                        }, 1000 * 60);
                    } else {
                        alert('임시 저장이 완료되었습니다.');
                        preventExit.preSubmit();
                        location.replace("/write?token=" + data);
                    }
                }
            });
        }
    }
})();