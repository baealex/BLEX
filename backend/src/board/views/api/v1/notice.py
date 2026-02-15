import json
from django.http import Http404
from django.shortcuts import get_object_or_404
from board.models import SiteNotice, SiteContentScope
from board.modules.response import StatusDone, StatusError, ErrorCode


def notices(request, notice_id=None):
    """
    User Notice CRUD API endpoint (editor only)

    GET /v1/notices - List all notices for current user
    POST /v1/notices - Create new notice
    GET /v1/notices/<id> - Get notice details
    PUT /v1/notices/<id> - Update notice
    DELETE /v1/notices/<id> - Delete notice
    """
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if not request.user.profile.is_editor():
        return StatusError(ErrorCode.REJECT, '에디터 권한이 필요합니다.')

    user = request.user

    qs = SiteNotice.objects.filter(
        scope=SiteContentScope.USER,
        user=user,
    )

    # List all notices
    if request.method == 'GET' and notice_id is None:
        notice_list = qs.order_by('-created_date')

        return StatusDone({
            'notices': list(map(lambda notice: {
                'id': notice.id,
                'title': notice.title,
                'url': notice.url,
                'is_active': notice.is_active,
                'created_date': notice.created_date.isoformat(),
                'updated_date': notice.updated_date.isoformat(),
            }, notice_list))
        })

    # Get single notice
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

    # Create new notice
    if request.method == 'POST':
        try:
            post_data = json.loads(request.body.decode('utf-8')) if request.body else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            return StatusError(ErrorCode.VALIDATE, '잘못된 요청입니다.')

        title = post_data.get('title', '')
        url = post_data.get('url', '')
        is_active = post_data.get('is_active', True)

        if not title:
            return StatusError(ErrorCode.VALIDATE, '공지 제목을 입력해주세요.')

        if not url:
            return StatusError(ErrorCode.VALIDATE, 'URL을 입력해주세요.')

        notice = SiteNotice.objects.create(
            scope=SiteContentScope.USER,
            user=user,
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

    # Update notice
    if request.method == 'PUT' and notice_id:
        notice = get_object_or_404(qs, id=notice_id)

        try:
            put_data = json.loads(request.body.decode('utf-8')) if request.body else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            put_data = {}

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

    # Delete notice
    if request.method == 'DELETE' and notice_id:
        notice = get_object_or_404(qs, id=notice_id)
        notice.delete()

        return StatusDone({'message': '공지가 삭제되었습니다.'})

    raise Http404
