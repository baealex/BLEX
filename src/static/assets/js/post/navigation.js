/* Side navigation */
var navcounter = 0;
var is_create_nav = false;
var items = $.makeArray($('.article h1,.article h2,.article h3,.article h4,.article h5,.article h6').map(function () {
    navcounter += 1;
    is_create_nav = true;
    var tag_a = document.createElement('a');
    tag_a.appendChild(document.createTextNode($(this).text()));
    tag_a.setAttribute('id', 'nav' + navcounter);
    tag_a.href = 'javascript:void(0)';
    tag_a.setAttribute('onclick', 'MoveSlide(' + navcounter + ')');
    $('#article-nav').append(tag_a);
    return $(this).attr('id', navcounter );
}));

/* Top navigation */
$(document).ready(function () {
    screenHeight = $(window).height();
    sp = $(window).height() - 100;
    $(window).scroll(function () {
        if ($(this).scrollTop() < screenHeight) {
            $('#mNavigation').css("position", "absolute");
            $('#mNavigation').css("background", "rgba(0,0,0,0)");
            $("#mNavigation").removeClass("slide_bottom");
        } else {
            $('#mNavigation').css("position", "fixed");
            $('#mNavigation').css("background", "rgba(0,0,0,.84)");
            $("#mNavigation").addClass("slide_bottom");
        }
        if (is_create_nav) {
            cp = $(document).scrollTop();
            for(let j=1; j<navcounter; j++) {
                if(cp-sp > $(`#${j}`).position().top && cp-sp < $(`#${j+1}`).position().top) $(`#nav${j}`).addClass('nav-now');
                else $(`#nav${j}`).removeClass('nav-now');
            }
            if(cp-sp > $(`#${navcounter}`).position().top) $(`#nav${navcounter}`).addClass('nav-now');
            else $(`#nav${navcounter}`).removeClass('nav-now');
        }
    });
});