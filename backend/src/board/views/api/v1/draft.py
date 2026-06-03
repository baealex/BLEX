from django.http import Http404
from django.http.multipartparser import MultiPartParser
from django.shortcuts import get_object_or_404

from board.models import Post
from board.decorators import api_editor_required
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.post_service import PostService, PostValidationError
from board.modules.response import StatusDone, StatusError


@api_editor_required
def drafts_list(request):
    if request.method == 'GET':
        drafts = PostService.get_user_drafts(request.user)
        return StatusDone({
            'drafts': list(map(lambda draft: {
                'url': draft.url,
                'title': draft.title,
                'image': str(draft.image) if draft.image else None,
                'created_date': draft.time_since(),
                'updated_date': draft.updated_date.strftime('%Y-%m-%d'),
            }, drafts)),
        })

    if request.method == 'POST':
        if request.content_type and 'multipart' in request.content_type:
            data = request.POST
            files = request.FILES
        else:
            data = ApiRequestBodyService.parse_json_or_post(request)
            files = {}

        title = data.get('title', '')
        content = data.get('content_html') or data.get('content') or data.get('text_html') or data.get('text_md') or ''
        tags = data.get('tags', '')
        subtitle = data.get('subtitle', '')
        description = data.get('description', '')
        series_url = data.get('series_url', '')
        custom_url = data.get('custom_url', '')
        content_type = data.get('content_type', 'html')
        cover_layout = data.get('cover_layout')
        cover_image_position = data.get('cover_image_position')
        cover_image_ratio = data.get('cover_image_ratio')
        reserved_date = data.get('reserved_date')
        image = files.get('image') if files else None

        try:
            draft = PostService.create_draft(
                user=request.user,
                title=title,
                text_html=content,
                subtitle=subtitle,
                description=description,
                series_url=series_url,
                tag=tags,
                image=image,
                custom_url=custom_url,
                content_type=content_type,
                cover_layout=cover_layout,
                cover_image_position=cover_image_position,
                cover_image_ratio=cover_image_ratio,
                reserved_date_str=reserved_date,
            )

            return StatusDone({
                'url': draft.url,
            })
        except PostValidationError as e:
            return StatusError(e.code, e.message)

    raise Http404


@api_editor_required
def drafts_detail(request, url):
    draft = get_object_or_404(
        Post.objects.select_related('content', 'config', 'series').prefetch_related('tags'),
        url=url,
        author=request.user,
        published_date__isnull=True,
    )

    if request.method == 'GET':
        if hasattr(draft, 'content'):
            raw_content = draft.content.content_html
        else:
            raw_content = ''

        return StatusDone({
            'url': draft.url,
            'title': draft.title,
            'subtitle': draft.subtitle,
            'content_html': raw_content,
            'text_md': raw_content,
            'raw_content': raw_content,
            'tags': ','.join(draft.tagging()),
            'description': draft.meta_description,
            'image': draft.get_thumbnail(),
            'cover_layout': draft.config.cover_layout,
            'cover_image_position': draft.config.cover_image_position,
            'cover_image_ratio': draft.config.cover_image_ratio,
            'reserved_date': PostService.get_draft_reserved_date(draft),
            'series': {
                'url': draft.series.url,
                'name': draft.series.name,
            } if draft.series else None,
            'created_date': draft.time_since(),
        })

    if request.method == 'PUT':
        if request.content_type and 'multipart' in request.content_type:
            parser = MultiPartParser(request.META, request, request.upload_handlers)
            data, files = parser.parse()
        else:
            data = ApiRequestBodyService.parse_json_or_querydict(request)
            files = {}

        image = files.get('image') if files else None
        image_delete = data.get('image_delete') == 'true'
        reserved_date = data.get('reserved_date') if 'reserved_date' in data else None

        try:
            PostService.update_draft(
                post=draft,
                title=data.get('title'),
                text_html=data.get('content_html') or data.get('content') or data.get('text_html') or data.get('text_md'),
                subtitle=data.get('subtitle'),
                description=data.get('description'),
                series_url=data.get('series_url'),
                tag=data.get('tags'),
                image=image,
                image_delete=image_delete,
                custom_url=data.get('custom_url'),
                content_type=data.get('content_type'),
                cover_layout=data.get('cover_layout'),
                cover_image_position=data.get('cover_image_position'),
                cover_image_ratio=data.get('cover_image_ratio'),
                reserved_date_str=reserved_date,
            )
            return StatusDone({
                'url': draft.url,
            })
        except PostValidationError as e:
            return StatusError(e.code, e.message)

    if request.method == 'DELETE':
        PostService.delete_post(draft)
        return StatusDone()

    raise Http404
