function likeArticle(paramUrl) {
    $.ajax({
        url: paramUrl,
        type: "post",
    }).done(function (data) {
        if($("#like").hasClass("like-active")) {
            $("#like").removeClass("like-active");
        } else {
            $("#like").addClass("like-active");
        }
        document.getElementById('like-count').innerHTML = data;
    });
}
function reloadComment(element) {
    $(`#comment-${element.pk}`).html(renderComment(element));
}
function writeComment(paramUrl) {
    $.ajax({
        url: paramUrl,
        type: "POST",
        data: $("form").serialize(),
    }).done(function(data) {
        if(data.state == 'true') {
            $('#comment').append(`<div id="comment-${data.element.pk}">${renderComment(data.element)}</div>`);
            document.getElementById('id_text').value = "";
        }
    });
}
function removeComment(paramUrl) {
    if (confirm('댓글을 정말 삭제합니까?') == true) {
        $.ajax({
            url: paramUrl,
            type: "POST",
        }).done(function(data) {
            $(`#comment-${data.pk}`).remove();
        });
    } else {
        return;
    }
}
function renderComment(element) {
    return `\
    <div class="comment-list">\
        <div class="back-image thumb comment-thumb" style="background-image:url(${element.thumbnail})"></div>\
        <a class="font-weight-bold deep-dark">${element.author}</a>\
        <br>\
        <small>${element.created_date}전 <span class="vs">${element.edited}</span></small>\
        <a class="vs shallow-dark" href="javascript:void(0)" onclick="window.open('/comment/${element.pk}/update', '댓글 수정', 'width=500, height=190,left=100, top=50');">수정</a>\
        <a class="vs shallow-dark" href="javascript:void(0)" onclick="removeComment('/comment/${element.pk}/remove');">삭제</a>\
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