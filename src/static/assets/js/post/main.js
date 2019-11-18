function reloadComment() {
    $("#comment").load(document.URL + " #comment");
}
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
function writeComment(paramUrl) {
    $.ajax({
        url: paramUrl,
        type: "POST",
        data: $("form").serialize(),
    }).done(function(data) {
        reloadComment();
        document.getElementById('id_text').value = "";
    });
}
function removeComment(paramUrl) {
    if ( confirm('댓글을 정말 삭제합니까?')==true ) {
        $.ajax({
            url: paramUrl,
            type: "POST",
        }).done(function(data) {
            reloadComment();
        });
    } else {
        return;
    }
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