var story = {
    write: (fk) => {
        $.ajax({
            url: `/api/v1/story?fk=${fk}`,
            type: "POST",
            data: $("#story-form").serialize(),
        }).done(function (data) {
            $('#story-form input').val('');
            $('#story-form textarea').val('');
            $('#story').prepend(`<div id="story-${data.element.pk}">${render.story(data.element)}</div>`);
        });    
    },
    edit: (pk) => {
        $.ajax({
            type: "GET",
            url: `/api/v1/story/${pk}?get=form`,
        }).done(function(data) {
            $(`#story-${pk}`).html(data);
        });
    },
    editCancle: (pk) => {
        $.ajax({
            type: "GET",
            url: `/api/v1/story/${pk}`,
        }).done(function(data) {
            $(`#story-${pk}`).html(render.story(data.element));
        });
    },
    update: (pk) => {
        $.ajax({
            type: "PUT",
            url: `/api/v1/story/${pk}`,
            data: $(`#story-${pk}-form`).serialize(),
        }).done(function(data) {
            if(data.state == 'true') {
                $(`#story-${pk}`).html(render.story(data.element));
            }
        });
    },
    remove: (pk) => {
        if(confirm('정말 스토리를 삭제합니까?')) {
            $.ajax({
                url: `/api/v1/story/${pk}`,
                type: "DELETE",
            }).done(function (data) {
                if(data == 'DONE') {
                    $(`#story-${pk}`).remove();
                }
            });
        }
    }
}
var thread = {
    edit: (pk) => {
        if (!document.getElementById('createThread')) {
            $.ajax({
                url: `/api/v1/thread/${pk}?get=modal`,
                type: "get",
            }).done(function (data) {
                $('body').append(data);
                $('#createThread').modal('show');
            });
        }
        else {
            $('#createThread').modal('show');
        }
    },
    remove: (pk) => {
        if(confirm('정말 스레드를 삭제합니까?')) {
            $.ajax({
                url: `/api/v1/thread/${pk}`,
                type: "DELETE",
            }).done(function (data) {
                if(data == 'DONE') {
                    location.href='/';
                }
            });
        }
    }
}