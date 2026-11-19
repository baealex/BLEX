from django.http import HttpRequest, HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_POST, require_safe

from board.constants.config_meta import CONFIG_TYPE
from board.models import Post
from board.modules.notify import create_system_notify
from board.services.notification_message_service import NotificationMessageKey
from board.services.post_like_service import PostLikeService
from board.services.post_share_link_service import PostShareLinkService
from board.services.public_post_service import PublicPostService
from board.views.static_pages import custom_404_view


@never_cache
@require_safe
def post_share_link_redirect(request: HttpRequest, token: str) -> HttpResponse:
    link = PostShareLinkService.get_public_link(token)
    if link is None:
        return custom_404_view(request)

    PostShareLinkService.record_click(link, request)
    return HttpResponseRedirect(link.post.get_absolute_url())


@require_POST
def like_post(request, url):
    """
    View to handle post likes via AJAX.
    This is used by the Django template version of the frontend.
    """
    if not request.user.is_authenticated:
        return JsonResponse({
            'status': 'error',
            'message': gettext('Authentication required'),
        }, status=401)

    post = get_object_or_404(
        PublicPostService.filter_public_posts(
            Post.objects.select_related('author')
        ),
        url=url,
    )

    result = PostLikeService.toggle(post, request.user)

    if result.created:
        if request.user != post.author and post.author.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_LIKE):
            create_system_notify(
                user=post.author,
                url=post.get_absolute_url(),
                message_key=NotificationMessageKey.POST_LIKED,
                message_params={
                    'post_title': post.title,
                    'actor': request.user.username,
                },
            )

    return JsonResponse({
        'status': 'done',
        'count_likes': result.count_likes,
        'has_liked': result.has_liked
    })
