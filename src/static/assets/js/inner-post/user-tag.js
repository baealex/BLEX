var csrftoken = jQuery("[name=csrfmiddlewaretoken]").val();
function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}
$.ajaxSetup({
    beforeSend: function (xhr, settings) {
        if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader("X-CSRFToken", csrftoken);
        }
    }
});
var onlyOneGet = false;
function user_tagging() {
    if(onlyOneGet == false) {
        $.ajax({
            url: "https://blex.kr/post/" + mPK + "/commentor",
            type: "get",
        }).done(function (data) {
            userList = data.split(',');
            userList.pop();
        });
    }
    onlyOneGet = true;
}
document.onkeydown=function(e){  
    if(e.key == '@') findUser=true;
}

var findUser = false;
var isShift = false;
var isFind = false;
var username = '';
function user_find() {
    if(findUser) {
        username = prompt('태그할 사용자');
        for ( x in userList ) {
            if ( username == userList[x] ) {
                document.getElementById("id_text").value += username;
                isFind = true;
                sendUser.push(username); 
                break;
            }
            else {
                isFind = false;
            }
        }
        if ( !isFind ) {
            alert('이 포스트에 댓글이 있는 사용자가 아닙니다.');
        }
        findUser = false;
        username = '';
    }
}
function POST_tag_notify(mName) {
    sendUser = sendUser.filter(function(item, pos, self) {
        return self.indexOf(item) == pos;
    });

    for( x in sendUser ) {
        $.ajax({
            url: "https://blex.kr/notify/tagging/" + sendUser[x] + "/" + mName +"?blex=" + mPK,
            type: "post",
        }).done(function (data) {
            console.log(data);
        });
    }
}