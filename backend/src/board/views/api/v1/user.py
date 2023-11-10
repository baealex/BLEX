import datetime

from itertools import chain
from django.conf import settings
from django.db.models import F, Count, Case, When
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import (
    User, UsernameChangeLog, Post, Profile, Series,
    Comment, Follow, Tag)
from board.modules.notify import create_notify
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.time import convert_to_localtime, time_stamp
from modules.markdown import parse_to_html, ParseData


def users(request, username):
    user = get_object_or_404(User, username=username)

    if request.method == 'GET':
        if request.GET.get('includes'):
            includes = request.GET.get('includes').split(',')
            user_profile = Profile.objects.get(user=user)
            data = dict()
            for include in set(includes):
                if include == 'subscribe':
                    data[include] = {
                        'has_subscribe': Follow.objects.filter(
                            follower__id=request.user.id,
                            following=user.profile
                        ).exists()
                    }

                if include == 'profile':
                    data[include] = {
                        'image': user_profile.get_thumbnail(),
                        'username': user.username,
                        'name': user.first_name,
                        'bio': user_profile.bio,
                        'has_subscribe': Follow.objects.filter(
                            follower__id=request.user.id,
                            following=user.profile
                        ).exists()
                    }

                elif include == 'social':
                    data[include] = user_profile.collect_social()
                    data[include]['username'] = user.username

                elif include == 'heatmap':
                    standard_date = timezone.now() - datetime.timedelta(days=365)
                    posts = Post.objects.filter(
                        created_date__gte=standard_date,
                        created_date__lte=timezone.now(),
                        author=user,
                        config__hide=False
                    )
                    series = Series.objects.filter(
                        created_date__gte=standard_date,
                        created_date__lte=timezone.now(),
                        owner=user
                    )
                    comments = Comment.objects.filter(
                        created_date__gte=standard_date,
                        created_date__lte=timezone.now(),
                        author=user,
                        post__config__hide=False
                    )
                    activity = chain(posts, series, comments)

                    heatmap = dict()
                    for element in activity:
                        key = time_stamp(element.created_date,
                                         kind='grass')[:10]
                        if key in heatmap:
                            heatmap[key] += 1
                        else:
                            heatmap[key] = 1
                    data[include] = heatmap

                elif include == 'tags':
                    tags = Tag.objects.filter(
                        posts__author=user,
                        posts__config__hide=False,
                    ).annotate(
                        count=Count(
                            Case(
                                When(
                                    posts__author=user,
                                    posts__config__hide=False,
                                    then='posts'
                                ),
                            )
                        )
                    ).order_by('-count')

                    data[include] = list(map(lambda tag: {
                        'name': tag.value,
                        'count': tag.count,
                    }, tags))

                elif include == 'most':
                    posts = Post.objects.filter(
                        author=user,
                        config__hide=False,
                        config__notice=False,
                        created_date__lte=timezone.now(),
                    ).annotate(
                        author_username=F('author__username'),
                        author_image=F('author__profile__avatar'),
                        thanks_count=Count('thanks', distinct=True),
                        nothanks_count=Count('nothanks', distinct=True),
                        likes_count=Count('likes', distinct=True),
                        point=F('thanks_count') - F('nothanks_count') +
                        (F('likes_count') * 1.5)
                    ).order_by('-point', '-created_date')[:6]

                    data[include] = list(map(lambda post: {
                        'url': post.url,
                        'title': post.title,
                        'image': str(post.image),
                        'read_time': post.read_time,
                        'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                        'author_image': post.author_image,
                        'author': post.author_username,
                    }, posts))

                elif include == 'recent':
                    seven_days_ago = timezone.now() - datetime.timedelta(days=7)
                    posts = Post.objects.filter(
                        created_date__gte=seven_days_ago,
                        created_date__lte=timezone.now(),
                        author=user,
                        config__hide=False
                    ).order_by('-created_date')
                    series = Series.objects.filter(
                        created_date__gte=seven_days_ago,
                        created_date__lte=timezone.now(),
                        owner=user
                    ).order_by('-created_date')
                    comments = Comment.objects.filter(
                        created_date__gte=seven_days_ago,
                        created_date__lte=timezone.now(),
                        author=user,
                        post__config__hide=False
                    ).order_by('-created_date')
                    activity = sorted(
                        chain(posts, series, comments),
                        key=lambda instance: instance.created_date,
                        reverse=True
                    )
                    data[include] = list()
                    for active in activity:
                        active_dict = dict()
                        active_type = str(type(active))
                        if 'Post' in active_type:
                            active_dict = {
                                'type': 'edit',
                                'text': active.title
                            }
                        elif 'Comment' in active_type:
                            active_dict = {
                                'type': 'comment',
                                'text': active.post.title
                            }
                        elif 'Series' in active_type:
                            active_dict = {
                                'type': 'bookmark',
                                'text': active.name
                            }
                        active_dict['url'] = active.get_absolute_url()
                        data[include].append(active_dict)

                elif include == 'about':
                    data[include] = user_profile.about_html

            return StatusDone(data)

        if not request.user.is_active:
            return StatusError(ErrorCode.NEED_LOGIN)

        if not request.user == user:
            return StatusError(ErrorCode.AUTHENTICATION)

        if request.GET.get('get') == 'about':
            return StatusDone({
                'about_md': user.profile.about_md
            })

    if request.method == 'PUT':
        put = QueryDict(request.body)
        if put.get('follow'):
            if not request.user.is_active:
                return StatusError(ErrorCode.NEED_LOGIN)

            if request.user == user:
                return StatusError(ErrorCode.AUTHENTICATION)

            follower = User.objects.get(username=request.user)
            follow_query = Follow.objects.filter(
                follower=follower,
                following=user.profile
            )
            if follow_query.exists():
                follow_query.delete()
                return StatusDone({'has_subscribe': False})
            else:
                if user.config.get_meta('NOTIFY_FOLLOW'):
                    send_notify_content = (
                        f"@{follower.username}님께서 "
                        f"회원님을 구독하기 시작했습니다.")
                    create_notify(
                        user=user,
                        url='/setting/notify',
                        infomation=send_notify_content)
                Follow(follower=follower, following=user.profile).save()
                return StatusDone({'has_subscribe': True})

        if put.get('about'):
            if not request.user == user:
                return StatusError(ErrorCode.AUTHENTICATION)

            about_md = put.get('about_md')
            about_html = parse_to_html(settings.API_URL, ParseData.from_dict({
                'text': about_md,
                'token': settings.API_KEY,
            }))
            if hasattr(user, 'profile'):
                user.profile.about_md = about_md
                user.profile.about_html = about_html
                user.profile.save()
            else:
                profile = Profile(user=user)
                profile.about_md = about_md
                profile.about_html = about_html
                profile.save()

            return StatusDone()
    raise Http404

def check_redirect(request, username):
    if request.method == 'GET':
        if not username:
            return StatusError(ErrorCode.INVALID_PARAMETER)

        log = UsernameChangeLog.objects.filter(
            username=username
        ).annotate(
            user_username=F('user__username'),
        ).first()

        if log:
            return StatusDone({
                'old_username': log.username,
                'new_username': log.user_username,
                'created_date': convert_to_localtime(log.created_date).strftime('%Y년 %m월 %d일'),
            })
    raise Http404
