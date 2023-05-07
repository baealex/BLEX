from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import TempPosts
from board.modules.response import StatusDone, StatusError, ErrorCode
from modules.randomness import randstr


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

        token = randstr(25)
        has_token = TempPosts.objects.filter(
            token=token, author=request.user).exists()
        while has_token:
            token = randstr(25)
            has_token = TempPosts.objects.filter(
                token=token, author=request.user).exists()

        temp_post = TempPosts(token=token, author=request.user)
        temp_post.title = request.POST.get('title')
        temp_post.text_md = request.POST.get('text_md')
        temp_post.tag = request.POST.get('tag')
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
