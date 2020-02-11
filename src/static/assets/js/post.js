function likeArticle(pk) {
    $.ajax({
        url: `/api/v1/posts/${pk}`,
        type: "PUT",
        data: {like: 'like'},
    }).done(function (data) {
        if(data=='error:NL') {
            location.href='/login?next=' + location.pathname;
        }
        else if(data=='error:SU') {
            appendToast('자신의 글은 추천할 수 없습니다.')
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
}
function reloadComment(element) {
    $(`#comment-${element.pk}`).html(renderComment(element));
    autolink($(`#comment-${element.pk}`));
}
function writeComment(fk) {
    $.ajax({
        url: `/api/v1/comments?fk=${fk}`,
        type: "POST",
        data: $("#comment-form").serialize(),
    }).done(function(data) {
        if(data.state == 'true') {
            $('#comment').append(`<div id="comment-${data.element.pk}">${renderComment(data.element)}</div>`);
            if($('#comment-empty')) {
                $('#comment-empty').remove();
            }
            $('#comment-form textarea').val('');
            autolink($(`#comment-${data.element.pk}`));
            sendTagNotify(fk);
        }
    });
}
function removeComment(pk) {
    if (confirm('댓글을 정말 삭제합니까?') == true) {
        $.ajax({
            type: "DELETE",
            url: `/api/v1/comments/${pk}`,
        }).done(function(data) {
            $(`#comment-${data.pk}`).remove();
        });
    } else {
        return;
    }
}
function editComment(pk) {
    $.ajax({
        type: "GET",
        url: `/api/v1/comments/${pk}?get=form`,
    }).done(function(data) {
        $(`#comment-${pk}`).html(data);
    });
}
function likeComment(pk) {
    $.ajax({
        type: "POST",
        url: `/comment/${pk}/like`,
    }).done(function(data) {
        if(data=='error:NL') {
            location.href='/login?next=' + location.pathname;
        }
        else if(data=='error:SU') {
            appendToast('자신의 댓글은 추천할 수 없습니다.')
        }
        else {
            $(`#clc${pk}`).html(data);
        }
    });
}
function updateComment(pk) {
    $.ajax({
        type: "PUT",
        url: `/api/v1/comments/${pk}`,
        data: $(`#comment-${pk}-form`).serialize(),
    }).done(function(data) {
        if(data.state == 'true') {
            reloadComment(data.element);
        }
    });
}
function editCancle(pk) {
    $.ajax({
        type: "GET",
        url: `/api/v1/comments/${pk}`,
    }).done(function(data) {
        if(data.state == 'true') {
            reloadComment(data.element);
        }
    });
}
function renderComment(element) {
    return `\
    <div class="comment-list">\
        <div class="back-image thumb comment-thumb" style="background-image:url(${element.thumbnail})"></div>\
        <a class="font-weight-bold deep-dark">${element.author}</a>\
        <br>\
        <small>${element.created_date}전 <span class="vs">${element.edited}</span></small>\
        <ul class="none-list">
            <li><a class="vs shallow-dark" href="javascript:void(0)" onclick="editComment(${element.pk})">수정</a></li>\
            <li><a class="vs shallow-dark" href="javascript:void(0)" onclick="removeComment(${element.pk});">삭제</a></li>\
        </ul>\
        <div class="mt-3 noto">${element.content}</div>\
        <ul class="none-list">\
            <li>\
                <a class="shallow-dark" href="javascript:void(0);" onclick="likeComment(${element.pk})">\
                    <i class="fas fa-angle-up"></i> <span id="clc${element.pk}">${element.total_likes}</span>\
                </a>\
            </li>\
        </ul>\
    </div>`
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
$(document).ready(function () {
    autolink($('#comment'));
});
function deletePosts(pk) {
	if(confirm("정말 삭제하십니까?") == true){
    	$.ajax({
            url: `/api/v1/posts/${pk}`,
            type: "DELETE",
        }).done(function (data) {
            location.href = '/';
    	});
	}
}