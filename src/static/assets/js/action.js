const Posts = (() => {
    const url = '/api/v1/posts';
    return {
        like: (pk) => {
            $.ajax({
                url: `${url}/${pk}`,
                type: 'PUT',
                data: {like: 'like'},
            }).done(function (data) {
                if(data=='error:NL') {
                    location.href = `/login?next=${location.pathname}`;
                }
                else if(data=='error:SU') {
                    Notify.append('자신의 글은 추천할 수 없습니다.')
                }
                else {
                    if($('#heart i').hasClass('fas')) {
                        $('#heart i').removeClass('fas');
                        $('#heart i').addClass('far');
                    } else {
                        $('#heart i').removeClass('far');
                        $('#heart i').addClass('fas');
                    }
                    $('#like-count').text(data);
                }
            })
        },
        remove: (pk) => {
            if(confirm('정말 삭제하십니까?')){
                $.ajax({
                    url: `${url}/${pk}`,
                    type: 'DELETE',
                }).done(function (data) {
                    if(document.getElementById(`setting-posts-${pk}`)) {
                        Notify.append('포스트가 삭제되었습니다.');
                        $('#setting-posts-' + pk).remove();
                    } else {
                        alert('포스트가 삭제되었습니다.')
                        location.href = '/';
                    }
                });
            }
        },
        lock: (pk) => {
            $.ajax({
                url: `/api/v1/posts/${pk}`,
                type: "PUT",
                data: {hide: 'changed'}
            }).done((data) => {
                if(data.hide) {
                    $(`#lock-${pk}`).removeClass('fa-lock-open');
                    $(`#lock-${pk}`).addClass('fa-lock');
                    Notify.append('포스트가 숨겨집니다.');
                } else {
                    $(`#lock-${pk}`).removeClass('fa-lock');
                    $(`#lock-${pk}`).addClass('fa-lock-open');
                    Notify.append('포스트가 공개됩니다.');
                }
            });
        },
        changeTag: (pk) => {
            if($(`#setting-posts-${pk} form`).find('[name=tag]').val() == '') {
                Notify.append('태그를 비워둔 상태로 변경할 수 없습니다.');
                return;
            }
            $.ajax({
                url: `/api/v1/posts/${pk}`,
                type: "PUT",
                data: $(`#setting-posts-${pk} form`).serialize(),
            }).done((data) => {
                Notify.append('태그가 변경되었습니다.');
                $(`#setting-posts-${pk} form`).find('[name=tag]').val(data.tag);
            });
        },
    }
})();
const Comment = (() => {
    const url = '/api/v1/comments';
    let tempResource = '';
    return {
        reload: (element) => {
            $(`#comment-${element.pk}`).html(Render.comment(element));
            autolink($(`#comment-${element.pk}`));
        },
        write: (fk) => {
            if($('#id_text').val() == '') {
                Notify.append('댓글의 내용을 작성해주세요!');
                return;
            }
            $.ajax({
                url: `${url}?fk=${fk}`,
                type: 'POST',
                data: $('#comment-form').serialize(),
            }).done(function(data) {
                if(data.state == 'true') {
                    $('#comment').append(`<div id='comment-${data.element.pk}'>${Render.comment(data.element)}</div>`);
                    if(document.getElementById('comment-empty')) {
                        $('#comment-empty').remove();
                    }
                    $('#comment-form textarea').val('');
                    autolink($(`#comment-${data.element.pk}`));
                    User.sendTag(fk);
                }
            });
        },
        remove: function(pk) {
            if (confirm('댓글을 정말 삭제합니까?')) {
                $.ajax({
                    url: `${url}/${pk}`,
                    type: 'DELETE',
                }).done(function(data) {
                    $(`#comment-${data.pk}`).remove();
                    Notify.append('댓글이 삭제되었습니다.');
                });
            } else {
                return;
            }
        },
        edit: function(pk) {
            $.ajax({
                url: `${url}/${pk}?get=form`,
                type: 'GET',
            }).done(function(data) {
                tempResource = $(`#comment-${pk}`).html();
                $(`#comment-${pk}`).html(data);
            });
        },
        like: function(pk) {
            $.ajax({
                url: `${url}/${pk}`,
                type: 'PUT',
                data: {like: 'like'},
            }).done(function(data) {
                if(data=='error:NL') {
                    location.href='/login?next=' + location.pathname;
                }
                else if(data=='error:SU') {
                    Notify.append('자신의 댓글은 추천할 수 없습니다.')
                }
                else {
                    $(`#clc${pk}`).html(data);
                }
            });
        },
        update: (pk) => {
            $.ajax({
                url: `${url}/${pk}`,
                type: 'PUT',
                data: $(`#comment-${pk}-form`).serialize(),
            }).done((data) => {
                if(data.state == 'true') {
                    Comment.reload(data.element);
                }
            });
        },
        editCancle: (pk) => {
            $(`#comment-${pk}`).html(tempResource);
            tempResource = '';
        }
    }
})();
const Series = (() => {
    return {
        remove: (pk) => {
            if(confirm('정말 삭제하십니까?')) {
                $.ajax({
                    url: `/series/${pk}/remove`,
                    type: 'post',
                }).done((data) => {
                    if(data == 'done') {
                        alert('시리즈가 삭제되었습니다.')
                        location.href='/';
                    }
                });
            }
        }
    }
})();
const Notify = (() => {
    const url = '/api/v1/notify';
    var counter = 0;
    return {
        get: () => {
            $.ajax({
                url: url,
                type: 'get',
            }).done((data) => {
                if (data.count > 0) {
                    data.content.forEach((element) => {
                        $('#notify-content').append(Render.notify.reguler(element));
                    });
                    $('.toast').toast({
                        'autohide': false
                    });
                    $('.toast').toast('show');
                }
            });
        },
        append: (info) => {
            var pk = counter++;
            $('#notify-content').append(
                Render.notify.common({
                    pk: pk,
                    info: info
                })
            );
            $('.toast').toast({
                'delay': 3000,
            });
            $('.toast').toast('show');
            setTimeout(() => {
                $(`#pretoast${pk}`).remove();
            }, 3000);
        },
        read: (pk) => {
            $.ajax({
                url: url,
                type: 'GET',
                data: {'id': pk},
            }).done((data) => {
                $(`#toast${pk}`).remove();
            });
        }
    }
})();
const Telegram = (() => {
    const url = '/api/v1/telegram';
    return {
        pair: () => {
            $.ajax({
                url: url + '/makeToken',
                type: 'POST',
            }).done((data) => {
                $(`#telegram-token`).text(data);
            });
        },
        unpair: () => {
            $.ajax({
                url: url + '/unpair',
                type: 'POST',
            }).done((data) => {
                if(data == 'error:AU') {
                    Notify.append('텔레그램과의 연동이 이미 해제되었습니다.');
                } else {
                    Notify.append('텔레그램과의 연동이 정상적으로 해제되었습니다.');
                }
                $('#TelegramModal').modal('hide');
            });
        }
    }
})();
const User = (() => {
    const url = '/api/v1/users';
    let sendList = [];
    return {
        follow: (username) => {
            $.ajax({
                url: `${url}/${username}`,
                type: 'PUT',
                data: {follow: 'follow'},
            }).done((data) => {
                if(data=='error:NL') {
                    location.href='/login?next=' + location.pathname;
                }
                else if(data=='error:SU') {
                    Notify.append('자신은 구독할 수 없습니다.');
                }
                else {
                    $('.follow-badge').attr('src', `https://img.shields.io/badge/subscriber-${data}-red?style=social`)
                }
            });
        },
        editAbout: (username) => {
            if($('#aboutButton').hasClass('edit')) {
                $.ajax({
                    method: 'GET',
                    url: `/api/v1/users/${username}?get=about-form`,
                }).done(function (data) {
                    $('#about').html(data);
                    $('#aboutButton').text('완료');
                    $('#aboutButton').addClass('submit');
                    $('#aboutButton').removeClass('edit');
                });
            } else {
                $.ajax({
                    method: 'PUT',
                    url: `/api/v1/users/${username}`,
                    data: $('form').serialize()
                }).done(function (data) {
                    $('#about').html(data);
                    $('#aboutButton').text('편집');
                    $('#aboutButton').addClass('edit');
                    $('#aboutButton').removeClass('submit');
                });
            }
        },
        appendTag: (username) => {
            var textValue = $('#id_text').val();
            if(textValue.indexOf(username) == -1) {
                $('#id_text').val(textValue + (`@${username} `)).focus();
                if(sendList.indexOf(username) == -1) {
                    sendList.push(username);
                }
            }
        },
        sendTag: (pk) => {
            for(username of sendList) {
                $.ajax({
                    url: `${url}/${username}?on=${pk}`,
                    type: 'PUT',
                    data: {tagging: 'tagging'}
                });
            }
            sendList = [];
        }
    }
})();
const Thread = (() => {
    const url = '/api/v1/thread';
    return {
        create: () => {
            if (!document.getElementById('createThread')) {
                $.ajax({
                    url: `${url}?get=modal`,
                    type: 'GET',
                }).done(function (data) {
                    $('body').append(data);
                    $('#createThread').modal('show')
                });
            }
            else {
                $('#createThread').modal('show')
            }
        },
        edit: (pk) => {
            if (!document.getElementById('createThread')) {
                $.ajax({
                    url: url + '/' + pk + '?get=modal',
                    type: 'GET',
                }).done((data) => {
                    $('body').append(data);
                    $('#createThread').modal('show');
                });
            }
            else {
                $('#createThread').modal('show');
            }
        },
        remove: (pk) => {
            if (confirm('정말 스레드를 삭제합니까?')) {
                $.ajax({
                    url: `${url}/${pk}`,
                    type: 'DELETE',
                }).done((data) => {
                    if (data == 'DONE') {
                        if(document.getElementById(`setting-thread-${pk}`)) {
                            Notify.append('스레드가 삭제되었습니다.');
                            $('#setting-thread-' + pk).remove();
                        } else {
                            alert('스레드가 삭제되었습니다.')
                            location.href = '/';
                        }
                    }
                });
            }
        },
        lock: (pk) => {
            $.ajax({
                url: `${url}/${pk}`,
                type: "PUT",
                data: {hide: 'changed'}
            }).done(function (data) {
                if(data.hide) {
                    $(`#lock-${pk}`).removeClass('fa-lock-open');
                    $(`#lock-${pk}`).addClass('fa-lock');
                    Notify.append('스레드가 숨겨집니다.');
                } else {
                    $(`#lock-${pk}`).removeClass('fa-lock');
                    $(`#lock-${pk}`).addClass('fa-lock-open');
                    Notify.append('스레드가 공개됩니다.');
                }
            });
        },
        changeTag: (pk) => {
            if($(`#setting-thread-${pk} form`).find('[name=tag]').val() == '') {
                Notify.append('태그를 비워둔 상태로 변경할 수 없습니다.');
                return;
            }
            $.ajax({
                url: `${url}/${pk}`,
                type: "PUT",
                data: $(`#setting-thread-${pk} form`).serialize(),
            }).done(function (data) {
                Notify.append('태그가 변경되었습니다.');
                $(`#setting-thread-${pk} form`).find('[name=tag]').val(data.tag);
            });
        },
    }
})();
const Story = (() => {
    const url = '/api/v1/story';
    let tempResource = '';
    return {
        write: (fk) => {
            if($('#id_title').val() == '') {
                Notify.append('스토리의 제목을 입력하세요.');
                return;
            }
            if($('#id_text_md').val() == '') {
                Notify.append('스토리의 내용을 입력하세요.');
                return;
            }
            $.ajax({
                url: `${url}?fk=${fk}`,
                type: 'POST',
                data: $('#story-form').serialize(),
            }).done((data) => {
                if(document.getElementById('story-empty')) {
                    $('#story-empty').remove();
                }
                $('#story-form input').val('');
                $('#story-form textarea').val('');
                $('#story').prepend(`<div id='story-${data.element.pk}'>${Render.story(data.element)}</div>`);
            });
        },
        edit: (pk) => {
            tempResource = $('#story-' + pk).html();
            $.ajax({
                url: `${url}/${pk}?get=form`,
                type: 'GET',
            }).done((data) => {
                moveSlide('story-' + pk);
                $('#story-' + pk).html(data);
            });
        },
        editCancle: (pk) => {
            $(`#story-${pk}`).html(tempResource);
            tempResource = '';
        },
        update: (pk) => {
            $.ajax({
                type: 'PUT',
                url: `${url}/${pk}`,
                data: $(`#story-${pk}-form`).serialize(),
            }).done((data) => {
                if (data.state == 'true') {
                    $(`#story-${pk}`).html(Render.story(data.element));
                }
            });
        },
        remove: (pk) => {
            if (confirm('정말 스토리를 삭제합니까?')) {
                $.ajax({
                    url: `${url}/${pk}`,
                    type: 'DELETE',
                }).done((data) => {
                    if (data == 'DONE') {
                        $(`#story-${pk}`).remove();
                        Notify.append('스토리가 삭제되었습니다.')
                    }
                });
            }
        }
    }
})();