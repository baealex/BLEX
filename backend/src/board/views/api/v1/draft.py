import json

from django.http import Http404
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
        try:
            if request.content_type == 'application/json':
                data = json.loads(request.body)
            else:
                data = request.POST
        except (ValueError, json.JSONDecodeError):
            data = request.POST

        title = data.get('title', '')
        content = data.get('content', '')
        tags = data.get('tags', '')
        subtitle = data.get('subtitle', '')
        description = data.get('description', '')
        series_url = data.get('series_url', '')

        try:
            draft = PostService.create_draft(
                user=request.user,
                title=title,
                text_html=content,
                subtitle=subtitle,
                description=description,
                series_url=series_url,
                tag=tags,
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
        return StatusDone({
            'url': draft.url,
            'title': draft.title,
            'subtitle': draft.subtitle,
            'text_md': draft.content.text_html if hasattr(draft, 'content') else '',
            'raw_content': draft.content.text_html if hasattr(draft, 'content') else '',
            'tags': ','.join(draft.tagging()),
            'description': draft.meta_description,
            'series': draft.series.url if draft.series else '',
            'created_date': draft.time_since(),
        })

    if request.method == 'PUT':
        try:
            if request.content_type == 'application/json':
                data = json.loads(request.body)
            else:
                from django.http import QueryDict
                data = QueryDict(request.body)
        except (ValueError, json.JSONDecodeError):
            from django.http import QueryDict
            data = QueryDict(request.body)

        try:
            PostService.update_draft(
                post=draft,
                title=data.get('title'),
                text_html=data.get('content'),
                subtitle=data.get('subtitle'),
                description=data.get('description'),
                series_url=data.get('series_url'),
                tag=data.get('tags'),
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
