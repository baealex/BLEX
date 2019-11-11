$(document).ready(function () {
    $.ajax({
        url: "https://blex.kr/notify/count",
        type: "get",
    }).done(function (data) {
        if (data > 0) {
            if ($("#notice-icon").addClass("active"));
            document.getElementById('notice-count').innerHTML = data;
        }
    });
});
function getUserNotifyContent() {
    $.ajax({
        url: "https://blex.kr/notify/content",
        type: "get",
    }).done(function (data) {
        $("#notify-content").html(data);
    });
}