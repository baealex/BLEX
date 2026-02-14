import json
from django.http import Http404
from django.shortcuts import get_object_or_404
from board.models import GlobalBanner
from board.modules.response import StatusDone, StatusError, ErrorCode


def _serialize_global_banner(banner):
    return {
        'id': banner.id,
        'title': banner.title,
        'content_html': banner.content_html,
        'banner_type': banner.banner_type,
        'position': banner.position,
        'is_active': banner.is_active,
        'order': banner.order,
        'created_by': banner.created_by.username if banner.created_by else None,
        'created_date': banner.created_date.isoformat(),
        'updated_date': banner.updated_date.isoformat(),
    }


def global_banners(request, banner_id=None):
    """
    GlobalBanner CRUD API endpoint (staff only)

    GET /v1/global-banners - List all global banners
    POST /v1/global-banners - Create new global banner
    GET /v1/global-banners/<id> - Get global banner details
    PUT /v1/global-banners/<id> - Update global banner
    DELETE /v1/global-banners/<id> - Delete global banner
    """
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if not request.user.is_staff:
        return StatusError(ErrorCode.REJECT, '관리자 권한이 필요합니다.')

    # List all global banners
    if request.method == 'GET' and banner_id is None:
        banners = GlobalBanner.objects.all().order_by('order', '-created_date')

        return StatusDone({
            'banners': list(map(_serialize_global_banner, banners))
        })

    # Get single global banner
    if request.method == 'GET' and banner_id:
        banner = get_object_or_404(GlobalBanner, id=banner_id)

        return StatusDone(_serialize_global_banner(banner))

    # Create new global banner
    if request.method == 'POST':
        try:
            post_data = json.loads(request.body.decode('utf-8')) if request.body else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            return StatusError(ErrorCode.VALIDATE, '잘못된 요청입니다.')

        title = post_data.get('title', '')
        content_html = post_data.get('content_html', '')
        banner_type = post_data.get('banner_type', 'horizontal')
        position = post_data.get('position', 'top')
        is_active = post_data.get('is_active', True)
        order = post_data.get('order', 0)

        if not title:
            return StatusError(ErrorCode.VALIDATE, '배너 이름을 입력해주세요.')

        if not content_html:
            return StatusError(ErrorCode.VALIDATE, '배너 내용을 입력해주세요.')

        # Validate banner type and position compatibility
        if banner_type == 'horizontal' and position not in ['top', 'bottom']:
            return StatusError(ErrorCode.VALIDATE, '줄배너는 상단 또는 하단에만 배치할 수 있습니다.')

        if banner_type == 'sidebar' and position not in ['left', 'right']:
            return StatusError(ErrorCode.VALIDATE, '사이드배너는 좌측 또는 우측에만 배치할 수 있습니다.')

        banner = GlobalBanner.objects.create(
            title=title,
            content_html=content_html,
            banner_type=banner_type,
            position=position,
            is_active=is_active,
            order=order,
            created_by=request.user,
        )

        return StatusDone(_serialize_global_banner(banner))

    # Update global banner
    if request.method == 'PUT' and banner_id:
        banner = get_object_or_404(GlobalBanner, id=banner_id)

        try:
            put_data = json.loads(request.body.decode('utf-8')) if request.body else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            put_data = {}

        if 'title' in put_data:
            banner.title = put_data['title']

        if 'content_html' in put_data:
            banner.content_html = put_data['content_html']

        if 'banner_type' in put_data:
            banner.banner_type = put_data['banner_type']

        if 'position' in put_data:
            banner.position = put_data['position']

        if 'is_active' in put_data:
            banner.is_active = put_data['is_active']

        if 'order' in put_data:
            banner.order = put_data['order']

        # Validate
        if banner.banner_type == 'horizontal' and banner.position not in ['top', 'bottom']:
            return StatusError(ErrorCode.VALIDATE, '줄배너는 상단 또는 하단에만 배치할 수 있습니다.')

        if banner.banner_type == 'sidebar' and banner.position not in ['left', 'right']:
            return StatusError(ErrorCode.VALIDATE, '사이드배너는 좌측 또는 우측에만 배치할 수 있습니다.')

        banner.save()

        return StatusDone(_serialize_global_banner(banner))

    # Delete global banner
    if request.method == 'DELETE' and banner_id:
        banner = get_object_or_404(GlobalBanner, id=banner_id)
        banner.delete()

        return StatusDone({'message': '글로벌 배너가 삭제되었습니다.'})

    raise Http404


def global_banner_order(request):
    """
    Update global banner order

    PUT /v1/global-banners/order
    Body: { order: [[id1, order1], [id2, order2], ...] }
    """
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if not request.user.is_staff:
        return StatusError(ErrorCode.REJECT, '관리자 권한이 필요합니다.')

    if request.method != 'PUT':
        raise Http404

    try:
        put_data = json.loads(request.body.decode('utf-8')) if request.body else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return StatusError(ErrorCode.VALIDATE, '잘못된 요청입니다.')

    order_list = put_data.get('order', [])

    for item in order_list:
        if len(item) != 2:
            continue

        banner_id, order = item
        try:
            banner = GlobalBanner.objects.get(id=banner_id)
            banner.order = order
            banner.save()
        except GlobalBanner.DoesNotExist:
            continue

    return StatusDone({'message': '글로벌 배너 순서가 업데이트되었습니다.'})
