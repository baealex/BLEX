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
function postDelete(pk) {
	if(confirm("정말 삭제하십니까?") == true){
    	$.ajax({
            url: `/post/${pk}/remove`,
            type: "post",
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