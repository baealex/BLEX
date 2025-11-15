import datetime

from django.conf import settings
from django.db.models import (
    Q, F, Case, Exists, When, Subquery,
    Value, OuterRef, Count)
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify

from board.constants.config_meta import CONFIG_TYPE
from board.models import (
    Comment, Series,
    TempPosts, Post, PostContent, PostConfig, PinnedPost,
    PostLikes, calc_read_time)
from board.modules.notify import create_notify
from board.modules.paginator import Paginator
from board.modules.post_description import create_post_description
from board.modules.requests import BooleanType
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.time import convert_to_localtime, time_since
from board.services.post_service import PostService, PostValidationError
from modules import markdown
from modules.sub_task import SubTaskProcessor
from modules.discord import Discord


def post_list(request):
    """Create a new post using PostService"""
    if request.method == 'POST':
        if not request.user.is_authenticated:
            raise Http404

        try:
            # Get image from FILES if provided
            image = request.FILES.get('image', None)

            # Create post using service
            post, post_content, post_config = PostService.create_post(
                user=request.user,
                title=request.POST.get('title', ''),
                text_html=request.POST.get('text_html', ''),
                description=request.POST.get('description', ''),
                reserved_date_str=request.POST.get('reserved_date', ''),
                series_url=request.POST.get('series', ''),
                custom_url=request.POST.get('url', ''),
                tag=request.POST.get('tag', ''),
                image=image,
                is_hide=BooleanType(request.POST.get('is_hide', '')),
                is_advertise=BooleanType(request.POST.get('is_advertise', '')),
                temp_post_token=request.POST.get('token', '')
            )

            return StatusDone({
                'url': post.url,
            })

        except PostValidationError as e:
            return StatusError(e.code, e.message)

    raise Http404


def trending_post_list(request):
    if request.method == 'GET':
        posts = Post.objects.select_related(
            'author', 'author__profile', 'config'
        ).prefetch_related(
            'comments'
        ).filter(
            created_date__lte=timezone.now(),
            config__notice=False,
            config__hide=False,
        ).annotate(
            likes_count=Count('likes')
        ).order_by('-likes_count', '-created_date')

        posts = Paginator(
            objects=posts,
            offset=5,
            page=1
        )
        return StatusDone(list(map(lambda post: {
            'url': post.url,
            'title': post.title,
            'image': str(post.image),
            'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
            'author_image': post.author.profile.get_thumbnail(),
            'author': post.author.username,
        }, posts)))


def newest_post_list(request):
    if request.method == 'GET':
        posts = Post.objects.select_related(
            'config', 'series'
        ).filter(
            created_date__lte=timezone.now(),
            config__notice=False,
            config__hide=False,
        ).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar'),
            count_likes=Count('likes', distinct=True),
            count_comments=Count('comments', distinct=True),
            has_liked=Exists(
                PostLikes.objects.filter(
                    post__id=OuterRef('id'),
                    user__id=request.user.id if request.user.id else -1
                )
            ),
        ).order_by('-created_date')

        posts = Paginator(
            objects=posts,
            offset=24,
            page=request.GET.get('page', 1)
        )
        return StatusDone({
            'posts': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': str(post.image),
                'description': post.meta_description,
                'read_time': post.read_time,
                'created_date': post.time_since(),
                'author_image': post.author_image,
                'author': post.author_username,
                'is_ad': post.config.advertise,
                'series': {
                    'url': post.series.url,
                    'name': post.series.name,
                } if post.series else None,
                'count_likes': post.count_likes,
                'count_comments': post.count_comments,
                'has_liked': post.has_liked,
            }, posts)),
            'last_page': posts.paginator.num_pages
        })


def liked_post_list(request):
    if not request.user.id:
        raise Http404

    if request.method == 'GET':
        posts = Post.objects.select_related(
            'config', 'series'
        ).filter(
            created_date__lte=timezone.now(),
            config__notice=False,
            config__hide=False,
            likes__user=request.user,
        ).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar'),
            count_likes=Count('likes', distinct=True),
            count_comments=Count('comments', distinct=True),
            has_liked=Exists(
                PostLikes.objects.filter(
                    post__id=OuterRef('id'),
                    user__id=request.user.id if request.user.id else -1
                )
            ),
            liked_date=Subquery(
                PostLikes.objects.filter(
                    post__id=OuterRef('id'),
                    user__id=request.user.id if request.user.id else -1
                ).values('created_date')[:1]
            ),
        ).order_by('-liked_date')

        posts = Paginator(
            objects=posts,
            offset=24,
            page=request.GET.get('page', 1)
        )
        return StatusDone({
            'posts': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': str(post.image),
                'description': post.meta_description,
                'read_time': post.read_time,
                'liked_date': time_since(post.liked_date),
                'created_date': post.time_since(),
                'author_image': post.author_image,
                'author': post.author_username,
                'is_ad': post.config.advertise,
                'series': {
                    'url': post.series.url,
                    'name': post.series.name,
                } if post.series else None,
                'count_likes': post.count_likes,
                'count_comments': post.count_comments,
                'has_liked': post.has_liked,
            }, posts)),
            'last_page': posts.paginator.num_pages
        })


def feature_post_list(request):
    if request.method == 'GET':
        username = request.GET.get('username', '')
        if '@' in username:
            username = username.replace('@', '')
        if not username:
            raise Http404('require username.')

        posts = Post.objects.select_related(
            'config'
        ).filter(
            created_date__lte=timezone.now(),
            config__hide=False,
            author__username=username
        ).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar')
        )
        exclude = request.GET.get('exclude', '')
        if exclude:
            posts = posts.exclude(url=exclude)
        posts = posts.order_by('?')[:3]
        return StatusDone({
            'posts': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': str(post.image),
                'read_time': post.read_time,
                'description': post.meta_description,
                'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                'author_image': post.author_image,
                'author': post.author_username,
                'is_ad': post.config.advertise,
            }, posts))
        })

    raise Http404


def pinned_post_list(request):
    if not request.user:
        raise Http404

    if request.method == 'GET':
        pinned_posts = PinnedPost.objects.select_related(
            'post'
        ).filter(
            post__author=request.user
        ).annotate(
            count_likes=Count('post__likes', distinct=True)
        ).order_by('order')

        return StatusDone(list(map(lambda pinned_post: {
            'url': pinned_post.post.url,
            'title': pinned_post.post.title,
            'count_likes': pinned_post.count_likes,
        }, pinned_posts)))
    
    if request.method == 'POST':
        post_urls = request.POST.get('posts', '').split(',')[:6]

        pinned_posts = PinnedPost.objects.select_related('post').filter(user=request.user)
        exists_urls = []

        for pinned_post in pinned_posts:
            exists_urls.append(pinned_post.post.url)

            if not pinned_post.post.url in post_urls:
                pinned_post.delete()

            if pinned_post.post.url in post_urls:
                pinned_post.order=post_urls.index(pinned_post.post.url)
                pinned_post.save()

        for index, post_url in enumerate(post_urls):
            if post_url and not post_url in exists_urls:
                PinnedPost.objects.create(
                    user=request.user,
                    post=Post.objects.get(url=post_url),
                    order=index,
                )

        return StatusDone()

    raise Http404


def pinnable_post_list(request):
    if not request.user:
        raise Http404

    if request.method == 'GET':
        posts = Post.objects.select_related(
            'config'
        ).annotate(
            count_likes=Count('likes', distinct=True),
        ).filter(
            author=request.user,
            config__hide=False,
            created_date__lte=timezone.now(),
        ).order_by('-count_likes', '-created_date')

        search = request.GET.get('search', '')
        if search:
            posts = posts.filter(
                Q(title__icontains=search) |
                Q(url__icontains=search)
            )

        posts = Paginator(
            objects=posts,
            offset=12,
            page=request.GET.get('page', 1)
        )

        return StatusDone({
            'posts': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'count_likes': post.count_likes,
            }, posts)),
            'last_page': posts.paginator.num_pages
        })


def post_comment_list(request, url):
    if request.method == 'GET':
        comments = Comment.objects.select_related(
            'author',
            'author__profile'
        ).annotate(
            count_likes=Count('likes', distinct=True),
            has_liked=Case(
                When(
                    Exists(
                        Comment.objects.filter(
                            id=OuterRef('id'),
                            likes__id=request.user.id if request.user.id else -1
                        )
                    ),
                    then=Value(True)
                ),
                default=Value(False),
            )
        ).filter(post__url=url).order_by('created_date')

        return StatusDone({
            'comments': list(map(lambda comment: {
                'id': comment.id,
                'author': comment.author_username(),
                'author_image': None if not comment.author else comment.author.profile.get_thumbnail(),
                'is_edited': comment.edited,
                'rendered_content': comment.get_text_html(),
                'created_date': comment.time_since(),
                'count_likes': comment.count_likes,
                'is_liked': comment.has_liked,
            }, comments))
        })


def user_posts(request, username, url=None):
    if not url:
        if request.method == 'GET':
            posts = Post.objects.select_related(
                'config', 'content',
            ).filter(
                created_date__lte=timezone.now(),
                author__username=username,
                config__hide=False,
            ).annotate(
                author_username=F('author__username'),
                author_image=F('author__profile__avatar'),
            ).order_by('-created_date')
            all_count = posts.count()

            tag = request.GET.get('tag', '')
            if tag:
                posts = posts.filter(tags__value=tag)
            
            search = request.GET.get('search', '')
            if search:
                posts = posts.filter(title__icontains=search)

            valid_orders = [
                'title',
                'created_date',
                'updated_date',
            ]
            order = request.GET.get('order', '')
            if order:
                is_valid = False
                for valid_order in valid_orders:
                    if order == valid_order or order == '-' + valid_order:
                        is_valid = True
                if not is_valid:
                    raise Http404

                posts = posts.order_by(order)

            posts = Paginator(
                objects=posts,
                offset=10,
                page=request.GET.get('page', 1)
            )
            return StatusDone({
                'all_count': all_count,
                'posts': list(map(lambda post: {
                    'url': post.url,
                    'title': post.title,
                    'image': str(post.image),
                    'read_time': post.read_time,
                    'description': post.meta_description,
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                    'author_image': post.author_image,
                    'author': post.author_username,
                    'is_ad': post.config.advertise,
                    'tags': post.tagging(),
                }, posts)),
                'last_page': posts.paginator.num_pages
            })
    if url:
        post = get_object_or_404(Post.objects.select_related(
            'config', 'content', 'series'
        ).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar'),
            count_likes=Count('likes', distinct=True),
            count_comments=Count('comments', distinct=True),
            has_liked=Exists(
                PostLikes.objects.filter(
                    post__id=OuterRef('id'),
                    user__id=request.user.id if request.user.id else -1
                )
            ),
        ), author__username=username, url=url)

        if request.method == 'GET':
            if request.GET.get('mode') == 'edit':
                if not request.user == post.author:
                    raise Http404

                return StatusDone({
                    'image': post.get_thumbnail(),
                    'title': post.title,
                    'url': post.url,
                    'description': post.meta_description,
                    'series': {
                        'id': str(post.series.id),
                        'name': post.series.name,
                    } if post.series else None,
                    'text_html': post.content.text_html,  # Now sending HTML instead of markdown
                    'tags': post.tagging(),
                    'is_hide': post.config.hide,
                    'is_notice': post.config.notice,
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
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y-%m-%d %H:%M'),
                    'updated_date': convert_to_localtime(post.updated_date).strftime('%Y-%m-%d %H:%M'),
                    'author_image': str(post.author_image),
                    'author': post.author_username,
                    'rendered_content': post.content.text_html,
                    'count_likes': post.count_likes,
                    'count_comments': post.count_comments,
                    'is_ad': post.config.advertise,
                    'tags': post.tagging(),
                    'is_liked': post.has_liked,
                })

        if request.method == 'POST':
            if not request.user == post.author:
                raise Http404

            title = request.POST.get('title', '')
            text_html = request.POST.get('text_html', '')

            if not title:
                return StatusError(ErrorCode.VALIDATE, '제목을 입력해주세요.')
            if not text_html:
                return StatusError(ErrorCode.VALIDATE, '내용을 입력해주세요.')

            read_time = calc_read_time(text_html)

            post.title = title
            post.read_time = read_time

            description = request.POST.get('description', '')
            if description:
                post.meta_description = description

            series_url = request.POST.get('series', '')
            if not series_url:
                post.series = None
            else:
                series = Series.objects.filter(
                    owner=request.user,
                    url=series_url
                )
                if series.exists():
                    post.series = series.first()

            try:
                post.image = request.FILES['image']
            except:
                pass

            post_content = post.content
            post_content.text_html = text_html
            post_content.save()

            post_config = post.config
            post_config.hide = BooleanType(request.POST.get('is_hide', ''))
            post_config.advertise = BooleanType(
                request.POST.get('is_advertise', ''))
            post_config.save()

            if post_config.hide:
                pinned_post = PinnedPost.objects.filter(post=post)
                if pinned_post.exists():
                    pinned_post.delete()

            if post.is_published():
                post.updated_date = timezone.now()

            post.save()
            post.set_tags(request.POST.get('tag', ''))

            return StatusDone()

        if request.method == 'PUT':
            put = QueryDict(request.body)

            if request.GET.get('hide', ''):
                if not request.user == post.author:
                    raise Http404

                pinned_post = PinnedPost.objects.filter(post=post)
                if pinned_post.exists():
                    pinned_post.delete()

                post.config.hide = not post.config.hide
                post.config.save()
                return StatusDone({
                    'is_hide': post.config.hide
                })

            if request.GET.get('tag', ''):
                if not request.user == post.author:
                    raise Http404

                post.set_tags(put.get('tag'))
                return StatusDone({
                    'tag': ','.join(post.tagging())
                })

            if request.GET.get('series', ''):
                if not request.user == post.author:
                    raise Http404

                series_url = put.get('series')
                if not series_url:
                    post.series = None
                    post.save()
                    return StatusDone({
                        'series': None
                    })

                series = Series.objects.filter(
                    owner=request.user,
                    url=series_url
                )
                if series.exists():
                    post.series = series.first()
                else:
                    post.series = None
                post.save()
                return StatusDone({
                    'series': post.series.url if post.series else None
                })

            if request.GET.get('reserved_date', ''):
                if not request.user == post.author:
                    raise Http404
                reserved_date = put.get('reserved_date')
                if reserved_date and not post.is_published():
                    post.created_date = parse_datetime(reserved_date)
                    post.updated_date = parse_datetime(reserved_date)
                    post.save()
                return StatusDone()

        if request.method == 'DELETE':
            if not request.user == post.author:
                raise Http404
            post.delete()
            return StatusDone()

    raise Http404


def user_post_related(request, username, url):
    """
    Get related posts for a specific post based on shared tags.
    """
    if request.method == 'GET':
        post = get_object_or_404(Post.objects.select_related('config').prefetch_related('tags'), 
                                 author__username=username, url=url)
        
        # Check if the post is accessible
        if post.config.hide and (not request.user.is_authenticated or request.user != post.author):
            raise Http404
        
        # Get related posts (posts with similar tags) - limit to 3 for performance
        related_posts = []
        if post.tags.exists():
            # Get tag values for current post
            current_tags = list(post.tags.values_list('value', flat=True))
            
            # Find related posts with shared tags
            related_posts = Post.objects.select_related(
                'author', 'author__profile', 'config'
            ).filter(
                tags__value__in=current_tags,
                config__hide=False,
                created_date__lte=timezone.now(),
            ).exclude(
                id=post.id
            ).annotate(
                author_username=F('author__username'),
                author_image=F('author__profile__avatar'),
            ).order_by('-created_date').distinct()[:3]
        
        return StatusDone({
            'posts': list(map(lambda related_post: {
                'url': related_post.url,
                'title': related_post.title,
                'image': str(related_post.image) if related_post.image else None,
                'meta_description': related_post.meta_description,
                'read_time': related_post.read_time,
                'created_date': convert_to_localtime(related_post.created_date).strftime('%Y-%m-%d'),
                'author_username': related_post.author_username,
                'author_image': str(related_post.author_image) if related_post.author_image else None,
            }, related_posts))
        })
    
    raise Http404
