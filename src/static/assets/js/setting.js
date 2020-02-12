function postLock(pk) {
    $.ajax({
        url: `/api/v1/posts/${pk}`,
        type: "PUT",
        data: {hide: 'changed'}
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
function tagChange(pk) {
    $.ajax({
        url: `/api/v1/posts/${pk}`,
        type: "PUT",
        data: $(`#post-${pk} form`).serialize(),
    }).done(function (data) {
        notify.append('태그가 변경되었습니다.');
        $(`#post-${pk} form`).find('[name=tag]').val(data.tag);
    });
}
function postDelete(pk) {
	if(confirm("정말 삭제하십니까?") == true){
    	$.ajax({
            url: `/api/v1/posts/${pk}`,
            type: "DELETE",
        }).done(function (data) {
            $('#post-' + pk).remove();
    	});
	}
}
function seriesRemove(pk) {
    if(confirm("정말 삭제하십니까?") == true) {
        $.ajax({
            url: `/series/${pk}/remove`,
            type: "post",
        }).done(function (data) {
            if(data == 'done') {
                location.href='/';
            }
        });
    }
}
$('#id_avatar').on('change',function(){
    var fileName = $(this).val();
    $(this).next('.custom-file-label').html(fileName);
})