function reloadComment() {
    $("#comment").load(document.URL + " #comment");
}
function POST_like(m_url) {
    $.ajax({
        url: m_url,
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
function POST_comment(m_url) {
    $.ajax({
        url: m_url,
        type: "post",
        data: $("form").serialize(),
    }).done(function(data) {
        reloadComment();
        document.getElementById('id_text').value = "";
    });
}
function DELETE_comment(m_url) {
    $.ajax({
        url: m_url,
        type: "post",
    }).done(function(data) {
        reloadComment();
    });
}
function POST_tag_notify(pk, userName, sendUser) {
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