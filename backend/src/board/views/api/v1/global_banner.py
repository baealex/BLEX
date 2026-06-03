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


def global_banners(request, banner_id=None):
    permission_error = ApiPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    queryset = SiteContentApiService.scoped_banner_queryset(SiteContentScope.GLOBAL)

    if request.method == 'GET' and banner_id is None:
        banners = queryset.select_related('user').order_by('order', '-created_date')
        return StatusDone({
            'banners': [
                SiteContentApiService.serialize_banner(item, include_created_by=True)
                for item in banners
            ]
        })

    if request.method == 'GET' and banner_id:
        banner = get_object_or_404(queryset.select_related('user'), id=banner_id)
        return StatusDone(SiteContentApiService.serialize_banner(banner, include_created_by=True))

    if request.method == 'POST':
        post_data, body_error = ApiRequestBodyService.parse_json_or_error(request)
        if body_error:
            return body_error

        try:
            banner = SiteContentApiService.create_banner(
                SiteContentScope.GLOBAL,
                request.user,
                post_data,
                sanitize_content=False,
            )
        except SiteContentApiError as error:
            return StatusError(error.code, error.message)

        return StatusDone(SiteContentApiService.serialize_banner(banner, include_created_by=True))

    if request.method == 'PUT' and banner_id:
        banner = get_object_or_404(queryset.select_related('user'), id=banner_id)
        put_data = ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)

        try:
            SiteContentApiService.update_banner(
                banner,
                put_data,
                sanitize_content=False,
            )
        except SiteContentApiError as error:
            return StatusError(error.code, error.message)

        return StatusDone(SiteContentApiService.serialize_banner(banner, include_created_by=True))

    if request.method == 'DELETE' and banner_id:
        banner = get_object_or_404(queryset, id=banner_id)
        banner.delete()
        return StatusDone({'message': '글로벌 배너가 삭제되었습니다.'})

    raise Http404


def global_banner_order(request):
    permission_error = ApiPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    if request.method != 'PUT':
        raise Http404

    put_data, body_error = ApiRequestBodyService.parse_json_or_error(request)
    if body_error:
        return body_error

    SiteContentApiService.update_banner_order(
        SiteContentScope.GLOBAL,
        None,
        put_data.get('order', []),
    )
    return StatusDone({'message': '글로벌 배너 순서가 업데이트되었습니다.'})
