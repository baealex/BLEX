from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404

from board.decorators import api_editor_required_methods
from board.models import Post
from board.modules.response import StatusDone, StatusError
from board.services.post_service import PostService, PostValidationError


@api_editor_required_methods(['POST'])
def cancel_post_schedule(
    request: HttpRequest,
    username: str,
    url: str,
) -> HttpResponse:
    if request.method != 'POST':
        raise Http404

    post = get_object_or_404(
        Post.objects,
        author__username=username,
        url=url,
    )
    if not PostService.can_user_edit_post(request.user, post):
        raise Http404

    try:
        post = PostService.cancel_scheduled_post(post)
    except PostValidationError as error:
        return StatusError(error.code, error.message)

    return StatusDone({
        'url': post.url,
        'status': 'draft',
    })


@api_editor_required_methods(['POST'])
def publish_scheduled_post_now(
    request: HttpRequest,
    username: str,
    url: str,
) -> HttpResponse:
    if request.method != 'POST':
        raise Http404

    post = get_object_or_404(
        Post.objects,
        author__username=username,
        url=url,
    )
    if not PostService.can_user_edit_post(request.user, post):
        raise Http404

    try:
        post = PostService.publish_scheduled_post_now(post)
    except PostValidationError as error:
        return StatusError(error.code, error.message)

    return StatusDone({
        'url': post.url,
        'status': 'published',
        'published_date': post.published_date.isoformat(),
    })
