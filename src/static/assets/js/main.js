function MoveSlide(target) {
    $('html, body').animate({ scrollTop: $('#' + target).offset().top - 80 }, 500);
}