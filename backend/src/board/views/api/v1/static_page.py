from django.http import Http404
from django.shortcuts import get_object_or_404

from board.models import StaticPage
from board.modules.response import StatusDone, StatusError
from board.services.api_permission_service import ApiPermissionService
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.site_content_api_service import (
    SiteContentApiError,
    SiteContentApiService,
)


def static_pages(request, page_id=None):
    permission_error = ApiPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    if request.method == 'GET' and page_id is None:
        pages = StaticPage.objects.all().order_by('order', '-created_date')
        return StatusDone({
            'pages': [
                SiteContentApiService.serialize_static_page(page)
                for page in pages
            ]
        })

    if request.method == 'GET' and page_id:
        page = get_object_or_404(StaticPage, id=page_id)
        return StatusDone(SiteContentApiService.serialize_static_page(page))

    if request.method == 'POST':
        post_data, body_error = ApiRequestBodyService.parse_json_or_error(request)
        if body_error:
            return body_error

        try:
            page = SiteContentApiService.create_static_page(request.user, post_data)
        except SiteContentApiError as error:
            return StatusError(error.code, error.message)

        return StatusDone(SiteContentApiService.serialize_static_page(page))

    if request.method == 'PUT' and page_id:
        page = get_object_or_404(StaticPage, id=page_id)
        put_data = ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)

        try:
            SiteContentApiService.update_static_page(page, put_data)
        except SiteContentApiError as error:
            return StatusError(error.code, error.message)

        return StatusDone(SiteContentApiService.serialize_static_page(page))

    if request.method == 'DELETE' and page_id:
        page = get_object_or_404(StaticPage, id=page_id)
        page.delete()
        return StatusDone({'message': '정적 페이지가 삭제되었습니다.'})

    raise Http404
