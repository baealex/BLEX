$(document).ready(function() {
    var desPos = getCookie('latelyposition');
    var findLatelyPosition = setInterval(function() {
      var nowPos = $(document).scrollTop();
      if(nowPos != desPos) {
        $(document).scrollTop(desPos);
      } else {
        clearTimeout(findLatelyPosition);
      }
    }, 10);
});