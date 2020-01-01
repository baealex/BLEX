function userFollow(username) {
    $.ajax({
        url: `/@${username}/follow`,
        type: "POST",
    }).done(function(data) {
        $('.follow-badge').attr('src', `https://img.shields.io/badge/subscriber-${data}-red?style=social`)
    });
}