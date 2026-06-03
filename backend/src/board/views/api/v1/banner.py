from django.http import Http404
from django.shortcuts import get_object_or_404

from board.models import SiteContentScope
from board.modules.response import StatusDone, StatusError
from board.services.api_permission_service import ApiPermissionService
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.site_content_api_service import (
    SiteContentApiError,
    SiteContentApiService,
)


def _user_banner_queryset(user):
    return SiteContentApiService.scoped_banner_queryset(SiteContentScope.USER, user)


def _banner_error(error: SiteContentApiError):
    return StatusError(error.code, error.message)


def banner(request, banner_id=None):
    permission_error = ApiPermissionService.require_editor(request.user)
    if permission_error:
        return permission_error

    user = request.user
    queryset = _user_banner_queryset(user)

    if request.method == 'GET' and banner_id is None:
        banners = queryset.order_by('order', '-created_date')
        return StatusDone({
            'banners': [
                SiteContentApiService.serialize_banner(item)
                for item in banners
            ]
        })

    if request.method == 'GET' and banner_id:
        banner_item = get_object_or_404(queryset, id=banner_id)
        return StatusDone(SiteContentApiService.serialize_banner(banner_item))

    if request.method == 'POST':
        post_data, body_error = ApiRequestBodyService.parse_json_or_error(request)
        if body_error:
            return body_error

        try:
            banner_item = SiteContentApiService.create_banner(
                SiteContentScope.USER,
                user,
                post_data,
                sanitize_content=True,
            )
        except SiteContentApiError as error:
            return _banner_error(error)

        return StatusDone(SiteContentApiService.serialize_banner(banner_item))

    if request.method == 'PUT' and banner_id:
        banner_item = get_object_or_404(queryset, id=banner_id)
        put_data = ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)

        try:
            SiteContentApiService.update_banner(
                banner_item,
                put_data,
                sanitize_content=True,
            )
        except SiteContentApiError as error:
            return _banner_error(error)

        return StatusDone(SiteContentApiService.serialize_banner(banner_item))

    if request.method == 'DELETE' and banner_id:
        banner_item = get_object_or_404(queryset, id=banner_id)
        banner_item.delete()
        return StatusDone({'message': '배너가 삭제되었습니다.'})

    raise Http404


def banner_order(request):
    permission_error = ApiPermissionService.require_editor(request.user)
    if permission_error:
        return permission_error

    if request.method != 'PUT':
        raise Http404

    put_data, body_error = ApiRequestBodyService.parse_json_or_error(request)
    if body_error:
        return body_error

    SiteContentApiService.update_banner_order(
        SiteContentScope.USER,
        request.user,
        put_data.get('order', []),
    )
    return StatusDone({'message': '배너 순서가 업데이트되었습니다.'})
