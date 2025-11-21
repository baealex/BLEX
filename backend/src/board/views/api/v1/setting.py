import datetime
import json
from collections import defaultdict
from datetime import timedelta

from django.contrib import auth
from django.core.cache import cache
from django.db.models import (
    Q, F, Count, Case, When, Sum, Subquery, OuterRef)
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from board.constants.config_meta import CONFIG_TYPE
from board.models import (
    User, Series, Post, UserLinkMeta, SiteSetting,
    TempPosts, Profile, Notify, Comment, PostLikes)
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
            # Check if user has written any posts
            has_posts = Post.objects.filter(author=user).exists()

            # Base configs for all users
            configs = [
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE,
                CONFIG_TYPE.NOTIFY_MENTION,
            ]

            # Add editor-specific configs if user has posts
            if has_posts:
                configs = [
                    CONFIG_TYPE.NOTIFY_POSTS_LIKE,
                    CONFIG_TYPE.NOTIFY_POSTS_COMMENT,
                ] + configs

            return StatusDone({
                'config': list(map(lambda config: {
                    'name': config.value,
                    'value': user.config.get_meta(config)
                }, configs))
            })

        if parameter == 'account':
            try:
                site_setting = SiteSetting.get_instance()
                deletion_redirect_url = site_setting.account_deletion_redirect_url or ''
            except Exception:
                deletion_redirect_url = ''

            return StatusDone({
                'username': user.username,
                'name': user.first_name,
                'email': user.email,
                'created_date': convert_to_localtime(user.date_joined).strftime('%Y년 %m월 %d일'),
                'account_deletion_redirect_url': deletion_redirect_url,
                'has2fa': hasattr(user, 'twofactorauth'),
            })

        if parameter == 'heatmap':
            # Try to get heatmap from cache first (cache for 1 hour)
            cache_key = f'user_heatmap_{user.id}'
            heatmap = cache.get(cache_key)

            if heatmap is None:
                # Generate heatmap data for the last year
                # Calculate date range (last 365 days)
                end_date = timezone.now().date()
                start_date = end_date - timedelta(days=365)

                # Initialize heatmap with all dates
                heatmap = defaultdict(int)

                # Fetch posts within the date range
                posts = Post.objects.filter(
                    author=user,
                    created_date__date__gte=start_date,
                    created_date__date__lte=end_date,
                ).values('created_date__date').annotate(count=Count('id'))

                for post in posts:
                    date_str = post['created_date__date'].strftime('%Y-%m-%d')
                    heatmap[date_str] += post['count']

                # Fetch comments within the date range
                comments = Comment.objects.filter(
                    author=user,
                    created_date__date__gte=start_date,
                    created_date__date__lte=end_date,
                ).values('created_date__date').annotate(count=Count('id'))

                for comment in comments:
                    date_str = comment['created_date__date'].strftime('%Y-%m-%d')
                    heatmap[date_str] += comment['count']

                # Fetch likes within the date range
                likes = PostLikes.objects.filter(
                    user=user,
                    created_date__date__gte=start_date,
                    created_date__date__lte=end_date,
                ).values('created_date__date').annotate(count=Count('id'))

                for like in likes:
                    date_str = like['created_date__date'].strftime('%Y-%m-%d')
                    heatmap[date_str] += like['count']

                # Convert to regular dict and cache for 1 hour (3600 seconds)
                heatmap = dict(heatmap)
                cache.set(cache_key, heatmap, 3600)

            return StatusDone(heatmap)

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
            # Check if user has written any posts
            has_posts = Post.objects.filter(author=user).exists()

            # Base configs for all users
            configs = [
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE,
                CONFIG_TYPE.NOTIFY_MENTION,
            ]

            # Add editor-specific configs if user has posts
            if has_posts:
                configs = [
                    CONFIG_TYPE.NOTIFY_POSTS_LIKE,
                    CONFIG_TYPE.NOTIFY_POSTS_COMMENT,
                ] + configs

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
