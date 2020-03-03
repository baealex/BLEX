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
        if($(this).prop('tagName') == 'H1' || $(this).prop('tagName') == 'H2') {
            makeTag.setAttribute('class', 'title-1');
        }
        else if($(this).prop('tagName') == 'H3' || $(this).prop('tagName') == 'H4') {
            makeTag.setAttribute('class', 'title-2');
        }
        else {
            makeTag.setAttribute('class', 'title-3');
        }
        makeTag.setAttribute('onclick', 'moveSlide(' + '\'headline' + navcounter + '\')');
        $('#article-nav').append(makeTag);
        return $(this).attr('id', 'headline' + navcounter );
    }));

    var screenHeight = $(window).height();
    $(window).scroll(function () {
        screenPosition = $(this).scrollTop();

        if (screenPosition < screenHeight) {
            $('#top-nav').css("position", "absolute");
            $('#top-nav').css("background", "rgba(0, 0, 0, 0)");
            $("#top-nav").removeClass("slide-bottom");
        } else {
            $('#top-nav').css("position", "fixed");
            $('#top-nav').css("background", "rgba(0, 0, 0, .98)");
            $("#top-nav").addClass("slide-bottom");
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