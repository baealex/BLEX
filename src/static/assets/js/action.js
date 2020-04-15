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
                    Notify.append(msg.login);
                }
                else if(data=='error:SU') {
                    Notify.append('자신의 글은 추천할 수 없습니다.');
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
            });
        },
        remove: (pk) => {
            if(confirm('정말 삭제하십니까?')){
                $.ajax({
                    url: `${url}/${pk}`,
                    type: 'DELETE',
                }).done(function (data) {
                    if(document.getElementById(`item-${pk}`)) {
                        Notify.append('포스트가 삭제되었습니다.');
                        $('#item-' + pk).remove();
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
                    $(`#item-${pk} .element-lock i`).removeClass('fa-lock-open');
                    $(`#item-${pk} .element-lock i`).addClass('fa-lock');
                    Notify.append('포스트가 숨겨집니다.');
                } else {
                    $(`#item-${pk} .element-lock i`).removeClass('fa-lock');
                    $(`#item-${pk} .element-lock i`).addClass('fa-lock-open');
                    Notify.append('포스트가 공개됩니다.');
                }
            });
        },
        changeTag: (pk) => {
            if($(`#item-${pk} form`).find('[name=tag]').val() == '') {
                Notify.append('태그를 비워둔 상태로 변경할 수 없습니다.');
                return;
            }
            $.ajax({
                url: `/api/v1/posts/${pk}`,
                type: "PUT",
                data: $(`#item-${pk} form`).serialize(),
            }).done((data) => {
                Notify.append('태그가 변경되었습니다.');
                $(`#item-${pk} form`).find('[name=tag]').val(data.tag);
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
                    Notify.append(msg.login);
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
    const url = '/api/v1/series';
    return {
        edit: (pk) => {
            if (!document.getElementById('series-modal')) {
                $.ajax({
                    url: `${url}/${pk}?get=modal`,
                    type: 'GET',
                }).done(function (data) {
                    $('body').append(data);
                    $('#series-modal').modal('show');
                });
            }
            else {
                $('#series-modal').modal('show');
            }
        },
        remove: (pk) => {
            if(confirm('정말 삭제하십니까?')) {
                $.ajax({
                    url: `${url}/${pk}`,
                    type: 'DELETE',
                }).done((data) => {
                    if(data == 'DONE') {
                        alert('시리즈가 삭제되었습니다.')
                        location.href = '/';
                    }
                });
            }
        }
    }
})();
const Notify = (() => {
    const url = '/api/v1/users';
    var counter = 0;
    return {
        get: (username) => {
            $.ajax({
                url: `${url}/${username}`,
                type: 'GET',
                data: {'get': 'notify'},
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
        read: (username, pk) => {
            $.ajax({
                url: `${url}/${username}`,
                type: 'GET',
                data: {
                    'get': 'notify',
                    'id': pk,
                },
            }).done((data) => {
                $(`#toast${pk}`).remove();
            });
        },
        go: (username, pk) => {
            $.ajax({
                url: `${url}/${username}`,
                type: 'GET',
                data: {
                    'get': 'notify',
                    'id': pk,
                },
            }).done((data) => {
                location.href = data;
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
                $('#telegram-modal').modal('hide');
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
                    Notify.append(msg.login);
                }
                else if(data=='error:SU') {
                    Notify.append('자신은 구독할 수 없습니다.');
                }
                else {
                    $('#user-follow').text(data);
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
            if (!document.getElementById('thread-modal')) {
                $.ajax({
                    url: `${url}?get=modal`,
                    type: 'GET',
                }).done(function (data) {
                    $('body').append(data);
                    $('#thread-modal').modal('show')
                });
            }
            else {
                $('#thread-modal').modal('show')
            }
        },
        edit: (pk) => {
            if (!document.getElementById('thread-modal')) {
                $.ajax({
                    url: url + '/' + pk + '?get=modal',
                    type: 'GET',
                }).done((data) => {
                    $('body').append(data);
                    $('#thread-modal').modal('show');
                });
            }
            else {
                $('#thread-modal').modal('show');
            }
        },
        remove: (pk) => {
            if (confirm('정말 스레드를 삭제합니까?')) {
                $.ajax({
                    url: `${url}/${pk}`,
                    type: 'DELETE',
                }).done((data) => {
                    if (data == 'DONE') {
                        if(document.getElementById(`item-${pk}`)) {
                            Notify.append('스레드가 삭제되었습니다.');
                            $('#item-' + pk).remove();
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
                    $(`#item-${pk} .element-lock i`).removeClass('fa-lock-open');
                    $(`#item-${pk} .element-lock i`).addClass('fa-lock');
                    Notify.append('스레드가 숨겨집니다.');
                } else {
                    $(`#item-${pk} .element-lock i`).removeClass('fa-lock');
                    $(`#item-${pk} .element-lock i`).addClass('fa-lock-open');
                    Notify.append('스레드가 공개됩니다.');
                }
            });
        },
        changeTag: (pk) => {
            if($(`#item-${pk} form`).find('[name=tag]').val() == '') {
                Notify.append('태그를 비워둔 상태로 변경할 수 없습니다.');
                return;
            }
            $.ajax({
                url: `${url}/${pk}`,
                type: "PUT",
                data: $(`#item-${pk} form`).serialize(),
            }).done(function (data) {
                Notify.append('태그가 변경되었습니다.');
                $(`#item-${pk} form`).find('[name=tag]').val(data.tag);
            });
        },
        bookmark: (pk) => {
            $.ajax({
                url: `${url}/${pk}`,
                type: "PUT",
                data: {bookmark: 'bookmark'}
            }).done(function (data) {
                if(data == 'error:NL') {
                    Notify.append(msg.login);
                }
                else if(data == 'error:SU') {
                    Notify.append('타인 참여가 불가능한 본인의 스레드는 북마크할 수 없습니다.');
                }
                else {
                    if($(`#bookmark`).hasClass('far')) {
                        $(`#bookmark`).removeClass('far');
                        $(`#bookmark`).addClass('fas');
                        Notify.append('스레드를 북마크합니다.');
                    }
                    else {
                        $(`#bookmark`).removeClass('fas');
                        $(`#bookmark`).addClass('far');
                        Notify.append('스레드 북마크를 해제합니다.');
                    }
                }
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
        },
        agree: function(pk) {
            $.ajax({
                url: `${url}/${pk}`,
                type: 'PUT',
                data: {agree: 'agree'},
            }).done(function(data) {
                if(data=='error:NL') {
                    Notify.append(msg.login);
                }
                else if(data=='error:SU') {
                    Notify.append('자신의 스토리는 찬성할 수 없습니다.');
                }
                else if(data=='error:AD') {
                    Notify.append('이미 반대한 스토리입니다.');
                }
                else {
                    $(`#story-${pk} .agree span`).text(data);
                }
            });
        },
        disagree: function(pk) {
            $.ajax({
                url: `${url}/${pk}`,
                type: 'PUT',
                data: {disagree: 'disagree'},
            }).done(function(data) {
                if(data=='error:NL') {
                    Notify.append(msg.login);
                }
                else if(data=='error:SU') {
                    Notify.append('자신의 스토리는 반대할 수 없습니다.')
                }
                else if(data=='error:AA') {
                    Notify.append('이미 찬성한 스토리입니다.');
                }
                else {
                    $(`#story-${pk} .disagree span`).text(data);
                }
            });
        }
    }
})();
const Analytics = (() => {
    let postsList = undefined;
    let threadList = undefined;
    let renderHTML = undefined;
    let url = '/api/v1/users';
    return {
        get: (username, type) => {
            $.ajax({
                url: `${url}/${username}?get=${type}`,
                type: 'GET',
            }).done((data) => {
                type == 'posts_analytics' ? postsList = data.posts : threadList = data.thread;
                renderHTML = '';
                for(let ele of type == 'posts_analytics' ? postsList : threadList) {
                    renderHTML += Render.analytics.element(ele, type);
                }
                $('#analytics').html(renderHTML);
            });
        },
        modal: (username, type, pk) => {
            if(document.getElementById(`item-${pk}-detail`)) {
                $(`#item-${pk}-detail`).modal('show');
            } else {
                $.ajax({
                    url: `${url}/${username}?get=${type}&pk=${pk}`,
                    type: 'GET',
                }).done((data) => {
                    data.items.reverse();
                    
                    $('body').append(Render.analytics.modal(data.referers, pk));
                    $(`#item-${pk}-detail`).modal('show');
                    
                    makeChart(data.items, 'chart-' + pk);
                });
            }
        },
        sort: (sort, type) => {
            let sortHow = function(a, b) {
                if(a[sort] == b[sort]) {
                    return 0;
                }
                if(sort == 'title') {
                    return a[sort] < b[sort] ? -1 : 1;
                } else {
                    return a[sort] > b[sort] ? -1 : 1;
                }
            }
            renderHTML = '';
            type == 'posts_analytics' ? postsList.sort(sortHow) : threadList.sort(sortHow);
            for(let ele of type == 'posts_analytics' ? postsList : threadList) {
                renderHTML += Render.analytics.element(ele, type);
            }
            $('#analytics').html(renderHTML);
        },
    }
})();