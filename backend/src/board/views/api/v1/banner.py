import json
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from board.models import SiteBanner, SiteContentScope
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.html_utils import sanitize_html


def banner(request, banner_id=None):
    """
    Banner CRUD API endpoint

    GET /v1/banners - List all banners for current user
    POST /v1/banners - Create new banner
    GET /v1/banners/:id - Get banner details
    PUT /v1/banners/:id - Update banner
    DELETE /v1/banners/:id - Delete banner
    """
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    # Check if user is an editor
    if not request.user.profile.is_editor():
        return StatusError(ErrorCode.REJECT, '에디터 권한이 필요합니다.')

    user = request.user

    # List all banners
    if request.method == 'GET' and banner_id is None:
        banners = SiteBanner.objects.filter(
            scope=SiteContentScope.USER,
            user=user,
        ).order_by('order', '-created_date')

        return StatusDone({
            'banners': list(map(lambda banner: {
                'id': banner.id,
                'title': banner.title,
                'content_html': banner.content_html,
                'banner_type': banner.banner_type,
                'position': banner.position,
                'is_active': banner.is_active,
                'order': banner.order,
                'created_date': banner.created_date.isoformat(),
                'updated_date': banner.updated_date.isoformat(),
            }, banners))
        })

    # Get single banner
    if request.method == 'GET' and banner_id:
        banner = get_object_or_404(
            SiteBanner,
            id=banner_id,
            scope=SiteContentScope.USER,
            user=user,
        )

        return StatusDone({
            'id': banner.id,
            'title': banner.title,
            'content_html': banner.content_html,
            'banner_type': banner.banner_type,
            'position': banner.position,
            'is_active': banner.is_active,
            'order': banner.order,
        })

    # Create new banner
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

        # Validation
        if not title:
            return StatusError(ErrorCode.VALIDATE, '배너 이름을 입력해주세요.')

        if not content_html:
            return StatusError(ErrorCode.VALIDATE, '배너 내용을 입력해주세요.')

        # Validate banner type and position compatibility
        if banner_type == 'horizontal' and position not in ['top', 'bottom']:
            return StatusError(ErrorCode.VALIDATE, '줄배너는 상단 또는 하단에만 배치할 수 있습니다.')

        if banner_type == 'sidebar' and position not in ['left', 'right']:
            return StatusError(ErrorCode.VALIDATE, '사이드배너는 좌측 또는 우측에만 배치할 수 있습니다.')

        # Sanitize HTML content to prevent XSS
        sanitized_content = sanitize_html(content_html)

        # Create banner
        banner = SiteBanner.objects.create(
            scope=SiteContentScope.USER,
            user=user,
            title=title,
            content_html=sanitized_content,
            banner_type=banner_type,
            position=position,
            is_active=is_active,
            order=order
        )

        return StatusDone({
            'id': banner.id,
            'title': banner.title,
            'content_html': banner.content_html,
            'banner_type': banner.banner_type,
            'position': banner.position,
            'is_active': banner.is_active,
            'order': banner.order,
        })

    # Update banner
    if request.method == 'PUT' and banner_id:
        banner = get_object_or_404(
            SiteBanner,
            id=banner_id,
            scope=SiteContentScope.USER,
            user=user,
        )

        try:
            put_data = json.loads(request.body.decode('utf-8')) if request.body else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            put_data = {}

        # Update fields if provided
        if 'title' in put_data:
            banner.title = put_data['title']

        if 'content_html' in put_data:
            # Sanitize HTML content to prevent XSS
            banner.content_html = sanitize_html(put_data['content_html'])

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

        return StatusDone({
            'id': banner.id,
            'title': banner.title,
            'content_html': banner.content_html,
            'banner_type': banner.banner_type,
            'position': banner.position,
            'is_active': banner.is_active,
            'order': banner.order,
        })

    # Delete banner
    if request.method == 'DELETE' and banner_id:
        banner = get_object_or_404(
            SiteBanner,
            id=banner_id,
            scope=SiteContentScope.USER,
            user=user,
        )
        banner.delete()

        return StatusDone({'message': '배너가 삭제되었습니다.'})

    raise Http404


def banner_order(request):
    """
    Update banner order

    PUT /v1/banners/order
    Body: { order: [[id1, order1], [id2, order2], ...] }
    """
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    # Check if user is an editor
    if not request.user.profile.is_editor():
        return StatusError(ErrorCode.REJECT, '에디터 권한이 필요합니다.')

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
            banner = SiteBanner.objects.get(
                id=banner_id,
                scope=SiteContentScope.USER,
                user=request.user,
            )
            banner.order = order
            banner.save()
        except SiteBanner.DoesNotExist:
            continue

    return StatusDone({'message': '배너 순서가 업데이트되었습니다.'})
