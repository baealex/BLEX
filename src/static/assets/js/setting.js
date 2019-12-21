function postLock(pk) {
    $.ajax({
        url: `/post/${pk}/hide`,
        type: "post",
    }).done(function (data) {
        if(data.hide) {
            $(`#lock-${pk}`).removeClass('fa-lock-open');
            $(`#lock-${pk}`).addClass('fa-lock');
        } else {
            $(`#lock-${pk}`).removeClass('fa-lock');
            $(`#lock-${pk}`).addClass('fa-lock-open');
        }
    });
}

$('#id_avatar').on('change',function(){
    var fileName = $(this).val();
    $(this).next('.custom-file-label').html(fileName);
})