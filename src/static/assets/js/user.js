function userFollow(username) {
    $.ajax({
        url: `/api/v1/users/${username}`,
        type: "PUT",
        data: {follow: 'follow'},
    }).done(function(data) {
        if(data=='error:NL') {
            location.href='/login?next=' + location.pathname;
        }
        else if(data=='error:SU') {
            appendToast('자신은 구독할 수 없습니다.')
        }
        else {
            $('.follow-badge').attr('src', `https://img.shields.io/badge/subscriber-${data}-red?style=social`)
        }
    });
}
function editAbout(username) {
    if($('#aboutButton').hasClass('edit')) {
        $.ajax({
            method: 'GET',
            url: `/api/v1/users/${username}?form=about`,
        }).done(function (data) {
            $('#about').html(data);
            $('#aboutButton').text('완료');
            $('#aboutButton').addClass('submit');
            $('#aboutButton').removeClass('edit');
        });
    } else {
        $.ajax({
            method: 'PUT',
            url: `/api/v1/users/${username}`,
            data: $('form').serialize()
        }).done(function (data) {
            $('#about').html(data);
            $('#aboutButton').text('편집');
            $('#aboutButton').addClass('edit');
            $('#aboutButton').removeClass('submit');
        });
    }
}