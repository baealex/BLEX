function getNotify() {
    $.ajax({
        url: "/api/v1/notify",
        type: "get",
    }).done(function (data) {
        if(data.count > 0) {
            data.content.forEach(function(element) {
                $("#notify-content").append(renderToast(element));
            });
            $('.toast').toast({
                'autohide': false
            });
            $('.toast').toast('show');
        }
    });
}
var notifyCounter = 0;
function appendToast(info) {
    var pk = notifyCounter++;
    $("#notify-content").append(
        renderCommonToast({
            pk: pk,
            info: info
        })
    );
    $('.toast').toast({
        'delay': 3000,
    });
    $('.toast').toast('show');
    setTimeout(function() {
        $('#pretoast' + pk).remove();
    }, 3000);
}
function justRemove(pk) {
    $.ajax({
        url: '/api/v1/notify',
        type: 'GET',
        data: { 'id': pk },
    }).done(function (data) {
        $('#toast' + pk).remove();
    });
}
function renderCommonToast(element) {
    return "\
    <div id=\"pretoast" + element.pk + "\" class=\"toast\" role=\"alert\" aria-live=\"assertive\" aria-atomic=\"true\">\
        <div class=\"toast-header\">\
            <img src=\"https://static.blex.kr/assets/images/logo.png\" class=\"rounded mr-2\" width=\"20px\">\
            <strong class=\"mr-auto\">알림</strong>\
            <button type=\"button\" class=\"ml-2 mb-1 close\" data-dismiss=\"toast\" aria-label=\"Close\">\
                <span aria-hidden=\"true\">&times;</span>\
            </button>\
        </div>\
        <div class=\"toast-body\">\
            " + element.info + "\
        </div>\
    </div>\
    "
}
function renderToast(element) {
    return "\
    <div id=\"toast" + element.pk + "\" class=\"toast\" role=\"alert\" aria-live=\"assertive\" aria-atomic=\"true\">\
        <div class=\"toast-header\">\
            <img src=\"https://static.blex.kr/assets/images/logo.png\" class=\"rounded mr-2\" width=\"20px\">\
            <strong class=\"mr-auto\">알림</strong>\
            <small class=\"text-muted\">"+ element.created_date +"전</small>\
            <button type=\"button\" class=\"ml-2 mb-1 close\" data-dismiss=\"toast\" aria-label=\"Close\" onclick=\"justRemove(" + element.pk + ")\">\
                <span aria-hidden=\"true\">&times;</span>\
            </button>\
        </div>\
        <div class=\"toast-body\">\
            <a class=\"deep-dark\" href=\"/api/v1/notify?id="+ element.pk + "\">" + element.infomation + "</a>\
        </div>\
    </div>\
    "
}