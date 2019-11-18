/* Side navigation */
var navcounter = 0;
var isCreateNav = false;
var items = $.makeArray($('.article h1,.article h2,.article h3,.article h4,.article h5,.article h6').map(function () {
    navcounter += 1;
    isCreateNav = true;
    var makeTag = document.createElement('a');
    makeTag.appendChild(document.createTextNode($(this).text()));
    makeTag.setAttribute('id', 'nav' + navcounter);
    makeTag.href = 'javascript:void(0)';
    makeTag.setAttribute('onclick', 'moveSlide(' + navcounter + ')');
    $('#article-nav').append(makeTag);
    return $(this).attr('id', navcounter );
}));

/* Top navigation */
$(document).ready(function () {
    screenHeight = $(window).height();
    screenHeightWithoutTopnav = $(window).height() - 100;
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
        if (isCreateNav) {
            screenPosition = $(document).scrollTop();
            for(let j=1; j<navcounter; j++) {
                if(screenHeightWithoutTopnav-screenPosition > $(`#${j}`).position().top && screenHeightWithoutTopnav-screenPosition < $(`#${j+1}`).position().top) {
                    $(`#nav${j}`).addClass('nav-now');
                }
                else {
                    $(`#nav${j}`).removeClass('nav-now');
                }
            }
            if(screenHeightWithoutTopnav-screenPosition > $(`#${navcounter}`).position().top) {
                $(`#nav${navcounter}`).addClass('nav-now');
            }
            else {
                $(`#nav${navcounter}`).removeClass('nav-now');
            }
        }
    });
});