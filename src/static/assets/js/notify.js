var counter = 0;
var notify = {
    get: () => {
        $.ajax({
            url: "/api/v1/notify",
            type: "get",
        }).done(function (data) {
            if (data.count > 0) {
                data.content.forEach(function (element) {
                    $("#notify-content").append(render.notify.reguler(element));
                });
                $('.toast').toast({
                    'autohide': false
                });
                $('.toast').toast('show');
            }
        });
    },
    append: (info) => {
        var pk = counter++;
        $("#notify-content").append(
            render.notify.common({
                pk: pk,
                info: info
            })
        );
        $('.toast').toast({
            'delay': 3000,
        });
        $('.toast').toast('show');
        setTimeout(function () {
            $(`#pretoast${pk}`).remove();
        }, 3000);
    },
    read: () => {
        $.ajax({
            url: '/api/v1/notify',
            type: 'GET',
            data: { 'id': pk },
        }).done(function (data) {
            $(`#toast${pk}`).remove();
        });
    }
}