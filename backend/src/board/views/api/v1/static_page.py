import json
from django.http import Http404
from django.shortcuts import get_object_or_404
from board.models import StaticPage
from board.modules.response import StatusDone, StatusError, ErrorCode


def static_pages(request, page_id=None):
    """
    Static Page CRUD API endpoint (staff only)

    GET /v1/static-pages - List all static pages
    POST /v1/static-pages - Create new static page
    GET /v1/static-pages/:id - Get static page details
    PUT /v1/static-pages/:id - Update static page
    DELETE /v1/static-pages/:id - Delete static page
    """
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if not request.user.is_staff:
        return StatusError(ErrorCode.REJECT, '관리자 권한이 필요합니다.')

    # List all static pages
    if request.method == 'GET' and page_id is None:
        pages = StaticPage.objects.all().order_by('order', '-created_date')

        return StatusDone({
            'pages': list(map(lambda page: {
                'id': page.id,
                'title': page.title,
                'slug': page.slug,
                'content': page.content,
                'meta_description': page.meta_description,
                'is_published': page.is_published,
                'show_in_footer': page.show_in_footer,
                'order': page.order,
                'created_date': page.created_date.isoformat(),
                'updated_date': page.updated_date.isoformat(),
            }, pages))
        })

    # Get single static page
    if request.method == 'GET' and page_id:
        page = get_object_or_404(StaticPage, id=page_id)

        return StatusDone({
            'id': page.id,
            'title': page.title,
            'slug': page.slug,
            'content': page.content,
            'meta_description': page.meta_description,
            'is_published': page.is_published,
            'show_in_footer': page.show_in_footer,
            'order': page.order,
            'created_date': page.created_date.isoformat(),
            'updated_date': page.updated_date.isoformat(),
        })

    # Create new static page
    if request.method == 'POST':
        try:
            post_data = json.loads(request.body.decode('utf-8')) if request.body else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            return StatusError(ErrorCode.VALIDATE, '잘못된 요청입니다.')

        title = post_data.get('title', '')
        slug = post_data.get('slug', '')
        content = post_data.get('content', '')
        meta_description = post_data.get('meta_description', '')
        is_published = post_data.get('is_published', True)
        show_in_footer = post_data.get('show_in_footer', False)
        order = post_data.get('order', 0)

        if not title:
            return StatusError(ErrorCode.VALIDATE, '제목을 입력해주세요.')

        if not slug:
            return StatusError(ErrorCode.VALIDATE, 'URL 슬러그를 입력해주세요.')

        if StaticPage.objects.filter(slug=slug).exists():
            return StatusError(ErrorCode.ALREADY_EXISTS, '이미 사용 중인 슬러그입니다.')

        page = StaticPage.objects.create(
            title=title,
            slug=slug,
            content=content,
            meta_description=meta_description,
            is_published=is_published,
            show_in_footer=show_in_footer,
            order=order,
            author=request.user,
        )

        return StatusDone({
            'id': page.id,
            'title': page.title,
            'slug': page.slug,
            'content': page.content,
            'meta_description': page.meta_description,
            'is_published': page.is_published,
            'show_in_footer': page.show_in_footer,
            'order': page.order,
            'created_date': page.created_date.isoformat(),
            'updated_date': page.updated_date.isoformat(),
        })

    # Update static page
    if request.method == 'PUT' and page_id:
        page = get_object_or_404(StaticPage, id=page_id)

        try:
            put_data = json.loads(request.body.decode('utf-8')) if request.body else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            put_data = {}

        if 'title' in put_data:
            page.title = put_data['title']

        if 'slug' in put_data:
            new_slug = put_data['slug']
            if new_slug != page.slug and StaticPage.objects.filter(slug=new_slug).exists():
                return StatusError(ErrorCode.ALREADY_EXISTS, '이미 사용 중인 슬러그입니다.')
            page.slug = new_slug

        if 'content' in put_data:
            page.content = put_data['content']

        if 'meta_description' in put_data:
            page.meta_description = put_data['meta_description']

        if 'is_published' in put_data:
            page.is_published = put_data['is_published']

        if 'show_in_footer' in put_data:
            page.show_in_footer = put_data['show_in_footer']

        if 'order' in put_data:
            page.order = put_data['order']

        page.save()

        return StatusDone({
            'id': page.id,
            'title': page.title,
            'slug': page.slug,
            'content': page.content,
            'meta_description': page.meta_description,
            'is_published': page.is_published,
            'show_in_footer': page.show_in_footer,
            'order': page.order,
            'created_date': page.created_date.isoformat(),
            'updated_date': page.updated_date.isoformat(),
        })

    # Delete static page
    if request.method == 'DELETE' and page_id:
        page = get_object_or_404(StaticPage, id=page_id)
        page.delete()

        return StatusDone({'message': '정적 페이지가 삭제되었습니다.'})

    raise Http404
