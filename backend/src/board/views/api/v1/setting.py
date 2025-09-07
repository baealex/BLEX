import datetime
import json

from django.contrib import auth
from django.db.models import (
    Q, F, Count, Case, When, Sum, Subquery, OuterRef)
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from board.constants.config_meta import CONFIG_TYPE
from board.models import (
    User, RefererFrom, Series, Post, UserLinkMeta,
    PostAnalytics, TempPosts, Profile, Notify)
from board.modules.paginator import Paginator
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.time import convert_to_localtime


def setting(request, parameter):
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    user = get_object_or_404(
        User.objects.select_related(
            'config',
            'profile'
        ),
        username=request.user
    )

    if request.method == 'GET':
        if parameter == 'notify':
            six_months_ago = timezone.now() - datetime.timedelta(days=180)
            notify = Notify.objects.filter(user=user).filter(
                Q(created_date__gt=six_months_ago) |
                Q(has_read=False)
            ).order_by('-created_date')

            return StatusDone({
                'notify': list(map(lambda item: {
                    'id': item.id,
                    'url': item.url,
                    'is_read': item.has_read,
                    'content': item.content,
                    'created_date': item.time_since()
                }, notify)),
                'is_telegram_sync': request.user.config.has_telegram_id()
            })
        
        if parameter == 'notify-config':
            configs = [
                CONFIG_TYPE.NOTIFY_POSTS_LIKE,
                CONFIG_TYPE.NOTIFY_POSTS_COMMENT,
                CONFIG_TYPE.NOTIFY_POSTS_THANKS,
                CONFIG_TYPE.NOTIFY_POSTS_NO_THANKS,
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE,
                CONFIG_TYPE.NOTIFY_FOLLOW,
                CONFIG_TYPE.NOTIFY_MENTION,
            ]
            return StatusDone({
                'config': list(map(lambda config: {
                    'name': config.value,
                    'value': user.config.get_meta(config)
                }, configs))
            })

        if parameter == 'account':
            return StatusDone({
                'username': user.username,
                'name': user.first_name,
                'email': user.email,
                'created_date': convert_to_localtime(user.date_joined).strftime('%Y년 %m월 %d일'),
            })

        if parameter == 'profile':
            return StatusDone({
                'avatar': user.profile.get_thumbnail(),
                'bio': user.profile.bio,
                'homepage': user.profile.homepage,
                'social': user.profile.collect_social(),
            })

        if parameter == 'posts':
            posts = Post.objects.select_related(
                'config', 'series',
            ).prefetch_related(
                'tags', 'likes', 'comments'
            ).filter(
                author=user,
                created_date__lte=timezone.now(),
            ).annotate(
                today_count=Subquery(
                    PostAnalytics.objects.filter(
                        post__id=OuterRef('id'),
                        created_date=timezone.now(),
                    ).values('post__id').annotate(
                        count=Count('devices')
                    ).values('count')
                ),
                yesterday_count=Subquery(
                    PostAnalytics.objects.filter(
                        post__id=OuterRef('id'),
                        created_date=timezone.now() - datetime.timedelta(days=1),
                    ).values('post__id').annotate(
                        count=Count('devices')
                    ).values('count')
                ),
            ).order_by('-created_date')

            tag = request.GET.get('tag', '')
            if tag:
                posts = posts.filter(tags__value=tag)
            
            series = request.GET.get('series', '')
            if series:
                posts = posts.filter(series__url=series)

            search = request.GET.get('search', '')
            if search:
                posts = posts.filter(title__icontains=search)

            valid_orders = [
                'title',
                'read_time',
                'created_date',
                'updated_date',
                'count_likes',
                'count_comments',
                'today_count',
                'yesterday_count',
                'hide',
            ]
            order = request.GET.get('order', '')
            if order:
                is_valid = False
                for valid_order in valid_orders:
                    if order == valid_order or order == '-' + valid_order:
                        is_valid = True
                if not is_valid:
                    raise Http404

                if order == 'hide':
                    order = 'config__hide'
                elif order == '-hide':
                    order = '-config__hide'
                elif order == 'count_likes':
                    order = 'likes__count'
                elif order == '-count_likes':
                    order = '-likes__count'
                elif order == 'count_comments':
                    order = 'comments__count'
                elif order == '-count_comments':
                    order = '-comments__count'

                posts = posts.order_by(order)

            posts = Paginator(
                objects=posts,
                offset=10,
                page=request.GET.get('page', 1)
            )
            return StatusDone({
                'username': request.user.username,
                'posts': list(map(lambda post: {
                    'url': post.url,
                    'title': post.title,
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y-%m-%d'),
                    'updated_date': convert_to_localtime(post.updated_date).strftime('%Y-%m-%d'),
                    'is_hide': post.config.hide,
                    'count_likes': post.likes.count(),
                    'count_comments': post.comments.count(),
                    'today_count': post.today_count if post.today_count else 0,
                    'yesterday_count': post.yesterday_count if post.yesterday_count else 0,
                    'read_time': post.read_time,
                    'tag': ','.join(post.tagging()),
                    'series': post.series.url if post.series else '',
                }, posts)),
                'last_page': posts.paginator.num_pages,
            })

        if parameter == 'reserved-posts':
            posts = Post.objects.select_related(
                'config'
            ).filter(
                author=user,
                created_date__gt=timezone.now(),
            ).order_by('-created_date')

            posts = Paginator(
                objects=posts,
                offset=10,
                page=request.GET.get('page', 1)
            )
            return StatusDone({
                'username': request.user.username,
                'posts': list(map(lambda post: {
                    'url': post.url,
                    'title': post.title,
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y-%m-%d %H:%M'),
                }, posts)),
                'last_page': posts.paginator.num_pages,
            })

        if parameter == 'temp-posts':
            posts = TempPosts.objects.filter(
                created_date__lte=timezone.now(),
                author=user,
            ).order_by('-created_date')

            posts = Paginator(
                objects=posts,
                offset=10,
                page=request.GET.get('page', 1)
            )
            return StatusDone({
                'username': request.user.username,
                'posts': list(map(lambda post: {
                    'token': post.token,
                    'title': post.title,
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y-%m-%d'),
                    'updated_date': convert_to_localtime(post.updated_date).strftime('%Y-%m-%d'),
                    'tag': post.tag,
                }, posts)),
                'last_page': posts.paginator.num_pages,
            })
    
        if parameter == 'tag':
            tags = Post.objects.filter(
                author=user
            ).values(
                'tags__value'
            ).annotate(
                count=Count('tags__value')
            ).order_by('-count')

            return StatusDone({
                'username': user.username,
                'tags': list(map(lambda tag: {
                    'name': tag['tags__value'],
                    'count': tag['count']
                }, tags))
            })

        if parameter == 'series':
            series_items = Series.objects.filter(
                owner=user
            ).annotate(
                total_posts=Count('posts')
            ).order_by('order', '-id')
            return StatusDone({
                'username': user.username,
                'series': list(map(lambda series_item: {
                    'id': series_item.id,
                    'url': series_item.url,
                    'title': series_item.name,
                    'total_posts': series_item.total_posts
                }, series_items))
            })

        if parameter == 'analytics-posts-view':
            date = request.GET.get('date', timezone.now().strftime('%Y-%m-%d'))
            posts = Post.objects.filter(author=user).annotate(
                author_username=F('author__username'),
                today_count=Count(
                    Case(
                        When(
                            analytics__created_date=parse_datetime(date),
                            then='analytics__devices'
                        )
                    ), distinct=True
                ),
                yesterday_count=Count(
                    Case(
                        When(
                            analytics__created_date=parse_datetime(date) - datetime.timedelta(days=1),
                            then='analytics__devices'
                        )
                    ), distinct=True
                )
            ).order_by('-today_count', '-yesterday_count', '-created_date')[:8]

            return StatusDone({
                'posts': list(map(lambda item: {
                    'id': item.id,
                    'url': item.url,
                    'title': item.title,
                    'author': item.author_username,
                    'today_count': item.today_count,
                    'increase_count': item.today_count - item.yesterday_count,
                }, posts))
            })

        if parameter == 'analytics-view':
            one_month = 30
            one_month_ago = convert_to_localtime(
                timezone.now() - datetime.timedelta(days=one_month))

            post_analytics = PostAnalytics.objects.values(
                'created_date',
            ).annotate(
                table_count=Count('devices', distinct=True),
            ).filter(
                post__author=user,
                created_date__gt=one_month_ago,
            ).order_by('-created_date')

            date_dict = dict()
            for i in range(one_month):
                key = str(convert_to_localtime(
                    timezone.now() - datetime.timedelta(days=i)))[:10]
                date_dict[key] = 0

            for item in post_analytics:
                key = str(item['created_date'])[:10]
                date_dict[key] = item['table_count']

            total = PostAnalytics.objects.filter(
                post__author=user
            ).aggregate(
                sum=Count('devices', distinct=True)
            )['sum']

            return StatusDone({
                'username': user.username,
                'views': list(map(lambda item: {
                    'date': item,
                    'count': date_dict[item]
                }, date_dict)),
                'total': total if total else 0
            })

        if parameter == 'analytics-referer':
            one_year_ago = timezone.now() - datetime.timedelta(days=365)

            referers = RefererFrom.objects.filter(
                referers__post__author=user,
                referers__created_date__gt=one_year_ago,
            ).annotate(
                post_title=F('referers__post__title'),
                post_author=F('referers__post__author__username'),
                post_url=F('referers__post__url')
            ).exclude(
                Q(title__contains='검색') |
                Q(title__contains='Bing') |
                Q(title__contains='Info') |
                Q(title__contains='Google') |
                Q(title__contains='Search') |
                Q(title__contains='DuckDuckGo') |
                Q(location__contains='link.php') |
                Q(location__contains='link.naver.com')
            ).order_by('-created_date').distinct()[:12]

            return StatusDone({
                'referers': list(map(lambda referer: {
                    'time': convert_to_localtime(referer.created_date).strftime('%Y-%m-%d %H:%M'),
                    'title': referer.title,
                    'url': referer.location,
                    'image': referer.image,
                    'description': referer.description,
                    'posts': {
                        'author': referer.post_author,
                        'title': referer.post_title,
                        'url': referer.post_url
                    }
                }, referers))
            })

        if parameter == 'integration-telegram':
            if request.user.config.has_telegram_id():
                return StatusDone({
                    'is_connected': True,
                })
            return StatusDone({
                'is_connected': False,
            })

    if request.method == 'POST':
        if parameter == 'avatar':
            profile = Profile.objects.get(user=user)
            profile.avatar = request.FILES['avatar']
            profile.save()
            return StatusDone({
                'url': profile.get_thumbnail(),
            })

    if request.method == 'PUT':
        # Try to parse JSON first, fallback to QueryDict
        try:
            put_data = json.loads(request.body.decode('utf-8')) if request.body else {}
            put = type('QueryDict', (), {
                'get': lambda self, key, default='': put_data.get(key, default)
            })()
        except (json.JSONDecodeError, UnicodeDecodeError):
            put = QueryDict(request.body)

        if parameter == 'notify':
            id = put.get('id')

            notify = Notify.objects.filter(id=id)
            if not notify.exists():
                return StatusError(ErrorCode.NOT_FOUND, '알림을 찾을 수 없습니다.')

            notify = notify.first()
            notify.has_read = True
            notify.save()
            return StatusDone()

        if parameter == 'notify-config':
            configs = [
                CONFIG_TYPE.NOTIFY_POSTS_LIKE,
                CONFIG_TYPE.NOTIFY_POSTS_COMMENT,
                CONFIG_TYPE.NOTIFY_POSTS_THANKS,
                CONFIG_TYPE.NOTIFY_POSTS_NO_THANKS,
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE,
                CONFIG_TYPE.NOTIFY_FOLLOW,
                CONFIG_TYPE.NOTIFY_MENTION,
            ]
            for config in configs:
                user.config.create_or_update_meta(
                    config, put.get(config.value, ''))

            return StatusDone()

        if parameter == 'account':
            should_update = False

            name = put.get('name', '')
            password = put.get('password', '')

            if name and user.first_name != name:
                user.first_name = name
                should_update = True

            if password:
                if len(password) < 8:
                    return StatusError(ErrorCode.VALIDATE, '비밀번호는 8자 이상이어야 합니다.')

                if not any(x.isdigit() for x in password):
                    return StatusError(ErrorCode.VALIDATE, '비밀번호는 숫자를 포함해야 합니다.')

                if not any(x.islower() for x in password):
                    return StatusError(ErrorCode.VALIDATE, '비밀번호는 소문자를 포함해야 합니다.')

                if not any(x.isupper() for x in password):
                    return StatusError(ErrorCode.VALIDATE, '비밀번호는 대문자를 포함해야 합니다.')

                if not any(not x.isupper() and not x.islower() and not x.isdigit() for x in password):
                    return StatusError(ErrorCode.VALIDATE, '비밀번호는 특수문자를 포함해야 합니다.')

                user.set_password(password)
                auth.login(request, user)
                should_update = True

            if should_update:
                user.save()

            return StatusDone()

        if parameter == 'profile':
            profile = Profile.objects.get(user=user)

            attrs = [
                'bio',
                'homepage',
            ]
            for attr in attrs:
                setattr(profile, attr, put.get(attr, ''))

            profile.save()
            return StatusDone()
    
        if parameter == 'social':
            update_items = put.get('update', '')
            for update_item in update_items.split('&'):
                if not update_item:
                    continue

                [id, name, value, order] = update_item.split(',')
                UserLinkMeta.objects.update_or_create(
                    user=user,
                    id=id,
                    defaults={
                        'name': name,
                        'value': value,
                        'order': order,
                    }
                )                
            
            create_items = put.get('create', '')
            for create_item in create_items.split('&'):
                if not create_item:
                    continue

                [name, value, order] = create_item.split(',')
                UserLinkMeta.objects.create(
                    user=user,
                    name=name,
                    value=value,
                    order=order,
                )

            delete_items = put.get('delete', '')
            for delete_item in delete_items.split('&'):
                if not delete_item:
                    continue

                UserLinkMeta.objects.filter(
                    user=user,
                    id=delete_item,
                ).delete()
            
            return StatusDone(user.profile.collect_social())

    raise Http404
