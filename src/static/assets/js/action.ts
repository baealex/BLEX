var Posts = (function() {
    var url = '/api/v1/posts';
    var isWait = false;

    return {
        like: function(pk) {
            if(isWait) {
                Notify.append('잠시 후 다시 사용할 수 있습니다.');
                return;
            }
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
                    isWait = true;
                    setTimeout(function() {
                        isWait = false;
                    }, 1000 * 60);
                    var heart = select('#heart i');
                    if(heart.hasClass('fas')) {
                        heart.removeClass('fas');
                        heart.addClass('far');
                    } else {
                        heart.removeClass('far');
                        heart.addClass('fas');
                    }
                    select('#like-count').text(data);
                }
            });
        },
        remove: function(pk) {
            if(confirm('정말 삭제하십니까?')){
                $.ajax({
                    url: `${url}/${pk}`,
                    type: 'DELETE',
                }).done(function (data) {
                    if(document.getElementById(`item-${pk}`)) {
                        Notify.append('포스트가 삭제되었습니다.');
                        select('#item-' + pk).remove();
                    } else {
                        alert('포스트가 삭제되었습니다.')
                        location.href = '/';
                    }
                });
            }
        },
        lock: function(pk) {
            $.ajax({
                url: `/api/v1/posts/${pk}`,
                type: "PUT",
                data: {hide: 'changed'}
            }).done(function(data) {
                var lock = select(`#item-${pk} .element-lock i`);
                if(data.hide) {
                    lock.removeClass('fa-lock-open');
                    lock.addClass('fa-lock');
                    Notify.append('포스트가 숨겨집니다.');
                } else {
                    lock.removeClass('fa-lock');
                    lock.addClass('fa-lock-open');
                    Notify.append('포스트가 공개됩니다.');
                }
            });
        },
        changeTag: function(pk) {
            if($(`#item-${pk} form`).find('[name=tag]').val() == '') {
                Notify.append('태그를 비워둔 상태로 변경할 수 없습니다.');
                return;
            }
            $.ajax({
                url: `/api/v1/posts/${pk}`,
                type: "PUT",
                data: $(`#item-${pk} form`).serialize(),
            }).done(function(data) {
                Notify.append('태그가 변경되었습니다.');
                $(`#item-${pk} form`).find('[name=tag]').val(data.tag);
            });
        },
    }
})();
var Comment = (function() {
    var url = '/api/v1/comments';
    var tempResource = '';
    var isWait = false;

    return {
        reload: function(element) {
            select(`#comment-${element.pk}`).html(Render.comment(element));
            safeExternal('#comment a');
        },
        write: function(fk) {
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
                    select('#comment').append(`<div id='comment-${data.element.pk}'>${Render.comment(data.element)}</div>`);
                    if(document.getElementById('comment-empty')) {
                        select('#comment-empty').remove();
                    }
                    select('#comment-form textarea').val('');
                    safeExternal('#comment a');
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
                    select(`#comment-${data.pk}`).remove();
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
                select(`#comment-${pk}`).html(data);
            });
        },
        like: function(pk) {
            if(isWait) {
                Notify.append('잠시 후 다시 사용할 수 있습니다.');
                return;
            }
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
                    isWait = true;
                    setTimeout(function() {
                        isWait = false;
                    }, 1000 * 60);
                    $(`#clc${pk}`).html(data);
                }
            });
        },
        update: function(pk) {
            $.ajax({
                url: `${url}/${pk}`,
                type: 'PUT',
                data: $(`#comment-${pk}-form`).serialize(),
            }).done(function(data) {
                if(data.state == 'true') {
                    Comment.reload(data.element);
                }
            });
        },
        editCancle: function(pk) {
            select(`#comment-${pk}`).html(tempResource);
            tempResource = '';
        }
    }
})();
var Series = (function() {
    var url = '/api/v1/series';
    return {
        edit: function(pk) {
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
        remove: function(pk) {
            if(confirm('정말 삭제하십니까?')) {
                $.ajax({
                    url: `${url}/${pk}`,
                    type: 'DELETE',
                }).done(function(data) {
                    if(data == 'DONE') {
                        alert('시리즈가 삭제되었습니다.')
                        location.href = '/';
                    }
                });
            }
        }
    }
})();
var Notify = (function() {
    var url = '/api/v1/users';
    var counter = 0;
    return {
        get: function(username) {
            $.ajax({
                url: `${url}/${username}`,
                type: 'GET',
                data: {'get': 'notify'},
            }).done(function(data) {
                if (data.count > 0) {
                    data.content.forEach(function(element) {
                        select('#notify-content').append(Render.notify.reguler(element));
                    });
                    $('.toast').toast({
                        'autohide': false
                    });
                    $('.toast').toast('show');
                }
            });
        },
        append: function(info) {
            var pk = counter++;
            $('#notify-content').append(
                Render.notify.common({
                    pk: pk,
                    info: info
                })
            );
            $('.toast').toast({
                'delay': 4000,
            });
            $('.toast').toast('show');
            setTimeout(function() {
                select(`#pretoast${pk}`).remove();
            }, 4000);
        },
        read: function(username, pk) {
            $.ajax({
                url: `${url}/${username}`,
                type: 'GET',
                data: {
                    'get': 'notify',
                    'id': pk,
                },
            }).done(function(data) {
                select(`#toast${pk}`).remove();
            });
        },
        go: function(username, pk) {
            $.ajax({
                url: `${url}/${username}`,
                type: 'GET',
                data: {
                    'get': 'notify',
                    'id': pk,
                },
            }).done(function(data) {
                location.href = data;
            });
        }
    }
})();
var Telegram = (function() {
    var url = '/api/v1/telegram';
    return {
        pair: function() {
            $.ajax({
                url: url + '/makeToken',
                type: 'POST',
            }).done(function(data) {
                select(`#telegram-token`).text(data);
            });
        },
        unpair: function() {
            $.ajax({
                url: url + '/unpair',
                type: 'POST',
            }).done(function(data) {
                location.reload();
            });
        }
    }
})();
var User = (function() {
    var url = '/api/v1/users';
    var sendList = [];
    return {
        activity: function(username) {
            $.ajax({
                url: `${url}/${username}`,
                type: 'GET',
                data: {get: 'activity'},
            }).done(function(data) {
                var count = 0;
                for(var key in data.data) {
                    count += Number(data.data[key]);
                }
                new frappe.Chart("#heatmap", {
                    type: 'heatmap',
                    title: count + ' activity in the last year',
                    data: {
                        dataPoints: data.data,
                    },
                    width: 800,
                    countLabel: 'Activity',
                    discreteDomains: 0,
                });
            });
        },
        follow: function(username) {
            $.ajax({
                url: `${url}/${username}`,
                type: 'PUT',
                data: {follow: 'follow'},
            }).done(function(data) {
                if(data=='error:NL') {
                    Notify.append(msg.login);
                }
                else if(data=='error:SU') {
                    Notify.append('자신은 구독할 수 없습니다.');
                }
                else {
                    select('#user-follow').text(data);
                }
            });
        },
        editAbout: function(username) {
            if($('#aboutButton').hasClass('edit')) {
                $.ajax({
                    method: 'GET',
                    url: `/api/v1/users/${username}?get=about-form`,
                }).done(function (data) {
                    select('#about').html(data);
                    var btn = select('#aboutButton');
                    btn.text('완료');
                    btn.addClass('submit');
                    btn.removeClass('edit');
                });
            } else {
                $.ajax({
                    method: 'PUT',
                    url: `/api/v1/users/${username}`,
                    data: $('form').serialize()
                }).done(function (data) {
                    select('#about').html(data);
                    var btn = select('#aboutButton');
                    btn.text('편집');
                    btn.addClass('edit');
                    btn.removeClass('submit');
                });
            }
        },
        appendTag: function(username) {
            var textValue = $('#id_text').val();
            if(textValue.indexOf(username) == -1) {
                $('#id_text').val(textValue + (`@${username} `)).focus();
                if(sendList.indexOf(username) == -1) {
                    sendList.push(username);
                }
            }
        },
        sendTag: function(pk) {
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
var Thread = (function() {
    var url = '/api/v1/thread';
    var isWait = false;

    return {
        create: function() {
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
        edit: function(pk) {
            if (!document.getElementById('thread-modal')) {
                $.ajax({
                    url: url + '/' + pk + '?get=modal',
                    type: 'GET',
                }).done(function(data) {
                    $('body').append(data);
                    $('#thread-modal').modal('show');
                });
            }
            else {
                $('#thread-modal').modal('show');
            }
        },
        remove: function(pk) {
            if (confirm('정말 스레드를 삭제합니까?')) {
                $.ajax({
                    url: `${url}/${pk}`,
                    type: 'DELETE',
                }).done(function(data) {
                    if (data == 'DONE') {
                        if(document.getElementById(`item-${pk}`)) {
                            Notify.append('스레드가 삭제되었습니다.');
                            select('#item-' + pk).remove();
                        } else {
                            alert('스레드가 삭제되었습니다.');
                            location.href = '/';
                        }
                    }
                });
            }
        },
        lock: function(pk) {
            $.ajax({
                url: `${url}/${pk}`,
                type: "PUT",
                data: {hide: 'changed'}
            }).done(function (data) {
                var lock = select(`#item-${pk} .element-lock i`);
                if(data.hide) {
                    lock.removeClass('fa-lock-open');
                    lock.addClass('fa-lock');
                    Notify.append('스레드가 숨겨집니다.');
                } else {
                    lock.removeClass('fa-lock');
                    lock.addClass('fa-lock-open');
                    Notify.append('스레드가 공개됩니다.');
                }
            });
        },
        changeTag: function(pk) {
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
        bookmark: function(pk) {
            if(isWait) {
                Notify.append('잠시 후 다시 사용할 수 있습니다.');
                return;
            }
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
                    if(select(`#bookmark`).hasClass('far')) {
                        select(`#bookmark`).removeClass('far');
                        select(`#bookmark`).addClass('fas');
                        Notify.append('스레드를 북마크합니다.');
                    }
                    else {
                        select(`#bookmark`).removeClass('fas');
                        select(`#bookmark`).addClass('far');
                        Notify.append('스레드 북마크를 해제합니다.');
                    }
                    isWait = true;
                    setTimeout(function() {
                        isWait = false;
                    }, 1000 * 60);
                }
            });
        },
    }
})();
var Story = (function() {
    var url = '/api/v1/story';
    var isWait = {
        agree: false,
        disagree: false,
    }

    var imageActive = function() {
        var uploadImage = function(formData) {
            var cursorPos = $('#id_text_md').prop('selectionStart');
            var text = $('#id_text_md').val();
            var textBefore = text.substring(0,  cursorPos);
            var textAfter  = text.substring(cursorPos, text.length);

            $('#id_text_md').val(textBefore + '[Image Upload...]()' + textAfter);
            text = $('#id_text_md').val();

            $.ajax({
                url: '/upload/image',
                type: 'POST',
                data: formData,
                contentType: false,
                cache: false,
                processData: false,
            }).done(function (data) {
                var result = '';
                if(data.includes('.mp4')) {
                    result = `@gif[${data}]`;
                } else {
                    result = `![](${data})`;
                }
                $('#id_text_md').val(text.replace('[Image Upload...]()', result));
            }).fail(function () {
                Notify.append('이미지 업로드에 실패했습니다.');
            });
        };

        $('#image-upload-button').on('click', function(e) {
            e.preventDefault();
            $('#image-form > input').click();
        });

        $('#id_text_md').on("drop", async function(e) {
            e.stopPropagation();
            e.preventDefault();
            e.dataTransfer = e.originalEvent.dataTransfer;
            var files = e.target.files || e.dataTransfer.files;
            if(files.length > 1) {
                Notify.append('하나씩 업로드 할 수 있습니다.');
                return;
            }
            if(!files[0].type.match(/image.*/)) {
                Notify.append('이미지 파일이 아닙니다.');
                return;
            }
            var formData = new FormData();
            formData.append('image', files[0]);
            await uploadImage(formData);
        });
        
        $('#image-form > input').on('change', async function() {
            var imageForm = document.getElementById('image-form');
            var formData = new FormData(imageForm);
            await uploadImage(formData);
            $('#image-form > input').val('');
        });
    }
    return {
        create: function(fk) {
            if(document.getElementById('story-modal')) {
                $('#story-modal').remove();
            }
            $.ajax({
                url: `${url}?get=modal&fk=${fk}`,
                type: 'GET',
            }).done(function(data) {
                $('body').append(data);
                $('#story-modal').modal('show');
                imageActive();
            });
        },
        write: function(fk) {
            if($('#id_title').val() == '') {
                Notify.append('스토리의 제목을 입력하세요.');
                return;
            }
            if($('#id_text_md').val() == '') {
                Notify.append('스토리의 내용을 입력하세요.');
                return;
            }
            loading(true);
            $.ajax({
                url: `${url}?fk=${fk}`,
                type: 'POST',
                data: $('#story-modal #story-form').serialize(),
            }).done(function(data) {
                location.replace(data.redirect);
            });
        },
        edit: function(pk) {
            if(document.getElementById('story-modal')) {
                select('#story-modal').remove();
            }
            $.ajax({
                url: `${url}/${pk}?get=modal`,
                type: 'GET',
            }).done(function(data) {
                $('body').append(data);
                $('#story-modal').modal('show');
                imageActive();
            });
        },
        update: function(pk) {
            loading(true);
            $.ajax({
                type: 'PUT',
                url: `${url}/${pk}`,
                data: $('#story-modal #story-form').serialize(),
            }).done(function(data) {
                if (data.state == 'true') {
                    location.reload();
                }
            });
        },
        remove: function(pk) {
            if (confirm('정말 스토리를 삭제합니까?')) {
                $.ajax({
                    url: `${url}/${pk}`,
                    type: 'DELETE',
                }).done(function(data) {
                    location.replace(data);
                });
            }
        },
        agree: function(pk) {
            if(isWait.agree) {
                Notify.append('잠시 후 다시 사용할 수 있습니다.');
                return;
            }
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
                    select(`.agree span`).text(data);
                    isWait.agree = true;
                    setTimeout(function() {
                        isWait.agree = false;
                    }, 1000 * 60);
                }
            });
        },
        disagree: function(pk) {
            if(isWait.disagree) {
                Notify.append('잠시 후 다시 사용할 수 있습니다.');
                return;
            }
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
                    $(`.disagree span`).text(data);
                    isWait.disagree = true;
                    setTimeout(function() {
                        isWait.disagree = false;
                    }, 1000 * 60);
                }
            });
        }
    }
})();
var Analytics = (function() {
    var postsList = undefined;
    var threadList = undefined;
    var renderHTML = undefined;
    var url = '/api/v1/users';
    return {
        get: function(username, type) {
            $.ajax({
                url: `${url}/${username}?get=${type}`,
                type: 'GET',
            }).done(function(data) {
                type == 'posts_analytics' ? postsList = data.posts : threadList = data.thread;
                renderHTML = '';
                for(var ele of type == 'posts_analytics' ? postsList : threadList) {
                    renderHTML += Render.analytics.element(ele, type);
                }
                select('#analytics').html(renderHTML);
            });
        },
        modal: function(username, type, pk) {
            if(document.getElementById(`item-${pk}-detail`)) {
                $(`#item-${pk}-detail`).modal('show');
            } else {
                $.ajax({
                    url: `${url}/${username}?get=${type}&pk=${pk}`,
                    type: 'GET',
                }).done(function(data) {
                    data.items.reverse();
                    
                    $('body').append(Render.analytics.modal(data.referers, pk));
                    $(`#item-${pk}-detail`).modal('show');
                    
                    makeChart(data.items, 'chart-' + pk);
                    safeExternal(`#item-${pk}-detail a`);
                });
            }
        },
        sort: function(sort, type) {
            var sortHow = function(a, b) {
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
            for(var ele of type == 'posts_analytics' ? postsList : threadList) {
                renderHTML += Render.analytics.element(ele, type);
            }
            select('#analytics').html(renderHTML);
        },
    }
})();