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
                        Notify.append('포스트가 정상적으로 삭제되었습니다.');
                        select('#item-' + pk).remove();
                    } else {
                        Notify.append('포스트가 정상적으로 삭제되었습니다.');
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
                let count = 0;
                for(let key in data.data) {
                    count += Number(data.data[key]);
                }
                let option = {
                    type: 'heatmap',
                    title: count + ' activity in the last year',
                    data: {
                        dataPoints: data.data,
                    },
                    width: 800,
                    countLabel: 'Activity',
                    discreteDomains: 0,
                }
                if(select('body').hasClass('dark')) {
                    option['colors'] = ['#14120f', '#391b74', '#843690', '#dc65c4', '#e69ed8'];
                }
                new frappe.Chart("#heatmap", option);
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

                    am4core.ready(function () {
                        if(select('body').hasClass('dark')) {
                            am4core.useTheme(am4themes_dark);
                        } else {
                            am4core.useTheme(am4themes_dataviz);
                        }
                
                        var chart = am4core.create(`chart-${pk}`, am4charts.XYChart);
                
                        chart.data = data.items;
                        chart.dateFormatter.inputDateFormat = "yyyy-MM-dd";
                
                        var dateAxis = chart.xAxes.push(new am4charts.DateAxis());
                        var valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
                
                        var series = chart.series.push(new am4charts.LineSeries());
                        series.dataFields.valueY = "count";
                        series.dataFields.dateX = "date";
                        series.tooltipText = "{count}"
                        series.strokeWidth = 2;
                        series.minBulletDistance = 15;
                
                        series.tooltip.background.cornerRadius = 20;
                        series.tooltip.background.strokeOpacity = 0;
                        series.tooltip.pointerOrientation = "vertical";
                        series.tooltip.label.minWidth = 40;
                        series.tooltip.label.minHeight = 40;
                        series.tooltip.label.textAlign = "middle";
                        series.tooltip.label.textValign = "middle";
                
                        var bullet = series.bullets.push(new am4charts.CircleBullet());
                        bullet.circle.strokeWidth = 2;
                        bullet.circle.radius = 4;
                        bullet.circle.fill = am4core.color("#fff");
                
                        var bullethover = bullet.states.create("hover");
                        bullethover.properties.scale = 1.3;
                
                        chart.cursor = new am4charts.XYCursor();
                        chart.cursor.behavior = "panXY";
                        chart.cursor.xAxis = dateAxis;
                        chart.cursor.snapToSeries = series;
                
                        chart.scrollbarX = new am4charts.XYChartScrollbar();
                        chart.scrollbarX.series.push(series);
                        chart.scrollbarX.parent = chart.bottomAxesContainer;
                
                        dateAxis.start = 0.5;
                        dateAxis.keepSelection = true;
                    });

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