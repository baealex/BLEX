from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST

from board.constants.config_meta import CONFIG_TYPE
from board.models import Post, PostLikes, PostThanks, PostNoThanks
from board.modules.analytics import create_device, get_network_addr
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
        # Send notification to post author
        if request.user != post.author and post.author.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_LIKE):
            send_notify_content = (
                f"'{post.title}' 글을 "
                f"@{request.user.username}님께서 추천하였습니다.")
            create_notify(
                user=post.author,
                url=post.get_absolute_url(),
                content=send_notify_content)
    
    # Get updated like count
    count_likes = PostLikes.objects.filter(post=post).count()
    
    return JsonResponse({
        'status': 'done',
        'count_likes': count_likes,
        'has_liked': not like_exists
    })


@require_POST
def thanks_post(request, url):
    """
    View to handle post thanks via AJAX.
    """
    
    post = get_object_or_404(Post, url=url)
    
    if request.user == post.author:
        return JsonResponse({
            'status': 'error',
            'message': 'Authors cannot thanks their own posts'
        }, status=403)
    
    user_addr = get_network_addr(request)
    user_agent = request.META['HTTP_USER_AGENT']
    device = create_device(user_addr, user_agent)
    
    # Remove any existing "no thanks" from this device
    post_nothanks = post.nothanks.filter(device=device)
    if post_nothanks.exists():
        post_nothanks.delete()
    
    # Check if already thanked
    post_thanks = post.thanks.filter(device=device)
    if not post_thanks.exists():
        # Send notification to post author
        if post.author.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_THANKS):
            send_notify_content = (
                f"'{post.title}' 글을 "
                f"누군가 도움이 되었다고 평가하였습니다.")
            create_notify(
                user=post.author,
                url=post.get_absolute_url(),
                content=send_notify_content,
                hidden_key=device.key)
        PostThanks.objects.create(post=post, device=device)
    
    return JsonResponse({
        'status': 'done'
    })


@require_POST
def no_thanks_post(request, url):
    """
    View to handle post no thanks via AJAX.
    """
    post = get_object_or_404(Post, url=url)
    
    if request.user == post.author:
        return JsonResponse({
            'status': 'error', 
            'message': 'Authors cannot evaluate their own posts'
        }, status=403)
    
    user_addr = get_network_addr(request)
    user_agent = request.META['HTTP_USER_AGENT']
    device = create_device(user_addr, user_agent)
    
    # Remove any existing "thanks" from this device
    post_thanks = post.thanks.filter(device=device)
    if post_thanks.exists():
        post_thanks.delete()
    
    # Check if already marked as not helpful
    post_nothanks = post.nothanks.filter(device=device)
    if not post_nothanks.exists():
        # Send notification to post author
        if post.author.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_NO_THANKS):
            send_notify_content = (
                f"'{post.title}' 글을 "
                f"누군가 도움이 되지 않았다고 평가하였습니다.")
            create_notify(
                user=post.author,
                url=post.get_absolute_url(),
                content=send_notify_content,
                hidden_key=device.key)
        PostNoThanks.objects.create(post=post, device=device)
    
    return JsonResponse({
        'status': 'done'
    })
