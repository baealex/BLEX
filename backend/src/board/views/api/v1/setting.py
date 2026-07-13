import json

from django.contrib import auth
from django.http import Http404, HttpRequest
from django.shortcuts import get_object_or_404
from board.models import (
    User, LoginSetting,
    Profile, Notify)
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.time import convert_to_localtime
from board.services.auth_service import AuthService, AuthValidationError
from board.services.api_permission_service import ApiPermissionService
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.integration_setting_service import IntegrationSettingService
from board.services.pinned_post_service import PinnedPostService, PinnedPostError
from board.services.setting_post_management_service import (
    PostManagementQuery,
    PostManagementQueryError,
    SettingPostManagementService,
)
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


POST_MANAGEMENT_ORDERS = SettingPostManagementService.POST_MANAGEMENT_ORDERS


def get_post_management_queryset(user, *, scheduled=False):
    return SettingPostManagementService.get_post_management_queryset(
        user,
        scheduled=scheduled,
    )


def _parse_post_management_query(request: HttpRequest) -> PostManagementQuery:
    try:
        page = int(request.GET.get('page', 1))
    except (TypeError, ValueError):
        raise Http404 from None

    if page < 1:
        raise Http404

    return PostManagementQuery(
        tag=request.GET.get('tag', ''),
        series=request.GET.get('series', ''),
        search=request.GET.get('search', ''),
        visibility=request.GET.get('visibility', ''),
        order=request.GET.get('order', ''),
        page=page,
    )


def apply_post_management_filters(posts, request):
    query = PostManagementQuery(
        tag=request.GET.get('tag', ''),
        series=request.GET.get('series', ''),
        search=request.GET.get('search', ''),
        visibility=request.GET.get('visibility', ''),
    )
    return SettingPostManagementService.apply_post_management_filters(posts, query)


def apply_post_management_order(posts, request):
    query = PostManagementQuery(order=request.GET.get('order', ''))
    try:
        return SettingPostManagementService.apply_post_management_order(posts, query)
    except PostManagementQueryError:
        raise Http404 from None


def paginate_post_management_posts(posts, request, total_count):
    try:
        page = int(request.GET.get('page', 1))
    except (TypeError, ValueError):
        raise Http404 from None

    try:
        return SettingPostManagementService.paginate_post_management_posts(
            posts,
            page,
            total_count,
        )
    except PostManagementQueryError:
        raise Http404 from None


def serialize_post_management_post(post, *, date_format):
    return SettingPostManagementService.serialize_post_management_post(
        post,
        date_format=date_format,
    )


def get_post_management_response(request, user, *, scheduled=False):
    query = _parse_post_management_query(request)
    try:
        data = SettingPostManagementService.get_post_management_data(
            user,
            query,
            username=request.user.username,
            scheduled=scheduled,
        )
    except PostManagementQueryError:
        raise Http404 from None

    return StatusDone(data)


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
                login_setting = LoginSetting.get_instance()
                deletion_redirect_url = login_setting.account_deletion_redirect_url or ''
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
            return StatusDone(
                SettingPostManagementService.get_tag_management_data(user)
            )

        if parameter == 'series':
            return StatusDone(
                SettingPostManagementService.get_series_management_data(user)
            )

        if parameter == 'integration-telegram':
            return StatusDone(IntegrationSettingService.serialize_user_telegram_status(request.user))

        if parameter == 'pinned-posts':
            pinned_posts = PinnedPostService.get_user_pinned_posts(user)
            return StatusDone({
                'pinned_posts': pinned_posts,
                'username': user.username,
                'max_count': PinnedPostService.MAX_PINNED_POSTS,
            })

        if parameter == 'pinnable-posts':
            try:
                pinnable_posts = PinnedPostService.get_pinnable_posts(
                    user,
                    query=request.GET.get('q', ''),
                    limit=request.GET.get('limit'),
                    page=request.GET.get('page'),
                )
                return StatusDone(pinnable_posts)
            except PinnedPostError as e:
                return StatusError(e.code, e.message)

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
            delete = ApiRequestBodyService.parse_json_or_querydict(request)
            post_url = delete.get('post_url', '')
            if not post_url:
                return StatusError(ErrorCode.INVALID_PARAMETER, '포스트 URL이 필요합니다.')

            try:
                PinnedPostService.remove_pinned_post(user, post_url)
                return StatusDone()
            except PinnedPostError as e:
                return StatusError(e.code, e.message)

    if request.method == 'PUT':
        put = ApiRequestBodyService.parse_json_or_querydict(request)

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
            post_urls_data = put.get('post_urls', '[]')

            try:
                post_urls = json.loads(post_urls_data) if isinstance(post_urls_data, str) else post_urls_data
            except (TypeError, json.JSONDecodeError):
                return StatusError(ErrorCode.INVALID_PARAMETER, '잘못된 형식입니다.')

            if not isinstance(post_urls, list):
                return StatusError(ErrorCode.INVALID_PARAMETER, '잘못된 형식입니다.')

            try:
                PinnedPostService.reorder_pinned_posts(user, post_urls)
                return StatusDone()
            except PinnedPostError as e:
                return StatusError(e.code, e.message)

    raise Http404
