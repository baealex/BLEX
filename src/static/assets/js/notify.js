$(document).ready(function() {
    $.ajax({
        url: "/user/notify",
        type: "get",
    }).done(function (data) {
        if(data.count > 0) {
            var result = "";
            data.content.forEach(function(element) {
                result +=  makeToast(element);
            });
            $("#notify-content").html(result);
            $('.toast').toast({
                //'delay': 4000,
                'autohide': false
            });
            $('.toast').toast('show');
        }
    });
});
function justRemove(readurl) {
    $.ajax({
        url: readurl,
        type: "get",
    });
}
function makeToast(element) {
    return "\
    <div class=\"toast\" role=\"alert\" aria-live=\"assertive\" aria-atomic=\"true\">\
        <div class=\"toast-header\">\
            <img src=\"https://static.blex.kr/assets/images/logo.png\" class=\"rounded mr-2\" width=\"20px\">\
            <strong class=\"mr-auto\">알림</strong>\
            <small class=\"text-muted\">"+ element.created_date +"전</small>\
            <button type=\"button\" class=\"ml-2 mb-1 close\" data-dismiss=\"toast\" aria-label=\"Close\" onclick=\"justRemove('/user/notify?redirect=" + element.pk + "')\">\
                <span aria-hidden=\"true\">&times;</span>\
            </button>\
        </div>\
        <div class=\"toast-body\">\
            <a class=\"deep-dark\" href=\"/user/notify?redirect="+ element.pk + "\">" + element.infomation + "</a>\
        </div>\
    </div>\
    "
}