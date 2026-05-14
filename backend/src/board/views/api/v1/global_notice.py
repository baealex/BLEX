from django.http import Http404
from django.shortcuts import get_object_or_404
from board.models import SiteNotice, SiteContentScope
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.api_permission_service import ApiPermissionService


def global_notices(request, notice_id=None):
    """
    GlobalNotice CRUD API endpoint (staff only)

    GET /v1/global-notices - List all global notices
    POST /v1/global-notices - Create new global notice
    GET /v1/global-notices/<id> - Get global notice details
    PUT /v1/global-notices/<id> - Update global notice
    DELETE /v1/global-notices/<id> - Delete global notice
    """
    permission_error = ApiPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    qs = SiteNotice.objects.filter(
        scope=SiteContentScope.GLOBAL,
    )

    # List all global notices
    if request.method == 'GET' and notice_id is None:
        notices = qs.order_by('-created_date')

        return StatusDone({
            'notices': list(map(lambda notice: {
                'id': notice.id,
                'title': notice.title,
                'url': notice.url,
                'is_active': notice.is_active,
                'created_date': notice.created_date.isoformat(),
                'updated_date': notice.updated_date.isoformat(),
            }, notices))
        })

    # Get single global notice
    if request.method == 'GET' and notice_id:
        notice = get_object_or_404(qs, id=notice_id)

        return StatusDone({
            'id': notice.id,
            'title': notice.title,
            'url': notice.url,
            'is_active': notice.is_active,
            'created_date': notice.created_date.isoformat(),
            'updated_date': notice.updated_date.isoformat(),
        })

    # Create new global notice
    if request.method == 'POST':
        post_data, body_error = ApiRequestBodyService.parse_json_or_error(request)
        if body_error:
            return body_error

        title = post_data.get('title', '')
        url = post_data.get('url', '')
        is_active = post_data.get('is_active', True)

        if not title:
            return StatusError(ErrorCode.VALIDATE, '공지 제목을 입력해주세요.')

        if not url:
            return StatusError(ErrorCode.VALIDATE, 'URL을 입력해주세요.')

        notice = SiteNotice.objects.create(
            scope=SiteContentScope.GLOBAL,
            title=title,
            url=url,
            is_active=is_active,
        )

        return StatusDone({
            'id': notice.id,
            'title': notice.title,
            'url': notice.url,
            'is_active': notice.is_active,
            'created_date': notice.created_date.isoformat(),
            'updated_date': notice.updated_date.isoformat(),
        })

    # Update global notice
    if request.method == 'PUT' and notice_id:
        notice = get_object_or_404(qs, id=notice_id)

        put_data = ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)

        if 'title' in put_data:
            notice.title = put_data['title']

        if 'url' in put_data:
            notice.url = put_data['url']

        if 'is_active' in put_data:
            notice.is_active = put_data['is_active']

        notice.save()

        return StatusDone({
            'id': notice.id,
            'title': notice.title,
            'url': notice.url,
            'is_active': notice.is_active,
            'created_date': notice.created_date.isoformat(),
            'updated_date': notice.updated_date.isoformat(),
        })

    # Delete global notice
    if request.method == 'DELETE' and notice_id:
        notice = get_object_or_404(qs, id=notice_id)
        notice.delete()

        return StatusDone({'message': '공지가 삭제되었습니다.'})

    raise Http404
