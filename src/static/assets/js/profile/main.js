function showProfile(section) {
    var section_list = ['#serise', '#post', '#active'];
    section_list.forEach(function(element) {
        $(element).css('display', 'none');
    });
    $(section).css('display', 'block');
    document.cookie='tab='+section;
}

$(document).ready(function() {
    if (!getCookie('tab')) {
        showProfile('#post');
    } else {
        showProfile(getCookie('tab'));
    }
});