import json

from django.contrib import auth
from django.db.models import Count
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from board.models import (
    User, Series, Post, SiteSetting,
    Profile, Notify)
from board.modules.paginator import Paginator
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.time import convert_to_localtime
from board.services.auth_service import AuthService, AuthValidationError
from board.services.pinned_post_service import PinnedPostService, PinnedPostError
from board.services.user_heatmap_service import UserHeatmapService
from board.services.user_notification_service import UserNotificationService
from board.services.user_social_link_service import UserSocialLinkService


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
            return StatusDone(UserNotificationService.get_settings_notify(user))

        if parameter == 'unread-notify':
            unread_count = Notify.objects.filter(
                user=user,
                has_read=False
            ).count()

            return StatusDone({
                'count': unread_count
            })

        if parameter == 'notify-config':
            return StatusDone(UserNotificationService.get_settings_notify_config(user))

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
            return StatusDone(UserHeatmapService.get_settings_heatmap(user))

        if parameter == 'profile':
            return StatusDone({
                'avatar': user.profile.get_thumbnail(),
                'cover': user.profile.cover.url if user.profile.cover else None,
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
                published_date__isnull=False,
                published_date__lte=timezone.now(),
            ).order_by('-published_date')

            tag = request.GET.get('tag', '')
            if tag:
                posts = posts.filter(tags__value=tag)
            
            series = request.GET.get('series', '')
            if series:
                posts = posts.filter(series__url=series)

            search = request.GET.get('search', '')
            if search:
                posts = posts.filter(title__icontains=search)

            visibility = request.GET.get('visibility', '')
            if visibility == 'public':
                posts = posts.filter(config__hide=False)
            elif visibility == 'hidden':
                posts = posts.filter(config__hide=True)

            valid_orders = [
                'title',
                'read_time',
                'published_date',
                'updated_date',
                'count_likes',
                'count_comments',
            ]
            order = request.GET.get('order', '')
            if order:
                is_valid = False
                for valid_order in valid_orders:
                    if order == valid_order or order == '-' + valid_order:
                        is_valid = True
                if not is_valid:
                    raise Http404

                if order == 'count_likes':
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
                    'created_date': convert_to_localtime(post.published_date).strftime('%Y-%m-%d'),
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
                published_date__isnull=False,
                published_date__gt=timezone.now(),
            ).order_by('-published_date')

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
                    'created_date': convert_to_localtime(post.published_date).strftime('%Y-%m-%d %H:%M'),
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

        if parameter == 'pinned-posts':
            pinned_posts = PinnedPostService.get_user_pinned_posts(user)
            return StatusDone({
                'pinned_posts': pinned_posts,
                'username': user.username,
                'max_count': PinnedPostService.MAX_PINNED_POSTS,
            })

        if parameter == 'pinnable-posts':
            posts = PinnedPostService.get_pinnable_posts(user)
            return StatusDone({
                'posts': posts,
            })

    if request.method == 'POST':
        if parameter == 'avatar':
            profile = Profile.objects.get(user=user)
            profile.avatar = request.FILES['avatar']
            profile.save()
            return StatusDone({
                'url': profile.get_thumbnail(),
            })

        if parameter == 'cover':
            profile = Profile.objects.get(user=user)
            profile.cover = request.FILES['cover']
            profile.save()
            return StatusDone({
                'url': profile.cover.url if profile.cover else None,
            })

        if parameter == 'pinned-posts':
            post_url = request.POST.get('post_url', '')
            if not post_url:
                return StatusError(ErrorCode.INVALID_PARAMETER, '글 URL이 필요합니다.')

            try:
                PinnedPostService.add_pinned_post(user, post_url)
                return StatusDone()
            except PinnedPostError as e:
                return StatusError(e.code, e.message)

    if request.method == 'DELETE':
        if parameter == 'pinned-posts':
            delete = QueryDict(request.body)
            post_url = delete.get('post_url', '')
            if not post_url:
                return StatusError(ErrorCode.INVALID_PARAMETER, '글 URL이 필요합니다.')

            try:
                PinnedPostService.remove_pinned_post(user, post_url)
                return StatusDone()
            except PinnedPostError as e:
                return StatusError(e.code, e.message)

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

            if not UserNotificationService.mark_notification_as_read(user, id):
                return StatusError(ErrorCode.NOT_FOUND, '알림을 찾을 수 없습니다.')

            return StatusDone()

        if parameter == 'notify-config':
            UserNotificationService.update_settings_notify_config(user, put)
            return StatusDone()

        if parameter == 'account':
            should_update = False

            username = put.get('username', '')
            name = put.get('name', '')
            password = put.get('password', '')

            if username and user.username != username:
                try:
                    AuthService.validate_username_change_restriction(user)
                    AuthService.change_username(user, username, create_log=True)
                    should_update = False
                except AuthValidationError as e:
                    return StatusError(e.code, e.message)

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
            return StatusDone(UserSocialLinkService.update_user_social_links(user, put))

        if parameter == 'pinned-posts/order':
            post_urls_str = put.get('post_urls', '[]')

            try:
                post_urls = json.loads(post_urls_str)
            except json.JSONDecodeError:
                return StatusError(ErrorCode.INVALID_PARAMETER, '잘못된 형식입니다.')

            if not isinstance(post_urls, list):
                return StatusError(ErrorCode.INVALID_PARAMETER, '잘못된 형식입니다.')

            try:
                PinnedPostService.reorder_pinned_posts(user, post_urls)
                return StatusDone()
            except PinnedPostError as e:
                return StatusError(e.code, e.message)

    raise Http404
