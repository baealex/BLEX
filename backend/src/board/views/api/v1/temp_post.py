import json
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404

from board.models import TempPosts
from board.services import TempPostService
from board.services.temp_post_service import TempPostValidationError
from board.modules.response import StatusDone, StatusError, ErrorCode


def temp_posts_list(request):
    try:
        TempPostService.validate_user_permissions(request.user)
    except TempPostValidationError as e:
        return StatusError(e.code, e.message)

    if request.method == 'GET':
        temp_posts = TempPostService.get_user_temp_posts(request.user)
        return StatusDone({
            'temps': list(map(lambda temp: {
                'token': temp.token,
                'title': temp.title,
                'created_date': temp.time_since()
            }, temp_posts)),
        })

    if request.method == 'POST':
        # Parse JSON data from request body
        try:
            if request.content_type == 'application/json':
                data = json.loads(request.body)
            else:
                data = request.POST
        except (ValueError, json.JSONDecodeError):
            data = request.POST

        title = data.get('title') or '제목 없음'
        content = data.get('content') or data.get('text_md', '')
        tags = data.get('tags', [])

        try:
            temp_post = TempPostService.create_temp_post(
                user=request.user,
                title=title,
                content=content,
                tags=tags
            )

            return StatusDone({
                'token': temp_post.token
            })
        except TempPostValidationError as e:
            return StatusError(e.code, e.message)


def temp_posts_detail(request, token):
    try:
        TempPostService.validate_user_permissions(request.user)
    except TempPostValidationError as e:
        return StatusError(e.code, e.message)

    temp_post = get_object_or_404(
        TempPosts, token=token, author=request.user)

    if not TempPostService.can_user_access_temp_post(request.user, temp_post):
        return StatusError(ErrorCode.AUTHENTICATION, '권한이 없습니다.')

    if request.method == 'GET':
        return StatusDone({
            'token': temp_post.token,
            'title': temp_post.title,
            'text_md': temp_post.text_md,
            'raw_content': temp_post.text_md,
            'tags': temp_post.tag,
            'created_date': temp_post.time_since(),
        })

    if request.method == 'PUT':
        body = QueryDict(request.body)
        TempPostService.update_temp_post(
            temp_post=temp_post,
            title=body.get('title'),
            content=body.get('text_md'),
            tags=body.get('tag')
        )
        return StatusDone()

    if request.method == 'DELETE':
        TempPostService.delete_temp_post(temp_post)
        return StatusDone()

    raise Http404
