from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST

from board.models import Post, PostLikes


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
    
    # Check if the user has already liked this post
    like_exists = PostLikes.objects.filter(
        post=post,
        user=request.user
    ).exists()
    
    if like_exists:
        # Unlike the post
        PostLikes.objects.filter(
            post=post,
            user=request.user
        ).delete()
    else:
        # Like the post
        PostLikes.objects.create(
            post=post,
            user=request.user
        )
    
    # Get updated like count
    count_likes = PostLikes.objects.filter(post=post).count()
    
    return JsonResponse({
        'status': 'done',
        'count_likes': count_likes,
        'has_liked': not like_exists
    })
