import random
import datetime

from django.conf import settings
from django.db.models import (
    Q, F, Case, Exists, When, Subquery,
    Value, OuterRef, Count,  IntegerField)
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify

from board.models import (
    Comment, Series, TempPosts, Post, PostContent,
    PostConfig, PinnedPost, PostLikes)
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
    if request.method == 'POST':
        if not request.user.is_authenticated:
            raise Http404

        try:
            image = request.FILES.get('image', None)

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
                is_notice=BooleanType(request.POST.get('is_notice', '')),
                is_advertise=BooleanType(request.POST.get('is_advertise', '')),
                temp_post_token=request.POST.get('token', '')
            )

            return StatusDone({
                'url': post.url,
            })

        except PostValidationError as e:
            return StatusError(e.code, e.message)

    raise Http404


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

            post.title = title

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

            if 'image_delete' in request.POST and request.POST.get('image_delete') == 'true':
                if post.image:
                    post.image.delete(save=False)
                    post.image = None
            elif 'image' in request.FILES:
                if post.image:
                    post.image.delete(save=False)
                post.image = request.FILES['image']

            post_content = post.content
            post_content.text_html = text_html
            post_content.save()

            post_config = post.config
            post_config.hide = BooleanType(request.POST.get('is_hide', ''))
            post_config.notice = BooleanType(request.POST.get('is_notice', ''))
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

            if request.GET.get('notice', ''):
                if not request.user == post.author:
                    raise Http404

                post.config.notice = not post.config.notice
                post.config.save()
                return StatusDone({
                    'is_notice': post.config.notice
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
    Get related posts for a specific post based on shared tags and popularity.
    Uses a scoring system to rank relevance.
    """
    if request.method == 'GET':
        post = get_object_or_404(Post.objects.select_related('config').prefetch_related('tags'),
                                 author__username=username, url=url)

        if post.config.hide and (not request.user.is_authenticated or request.user != post.author):
            raise Http404

        related_posts = []
        if post.tags.exists():
            current_tags = list(post.tags.values_list('value', flat=True))
            current_tag_set = set(current_tags)

            candidates = Post.objects.select_related(
                'author', 'author__profile', 'config'
            ).prefetch_related('tags').filter(
                tags__value__in=current_tags,
                config__hide=False,
                created_date__lte=timezone.now(),
            ).exclude(
                id=post.id
            ).annotate(
                author_username=F('author__username'),
                author_image=F('author__profile__avatar'),
                likes_count=Count('likes', distinct=True),
                comments_count=Count('comments', distinct=True),
            ).distinct()

            scored_posts = []
            now = timezone.now()

            for candidate in candidates:
                score = 0

                candidate_tags = set(candidate.tags.values_list('value', flat=True))
                tag_overlap = len(current_tag_set & candidate_tags)
                tag_score = min(tag_overlap * 3, 10)
                score += tag_score

                popularity = (candidate.likes_count * 2) + candidate.comments_count
                popularity_score = min(popularity, 10)
                score += popularity_score

                days_old = (now - candidate.created_date).days
                if days_old < 7:
                    recency_score = 5
                elif days_old < 30:
                    recency_score = 3
                elif days_old < 90:
                    recency_score = 1
                else:
                    recency_score = 0
                score += recency_score

                if candidate.author.id == post.author.id:
                    score -= 5

                random_score = random.uniform(-3, 3)
                score += random_score

                scored_posts.append({
                    'post': candidate,
                    'score': score,
                    'tag_overlap': tag_overlap,
                })

            scored_posts.sort(key=lambda x: (x['score'], x['tag_overlap']), reverse=True)

            related_posts = map(lambda x: x['post'], scored_posts[:6])

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
