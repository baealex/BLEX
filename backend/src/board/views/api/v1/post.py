from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime

from board.models import Post, PinnedPost
from board.modules.requests import BooleanType
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.time import convert_to_localtime, time_since
from board.services.comment_list_service import CommentListService
from board.services.post_service import PostService, PostValidationError


def post_list(request):
    if request.method == 'POST':
        if not request.user.is_authenticated:
            raise Http404

        try:
            image = request.FILES.get('image', None)
            content_html = (
                request.POST.get('content_html')
                or request.POST.get('text_html')
                or request.POST.get('text_md')
                or ''
            )

            post, post_content, post_config = PostService.create_post(
                user=request.user,
                title=request.POST.get('title', ''),
                text_html=content_html,
                subtitle=request.POST.get('subtitle', ''),
                description=request.POST.get('description', ''),
                reserved_date_str=request.POST.get('reserved_date', ''),
                series_url=request.POST.get('series', ''),
                custom_url=request.POST.get('url', ''),
                tag=request.POST.get('tag', ''),
                image=image,
                is_hide=BooleanType(request.POST.get('is_hide', '')),
                is_advertise=BooleanType(request.POST.get('is_advertise', '')),
                content_type=request.POST.get('content_type', 'html'),
            )

            return StatusDone({
                'url': post.url,
            })

        except PostValidationError as e:
            return StatusError(e.code, e.message)

    raise Http404


def post_comment_list(request, url):
    if request.method == 'GET':
        return StatusDone(CommentListService.serialize_post_comments(url, request.user))


def user_posts(request, username, url=None):
    if url:
        post = PostService.get_post_detail(username, url, request.user)

        if request.method == 'GET':
            if request.GET.get('mode') == 'edit':
                if not request.user == post.author:
                    raise Http404

                content_html = post.content.content_html if hasattr(post, 'content') else ''

                return StatusDone({
                    'image': post.get_thumbnail(),
                    'title': post.title,
                    'subtitle': post.subtitle,
                    'url': post.url,
                    'description': post.meta_description,
                    'series': {
                        'id': str(post.series.id),
                        'name': post.series.name,
                        'url': post.series.url,
                    } if post.series else None,
                    'content_html': content_html,
                    'text_html': content_html,
                    'tags': post.tagging(),
                    'is_hide': post.config.hide,
                    'is_advertise': post.config.advertise
                })

            if request.GET.get('mode') == 'view':
                if post.config.hide and request.user != post.author:
                    raise Http404

                if not post.is_published() and request.user != post.author:
                    raise Http404

                return StatusDone({
                    'url': post.url,
                    'title': post.title,
                    'image': str(post.image),
                    'description': post.meta_description,
                    'read_time': post.read_time,
                    'series': {
                        'url': post.series.url,
                        'name': post.series.name,
                    } if post.series else None,
                    'created_date': convert_to_localtime(post.published_date).strftime('%Y-%m-%d %H:%M'),
                    'updated_date': convert_to_localtime(post.updated_date).strftime('%Y-%m-%d %H:%M'),
                    'author_image': str(post.author_image),
                    'author': post.author_username,
                    'rendered_content': post.content.content_html,
                    'count_likes': post.count_likes,
                    'count_comments': post.count_comments,
                    'is_ad': post.config.advertise,
                    'tags': post.tagging(),
                    'is_liked': post.has_liked,
                })

        if request.method == 'POST':
            if not PostService.can_user_edit_post(request.user, post):
                raise Http404

            title = request.POST.get('title', '')
            text_html = (
                request.POST.get('content_html')
                or request.POST.get('text_html')
                or request.POST.get('text_md')
                or ''
            )

            try:
                PostService.update_post(
                    post=post,
                    title=title,
                    subtitle=request.POST.get('subtitle', ''),
                    text_html=text_html,
                    description=request.POST.get('description', ''),
                    series_url=request.POST.get('series', ''),
                    image=request.FILES.get('image', None),
                    image_delete=request.POST.get('image_delete') == 'true',
                    is_hide=BooleanType(request.POST.get('is_hide', '')),
                    is_advertise=BooleanType(request.POST.get('is_advertise', '')),
                    tag=request.POST.get('tag', ''),
                    content_type=request.POST.get('content_type'),
                )
            except PostValidationError as e:
                return StatusError(e.code, e.message)

            return StatusDone()

        if request.method == 'PUT':
            put = QueryDict(request.body)

            if request.GET.get('hide', ''):
                if not PostService.can_user_edit_post(request.user, post):
                    raise Http404

                pinned_post = PinnedPost.objects.filter(post=post)
                if pinned_post.exists():
                    pinned_post.delete()

                is_hide = not post.config.hide
                PostService.update_post(post=post, is_hide=is_hide)
                return StatusDone({
                    'is_hide': is_hide
                })

            if request.GET.get('tag', ''):
                if not PostService.can_user_edit_post(request.user, post):
                    raise Http404

                PostService.update_post(post=post, tag=put.get('tag'))
                # Need to refresh or get tags, but update_post returns post
                return StatusDone({
                    'tag': ','.join(post.tagging())
                })

            if request.GET.get('series', ''):
                if not PostService.can_user_edit_post(request.user, post):
                    raise Http404

                PostService.update_post(post=post, series_url=put.get('series'))
                return StatusDone({
                    'series': post.series.url if post.series else None
                })

            if request.GET.get('reserved_date', ''):
                if not PostService.can_user_edit_post(request.user, post):
                    raise Http404
                
                reserved_date_str = put.get('reserved_date')
                if reserved_date_str and not post.is_published():
                    reserved_date = parse_datetime(reserved_date_str)
                    if reserved_date:
                        post.published_date = reserved_date
                        post.updated_date = reserved_date
                        post.save()
                return StatusDone()

        if request.method == 'DELETE':
            if not PostService.can_user_delete_post(request.user, post):
                raise Http404
            PostService.delete_post(post)
            return StatusDone()

    raise Http404


def user_post_related(request, username, url):
    """
    Get related posts for a specific post based on shared tags and popularity.
    Uses a scoring system to rank relevance.
    """
    if request.method == 'GET':
        post = get_object_or_404(Post.objects.select_related('config').prefetch_related('tags'),
                                 author__username=username, url=url)

        if post.config.hide and (not request.user.is_authenticated or request.user != post.author):
            raise Http404

        related_posts = PostService.get_related_posts(post)

        return StatusDone({
            'posts': list(map(lambda related_post: {
                'url': related_post.url,
                'title': related_post.title,
                'image': str(related_post.image) if related_post.image else None,
                'meta_description': related_post.meta_description,
                'read_time': related_post.read_time,
                'published_date': time_since(related_post.published_date),
                'author_username': related_post.author_username,
                'author_name': related_post.author_name,
                'author_image': str(related_post.author_image) if related_post.author_image else None,
            }, related_posts))
        })

    raise Http404
