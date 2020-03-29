$('#id_avatar').on('change',function() {
    var fileName = $(this).val();
    $(this).next('.custom-file-label').html(fileName);
});

$('#id_image').on('change', function() {
    var fileName = $(this).val();
    $(this).next('.custom-file-label').html(fileName);
});

$('.gp').on('click', function() {
    location.href='?page=' + $('.pn').val();
});

$('.pn').on('submit', function() {
    location.href='?page=' + $('.pn').val();
});

$('#image-upload-button').click(function(e) {
    e.preventDefault();
    $('#image-form > input').click();
});

$('#image-form > input').on('change', function() {
    var imageForm = document.getElementById('image-form');
    var formData = new FormData(imageForm);
    $.ajax({
        url: '/upload/image',
        type: 'POST',
        data: formData,
        contentType: false,
        cache: false,
        processData: false,
    }).done(function (data) {
        $('#story-form textarea').val($('#story-form textarea').val() + `![](${data})\n`);
    }).fail(function () {
        Notify.append('이미지 업로드에 실패했습니다.');
    });
    $('#image-form > input').val('');
    Notify.append('이미지를 업로드하는 중입니다.');
});

(function() {
    var writeSeletor = '';
    var writeRender = function() {
        $('#write-selector').html(Render.write(writeSeletor.result));
        $('.write-closer').on('click', function() {
            $('#write-selector').html('');
        });
    }
    $('#write-btn').on('click', function() {
        if(writeSeletor == '') {
            $.ajax({
                url: '/api/v1/posts/temp',
                type: 'GET',
                data: { get: 'list'} ,
            }).done(function (data) {
                writeSeletor = data
                writeRender();
            });
        }
        else {
            writeRender();
        }
    });
})();