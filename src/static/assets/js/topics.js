$(document).ready(() => {
    $.ajax({
        url: '/api/v1/topics',
        type: 'get',
    }).done((data) => {
        var result = '';
        data.tags.forEach((element) => {
            result += `<li><a href="/topic/${element.name}">${element.name}<span class="ns">(${element.count})</span></a></li>`
        });
        $('#tagList').html(result);
    });
});