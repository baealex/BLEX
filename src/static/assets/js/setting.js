var setting = {
    posts: {
        lock: (pk) => {
            $.ajax({
                url: `/api/v1/posts/${pk}`,
                type: "PUT",
                data: {hide: 'changed'}
            }).done(function (data) {
                if(data.hide) {
                    $(`#lock-${pk}`).removeClass('fa-lock-open');
                    $(`#lock-${pk}`).addClass('fa-lock');
                    notify.append('포스트가 숨겨집니다.');
                } else {
                    $(`#lock-${pk}`).removeClass('fa-lock');
                    $(`#lock-${pk}`).addClass('fa-lock-open');
                    notify.append('포스트가 공개됩니다.');
                }
            });
        },
        remove: (pk) => {
            if(confirm("정말 삭제하십니까?") == true){
                $.ajax({
                    url: `/api/v1/posts/${pk}`,
                    type: "DELETE",
                }).done(function (data) {
                    notify.append('포스트가 삭제되었습니다.');
                    $('#post-' + pk).remove();
                });
            }
        },
        changeTag: (pk) => {
            $.ajax({
                url: `/api/v1/posts/${pk}`,
                type: "PUT",
                data: $(`#post-${pk} form`).serialize(),
            }).done(function (data) {
                notify.append('태그가 변경되었습니다.');
                $(`#post-${pk} form`).find('[name=tag]').val(data.tag);
            });
        },
    },
    thread: {
        lock: (pk) => {
            $.ajax({
                url: `/api/v1/thread/${pk}`,
                type: "PUT",
                data: {hide: 'changed'}
            }).done(function (data) {
                if(data.hide) {
                    $(`#lock-${pk}`).removeClass('fa-lock-open');
                    $(`#lock-${pk}`).addClass('fa-lock');
                    notify.append('스레드가 숨겨집니다.');
                } else {
                    $(`#lock-${pk}`).removeClass('fa-lock');
                    $(`#lock-${pk}`).addClass('fa-lock-open');
                    notify.append('스레드가 공개됩니다.');
                }
            });
        },
        remove: (pk) => {
            if(confirm("정말 삭제하십니까?") == true){
                $.ajax({
                    url: `/api/v1/thread/${pk}`,
                    type: "DELETE",
                }).done(function (data) {
                    notify.append('스레드가 삭제되었습니다.');
                    $('#thread-' + pk).remove();
                });
            }
        },
        changeTag: (pk) => {
            $.ajax({
                url: `/api/v1/thread/${pk}`,
                type: "PUT",
                data: $(`#thread-${pk} form`).serialize(),
            }).done(function (data) {
                notify.append('태그가 변경되었습니다.');
                $(`#thread-${pk} form`).find('[name=tag]').val(data.tag);
            });
        },
    },
}
$('#id_avatar').on('change',function(){
    var fileName = $(this).val();
    $(this).next('.custom-file-label').html(fileName);
})