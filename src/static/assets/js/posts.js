$(document).ready(function () {
    autolink($('#comment'));
});
var posts = {
    like: (pk) => {
        $.ajax({
            url: `/api/v1/posts/${pk}`,
            type: "PUT",
            data: {like: 'like'},
        }).done(function (data) {
            if(data=='error:NL') {
                location.href='/login?next=' + location.pathname;
            }
            else if(data=='error:SU') {
                notify.append('자신의 글은 추천할 수 없습니다.')
            }
            else {
                if($("#heart i").hasClass("fas")) {
                    $("#heart i").removeClass("fas");
                    $("#heart i").addClass("far");
                } else {
                    $("#heart i").removeClass("far");
                    $("#heart i").addClass("fas");
                }
                document.getElementById('like-count').innerHTML = data;
            }
        });
    },
    remove: (pk) => {
        if(confirm("정말 삭제하십니까?") == true){
            $.ajax({
                url: `/api/v1/posts/${pk}`,
                type: "DELETE",
            }).done(function (data) {
                location.href = '/';
            });
        }
    }
}
var comment = {
    reload: (element) => {
        $(`#comment-${element.pk}`).html(render.comment(element));
        autolink($(`#comment-${element.pk}`));
    },
    write: (fk) => {
        $.ajax({
            url: `/api/v1/comments?fk=${fk}`,
            type: "POST",
            data: $("#comment-form").serialize(),
        }).done(function(data) {
            if(data.state == 'true') {
                $('#comment').append(`<div id="comment-${data.element.pk}">${render.comment(data.element)}</div>`);
                if($('#comment-empty')) {
                    $('#comment-empty').remove();
                }
                $('#comment-form textarea').val('');
                autolink($(`#comment-${data.element.pk}`));
                sendTagNotify(fk);
            }
        });
    },
    remove: (pk) => {
        if (confirm('댓글을 정말 삭제합니까?') == true) {
            $.ajax({
                type: "DELETE",
                url: `/api/v1/comments/${pk}`,
            }).done(function(data) {
                $(`#comment-${data.pk}`).remove();
                notify.append('댓글을 삭제되었습니다.');
            });
        } else {
            return;
        }
    },
    edit: (pk) => {
        $.ajax({
            type: "GET",
            url: `/api/v1/comments/${pk}?get=form`,
        }).done(function(data) {
            $(`#comment-${pk}`).html(data);
        });
    },
    like: (pk) => {
        $.ajax({
            type: "POST",
            url: `/comment/${pk}/like`,
        }).done(function(data) {
            if(data=='error:NL') {
                location.href='/login?next=' + location.pathname;
            }
            else if(data=='error:SU') {
                notify.append('자신의 댓글은 추천할 수 없습니다.')
            }
            else {
                $(`#clc${pk}`).html(data);
            }
        });
    },
    update: (pk) => {
        $.ajax({
            type: "PUT",
            url: `/api/v1/comments/${pk}`,
            data: $(`#comment-${pk}-form`).serialize(),
        }).done(function(data) {
            if(data.state == 'true') {
                comment.reload(data.element);
            }
        });
    },
    editCancle: (pk) => {
        $.ajax({
            type: "GET",
            url: `/api/v1/comments/${pk}`,
        }).done(function(data) {
            if(data.state == 'true') {
                comment.reload(data.element);
            }
        });
    }
}
var sendList = [];
function tagging(username) {
    var textValue = $('#id_text').val();
    if(textValue.indexOf(username) == -1) {
        $('#id_text').val(textValue + ('@' + username)).focus();
        if(sendList.indexOf(username) == -1) {
            sendList.push(username);
        }
    }
}
function sendTagNotify(pk) {
    sendList.forEach(function (element){
        $.ajax({
            url: "/api/v1/users/" + element + "?on=" + pk,
            type: "PUT",
            data: {tagging: 'tagging'}
        });
    });
}