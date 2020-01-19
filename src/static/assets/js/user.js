function userFollow(username) {
    $.ajax({
        url: `/@${username}/follow`,
        type: "POST",
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