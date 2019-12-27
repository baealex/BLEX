function likeArticle(paramUrl) {
    $.ajax({
        url: paramUrl,
        type: "post",
    }).done(function (data) {
        if($("#heart i").hasClass("fas")) {
            $("#heart i").removeClass("fas");
            $("#heart i").addClass("far");
        } else {
            $("#heart i").removeClass("far");
            $("#heart i").addClass("fas");
        }
        document.getElementById('like-count').innerHTML = data;
    });
}
function reloadComment(element) {
    $(`#comment-${element.pk}`).html(renderComment(element));
    autolink($(`#comment-${element.pk}`));
}
function writeComment(paramUrl) {
    $.ajax({
        url: paramUrl,
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
        }
    });
}
function removeComment(pk) {
    if (confirm('댓글을 정말 삭제합니까?') == true) {
        $.ajax({
            url: `/comment/${pk}`,
            type: "DELETE",
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
        url: `/comment/${pk}/update`,
    }).done(function(data) {
        $(`#comment-${pk}`).html(data);
    });
}
function updateComment(pk) {
    $.ajax({
        type: "POST",
        url: `/comment/${pk}/update`,
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
        url: `/comment/${pk}`,
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
        <a class="vs shallow-dark" href="javascript:void(0)" onclick="editComment(${element.pk})">수정</a>\
        <a class="vs shallow-dark" href="javascript:void(0)" onclick="removeComment(${element.pk});">삭제</a>\
        <div class="mt-3 noto">${element.content}</div>\
    </div>`
}
function sendTagNotify(pk, userName, sendUser) {
    sendUser = sendUser.filter(function(item, pos, self) {
        return self.indexOf(item) == pos;
    });

    for( x in sendUser ) {
        $.ajax({
            url: "/notify/tagging/" + sendUser[x] + "/" + userName +"?blex=" + pk,
            type: "post",
        });
    }
}