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


def global_notices(request, notice_id=None):
    permission_error = ApiPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    queryset = SiteContentApiService.scoped_notice_queryset(SiteContentScope.GLOBAL)

    if request.method == 'GET' and notice_id is None:
        notices = queryset.order_by('-created_date')
        return StatusDone({
            'notices': [
                SiteContentApiService.serialize_notice(item)
                for item in notices
            ]
        })

    if request.method == 'GET' and notice_id:
        notice = get_object_or_404(queryset, id=notice_id)
        return StatusDone(SiteContentApiService.serialize_notice(notice))

    if request.method == 'POST':
        post_data, body_error = ApiRequestBodyService.parse_json_or_error(request)
        if body_error:
            return body_error

        try:
            notice = SiteContentApiService.create_notice(
                SiteContentScope.GLOBAL,
                None,
                post_data,
            )
        except SiteContentApiError as error:
            return StatusError(error.code, error.message)

        return StatusDone(SiteContentApiService.serialize_notice(notice))

    if request.method == 'PUT' and notice_id:
        notice = get_object_or_404(queryset, id=notice_id)
        put_data = ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)
        SiteContentApiService.update_notice(notice, put_data)
        return StatusDone(SiteContentApiService.serialize_notice(notice))

    if request.method == 'DELETE' and notice_id:
        notice = get_object_or_404(queryset, id=notice_id)
        notice.delete()
        return StatusDone({'message': '공지가 삭제되었습니다.'})

    raise Http404
