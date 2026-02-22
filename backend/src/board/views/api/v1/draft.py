import json

from django.http import Http404
from django.http.multipartparser import MultiPartParser
from django.shortcuts import get_object_or_404

from board.models import Post, PostContent
from board.services.post_service import PostService, PostValidationError
from board.modules.response import StatusDone, StatusError, ErrorCode


def drafts_list(request):
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if request.method == 'GET':
        drafts = PostService.get_user_drafts(request.user)
        return StatusDone({
            'drafts': list(map(lambda draft: {
                'url': draft.url,
                'title': draft.title,
                'created_date': draft.time_since(),
                'updated_date': draft.updated_date.strftime('%Y-%m-%d'),
            }, drafts)),
        })

    if request.method == 'POST':
        if request.content_type and 'multipart' in request.content_type:
            data = request.POST
            files = request.FILES
        else:
            try:
                data = json.loads(request.body)
            except (ValueError, json.JSONDecodeError):
                data = request.POST
            files = {}

        title = data.get('title', '')
        content = data.get('content', '')
        tags = data.get('tags', '')
        subtitle = data.get('subtitle', '')
        description = data.get('description', '')
        series_url = data.get('series_url', '')
        custom_url = data.get('custom_url', '')
        content_type = data.get('content_type', 'html')
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
            )

            return StatusDone({
                'url': draft.url,
            })
        except PostValidationError as e:
            return StatusError(e.code, e.message)

    raise Http404


def drafts_detail(request, url):
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    draft = get_object_or_404(
        Post.objects.select_related('content', 'config', 'series').prefetch_related('tags'),
        url=url,
        author=request.user,
        published_date__isnull=True,
    )

    if request.method == 'GET':
        content_type = 'html'
        if hasattr(draft, 'content'):
            content_type = draft.content.content_type
            if content_type == 'markdown':
                raw_content = draft.content.text_md
            else:
                raw_content = draft.content.text_html
        else:
            raw_content = ''

        return StatusDone({
            'url': draft.url,
            'title': draft.title,
            'subtitle': draft.subtitle,
            'content_type': content_type,
            'text_md': raw_content,
            'raw_content': raw_content,
            'tags': ','.join(draft.tagging()),
            'description': draft.meta_description,
            'image': draft.get_thumbnail(),
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
            try:
                data = json.loads(request.body)
            except (ValueError, json.JSONDecodeError):
                from django.http import QueryDict
                data = QueryDict(request.body)
            files = {}

        image = files.get('image') if files else None
        image_delete = data.get('image_delete') == 'true'

        try:
            PostService.update_draft(
                post=draft,
                title=data.get('title'),
                text_html=data.get('content'),
                subtitle=data.get('subtitle'),
                description=data.get('description'),
                series_url=data.get('series_url'),
                tag=data.get('tags'),
                image=image,
                image_delete=image_delete,
                custom_url=data.get('custom_url'),
                content_type=data.get('content_type'),
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
