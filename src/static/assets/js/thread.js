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
        }).done(function (data) {
            $(`#story-${pk}`).html(data);
        });
    },
    editCancle: (pk) => {
        $.ajax({
            type: "GET",
            url: `/api/v1/story/${pk}`,
        }).done(function (data) {
            $(`#story-${pk}`).html(render.story(data.element));
        });
    },
    update: (pk) => {
        $.ajax({
            type: "PUT",
            url: `/api/v1/story/${pk}`,
            data: $(`#story-${pk}-form`).serialize(),
        }).done(function (data) {
            if (data.state == 'true') {
                $(`#story-${pk}`).html(render.story(data.element));
            }
        });
    },
    remove: (pk) => {
        if (confirm('정말 스토리를 삭제합니까?')) {
            $.ajax({
                url: `/api/v1/story/${pk}`,
                type: "DELETE",
            }).done(function (data) {
                if (data == 'DONE') {
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
        if (confirm('정말 스레드를 삭제합니까?')) {
            $.ajax({
                url: `/api/v1/thread/${pk}`,
                type: "DELETE",
            }).done(function (data) {
                if (data == 'DONE') {
                    location.href = '/';
                }
            });
        }
    }
}
$('#image-upload-button').click(function (e) {
    e.preventDefault();
    $('#image-form > input').click();
});
function imageUpload() {
    var imageForm = document.getElementById('image-form');
    var formData = new FormData(imageForm);
    $.ajax({
        url: "/upload/image",
        type: "POST",
        data: formData,
        contentType: false,
        cache: false,
        processData: false,
    }).done(function (data) {
        $('#story-form textarea').val($('#story-form textarea').val() + `\n![](${data})\n`);
        appendToast('이미지가 업로드 되었습니다.');
    }).fail(function () {
        appendToast('이미지 업로드에 실패했습니다.');
    });
    $('#image-form > input').val('');
    appendToast('이미지를 업로드하는 중입니다.');
}