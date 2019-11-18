$(document).ready(function() {
    $.ajax({
        url: "/notify/count",
        type: "get",
    }).done(function (data) {
        if (data > 0) {
            getUserNotifyContent();
        }
    });
});
function getUserNotifyContent() {
    $.ajax({
        url: "/notify/content",
        type: "get",
    }).done(function (data) {
        $("#notify-content").html(data);
        $('.toast').toast({
            // 'delay': 4000
            'autohide': false
        });
        $('.toast').toast('show');
    });
}
function justRemove(readurl) {
    $.ajax({
        url: readurl,
        type: "get",
    });
}