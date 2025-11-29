from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST

from board.constants.config_meta import CONFIG_TYPE
from board.models import Post, PostLikes
from board.modules.notify import create_notify


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
    
    like_exists = PostLikes.objects.filter(
        post=post,
        user=request.user
    ).exists()
    
    if like_exists:
        PostLikes.objects.filter(
            post=post,
            user=request.user
        ).delete()
    else:
        PostLikes.objects.create(
            post=post,
            user=request.user
        )
        if request.user != post.author and post.author.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_LIKE):
            send_notify_content = (
                f"'{post.title}' 글을 "
                f"@{request.user.username}님께서 추천하였습니다.")
            create_notify(
                user=post.author,
                url=post.get_absolute_url(),
                content=send_notify_content)
    
    count_likes = PostLikes.objects.filter(post=post).count()
    
    return JsonResponse({
        'status': 'done',
        'count_likes': count_likes,
        'has_liked': not like_exists
    })
