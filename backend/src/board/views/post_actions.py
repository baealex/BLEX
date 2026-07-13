from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST

from board.constants.config_meta import CONFIG_TYPE
from board.models import Post
from board.modules.notify import create_notify
from board.services.post_like_service import PostLikeService


@require_POST
def like_post(request, url):
    """
    View to handle post likes via AJAX.
    This is used by the Django template version of the frontend.
    """
    if not request.user.is_authenticated:
        return JsonResponse({
            'status': 'error',
            'message': 'Authentication required'
        }, status=401)

    post = get_object_or_404(Post, url=url)

    result = PostLikeService.toggle(post, request.user)

    if result.created:
        if request.user != post.author and post.author.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_LIKE):
            send_notify_content = (
                f"'{post.title}' 글을 "
                f"@{request.user.username}님께서 추천하였습니다.")
            create_notify(
                user=post.author,
                url=post.get_absolute_url(),
                content=send_notify_content)

    return JsonResponse({
        'status': 'done',
        'count_likes': result.count_likes,
        'has_liked': result.has_liked
    })
