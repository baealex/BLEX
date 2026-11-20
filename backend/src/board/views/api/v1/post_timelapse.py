from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404

from board.decorators import api_editor_required_methods
from board.models import Post
from board.modules.response import StatusDone
from board.services.post_timelapse_service import PostTimelapseService


@api_editor_required_methods(['GET'])
def post_timelapse(
    request: HttpRequest,
    username: str,
    url: str,
) -> HttpResponse:
    if request.method != 'GET':
        raise Http404

    post = get_object_or_404(
        Post.objects.only('id', 'title', 'updated_date', 'published_date'),
        author__username=username,
        author=request.user,
        url=url,
        published_date__isnull=False,
    )
    return StatusDone(PostTimelapseService.serialize_timelapse(post))
