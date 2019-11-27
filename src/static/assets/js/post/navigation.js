$(document).ready(function () {
    /* CREATE ARTICLE NAVIGATION */
    var navcounter = 0;
    var isCreateNav = false;
    var items = $.makeArray($('.article h1,.article h2,.article h3,.article h4,.article h5,.article h6').map(function () {
        navcounter += 1;
        isCreateNav = true;
        var makeTag = document.createElement('a');
        makeTag.appendChild(document.createTextNode($(this).text()));
        makeTag.setAttribute('id', 'nav' + navcounter);
        makeTag.href = 'javascript:void(0)';
        makeTag.setAttribute('onclick', 'moveSlide(' + '\'headline' + navcounter + '\')');
        $('#article-nav').append(makeTag);
        return $(this).attr('id', 'headline' + navcounter );
    }));

    var screenHeight = $(window).height();
    if($('body').hasClass('theme-purple')) {
        var themeColor = "#474787";
    } else if($('body').hasClass('theme-glue')) {
        var themeColor = "rgba(0, 0, 0, .84)";
    } else {
        var themeColor = "rgba(0, 0, 0, .84)";
    }

    $(window).scroll(function () {
        screenPosition = $(this).scrollTop();
        if (screenPosition < screenHeight) {
            $('#mNavigation').css("position", "absolute");
            $('#mNavigation').css("background", "rgba(0,0,0,0)");
            $("#mNavigation").removeClass("slide-bottom");
        } else {
            $('#mNavigation').css("position", "fixed");
            $('#mNavigation').css("background", themeColor);
            $("#mNavigation").addClass("slide-bottom");
        }
        if (isCreateNav) {
            var btween = screenPosition - (screenHeight - 100);
            for(let i=1; i<navcounter; i++) {
                if(btween > $(`#headline${i}`).position().top && btween < $(`#headline${i+1}`).position().top) {
                    $(`#nav${i}`).addClass('nav-now');
                }
                else {
                    $(`#nav${i}`).removeClass('nav-now');
                }
            }
            if(btween > $(`#headline${navcounter}`).position().top) {
                $(`#nav${navcounter}`).addClass('nav-now');
            }
            else {
                $(`#nav${navcounter}`).removeClass('nav-now');
            }
        }
    });
});