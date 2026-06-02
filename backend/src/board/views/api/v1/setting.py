import json

from django.contrib import auth
from django.db.models import Count
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from board.models import (
    User, Series, Post, SiteSetting,
    Profile, Notify)
from board.modules.paginator import Paginator
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.time import convert_to_localtime
from board.services.auth_service import AuthService, AuthValidationError
from board.services.api_permission_service import ApiPermissionService
from board.services.pinned_post_service import PinnedPostService, PinnedPostError
from board.services.user_heatmap_service import UserHeatmapService
from board.services.user_notification_service import UserNotificationService
from board.services.user_social_link_service import UserSocialLinkService


EDITOR_SETTING_PARAMETERS = {
    'posts',
    'reserved-posts',
    'tag',
    'series',
    'pinned-posts',
    'pinnable-posts',
    'pinned-posts/order',
}


POST_MANAGEMENT_ORDERS = {
    'title',
    'read_time',
    'published_date',
    'updated_date',
    'count_likes',
    'count_comments',
}


def get_post_management_queryset(user, *, scheduled=False):
    now = timezone.now()
    published_date_filter = {
        'published_date__isnull': False,
        'published_date__gt' if scheduled else 'published_date__lte': now,
    }

    return Post.objects.select_related(
        'config', 'series',
    ).prefetch_related(
        'tags'
    ).annotate(
        count_likes=Count('likes', distinct=True),
        count_comments=Count('comments', distinct=True),
    ).filter(
        author=user,
        **published_date_filter,
    ).order_by('-published_date')


def apply_post_management_filters(posts, request):
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

    return posts


def apply_post_management_order(posts, request):
    order = request.GET.get('order', '')
    if not order:
        return posts

    normalized_order = order[1:] if order.startswith('-') else order
    if normalized_order not in POST_MANAGEMENT_ORDERS:
        raise Http404

    return posts.order_by(order)


def paginate_post_management_posts(posts, request):
    try:
        page = int(request.GET.get('page', 1))
    except (TypeError, ValueError):
        raise Http404

    if page < 1:
        raise Http404

    if not posts.exists():
        if page > 1:
            raise Http404
        return [], 1

    page_posts = Paginator(
        objects=posts,
        offset=10,
        page=page
    )
    return page_posts, page_posts.paginator.num_pages


def serialize_post_management_post(post, *, date_format):
    count_likes = getattr(post, 'count_likes', None)
    if count_likes is None:
        count_likes = post.likes.count()

    count_comments = getattr(post, 'count_comments', None)
    if count_comments is None:
        count_comments = post.comments.count()

    return {
        'url': post.url,
        'title': post.title,
        'image': str(post.image) if post.image else None,
        'created_date': convert_to_localtime(post.published_date).strftime(date_format),
        'updated_date': convert_to_localtime(post.updated_date).strftime('%Y-%m-%d'),
        'is_hide': post.config.hide,
        'count_likes': count_likes,
        'count_comments': count_comments,
        'read_time': post.read_time,
        'tag': ','.join(post.tagging()),
        'series': post.series.url if post.series else '',
    }


def get_post_management_response(request, user, *, scheduled=False):
    posts = get_post_management_queryset(user, scheduled=scheduled)
    posts = apply_post_management_filters(posts, request)
    posts = apply_post_management_order(posts, request)
    page_posts, last_page = paginate_post_management_posts(posts, request)
    date_format = '%Y-%m-%d %H:%M' if scheduled else '%Y-%m-%d'

    return StatusDone({
        'username': request.user.username,
        'posts': [
            serialize_post_management_post(post, date_format=date_format)
            for post in page_posts
        ],
        'last_page': last_page,
    })


def setting(request, parameter):
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if parameter in EDITOR_SETTING_PARAMETERS:
        permission_error = ApiPermissionService.require_editor(request.user)
        if permission_error:
            return permission_error

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
            return get_post_management_response(request, user)

        if parameter == 'reserved-posts':
            return get_post_management_response(request, user, scheduled=True)

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
                return StatusError(ErrorCode.INVALID_PARAMETER, '포스트 URL이 필요합니다.')

            try:
                PinnedPostService.add_pinned_post(user, post_url)
                return StatusDone()
            except PinnedPostError as e:
                return StatusError(e.code, e.message)

    if request.method == 'DELETE':
        if parameter == 'cover':
            profile = Profile.objects.get(user=user)
            if profile.cover:
                profile.cover.delete(save=False)
                profile.cover = None
                profile.save(update_fields=['cover'])

            return StatusDone({
                'url': None,
            })

        if parameter == 'pinned-posts':
            delete = QueryDict(request.body)
            post_url = delete.get('post_url', '')
            if not post_url:
                return StatusError(ErrorCode.INVALID_PARAMETER, '포스트 URL이 필요합니다.')

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
