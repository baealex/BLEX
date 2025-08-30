import json
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import TempPosts
from board.modules.response import StatusDone, StatusError, ErrorCode
from modules.randomness import randstr
from modules import markdown


def temp_posts_list(request):
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if request.method == 'GET':
        temp_posts = TempPosts.objects.filter(author=request.user)
        return StatusDone({
            'temps': list(map(lambda temp: {
                'token': temp.token,
                'title': temp.title,
                'created_date': temp.time_since()
            }, temp_posts)),
        })

    if request.method == 'POST':
        temp_posts = TempPosts.objects.filter(author=request.user)
        if temp_posts.count() >= 100:
            return StatusError(ErrorCode.SIZE_OVERFLOW)

        # Parse JSON data from request body
        try:
            if request.content_type == 'application/json':
                data = json.loads(request.body)
            else:
                data = request.POST
        except (ValueError, json.JSONDecodeError):
            data = request.POST

        # Get or create existing temp post based on content similarity
        title = data.get('title') or '제목 없음'
        content = data.get('content') or data.get('text_md', '')
        tags = data.get('tags', [])
        if isinstance(tags, list):
            tag = ','.join(tags) if tags else ''
        else:
            tag = str(tags) if tags else ''

        # Try to find existing temp post with similar content
        existing_temp = TempPosts.objects.filter(
            author=request.user,
            text_md=content
        ).first()

        if existing_temp:
            # Update existing temp post
            existing_temp.title = title
            existing_temp.text_md = content
            existing_temp.tag = tag
            existing_temp.updated_date = timezone.now()
            existing_temp.save()
            return StatusDone({
                'token': existing_temp.token
            })
        else:
            # Create new temp post
            token = randstr(25)
            has_token = TempPosts.objects.filter(
                token=token, author=request.user).exists()
            while has_token:
                token = randstr(25)
                has_token = TempPosts.objects.filter(
                    token=token, author=request.user).exists()

            temp_post = TempPosts(
                token=token, 
                author=request.user,
                title=title,
                text_md=content,
                tag=tag
            )
            temp_post.save()

            return StatusDone({
                'token': token
            })


def temp_posts_detail(request, token):
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if request.method == 'GET':
        temp_post = get_object_or_404(
            TempPosts, token=token, author=request.user)
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
        temp_post = get_object_or_404(
            TempPosts, token=token, author=request.user)
        temp_post.title = body.get('title')
        temp_post.text_md = body.get('text_md')
        temp_post.tag = body.get('tag')
        temp_post.updated_date = timezone.now()
        temp_post.save()
        return StatusDone()

    if request.method == 'DELETE':
        temp_post = get_object_or_404(
            TempPosts, token=token, author=request.user)
        temp_post.delete()
        return StatusDone()

    raise Http404
