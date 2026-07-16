"""Read services for the post-management sections of user settings."""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar, Iterable, TypedDict

from django.contrib.auth.models import User
from django.db.models import (
    Count, IntegerField, OuterRef, Q, QuerySet, Subquery, Value,
)
from django.db.models.functions import Coalesce
from django.http import Http404

from board.models import Comment, Post, PostLikes, Series
from board.modules.paginator import Paginator
from board.modules.time import convert_to_localtime
from board.services.post_status_service import PostStatusService


class PostManagementQueryError(ValueError):
    """Raised when a post-management query cannot be served."""


@dataclass(frozen=True)
class PostManagementQuery:
    tag: str = ''
    series: str = ''
    search: str = ''
    visibility: str = ''
    order: str = ''
    page: int = 1


class PostManagementPostData(TypedDict):
    url: str
    title: str
    image: str | None
    created_date: str
    updated_date: str
    is_hide: bool
    count_likes: int
    count_comments: int
    read_time: int
    tag: str
    series: str


class PostManagementData(TypedDict):
    username: str
    posts: list[PostManagementPostData]
    last_page: int
    total_count: int


class PostManagementTagData(TypedDict):
    name: str | None
    count: int


class PostManagementTagsData(TypedDict):
    username: str
    tags: list[PostManagementTagData]


class PostManagementSeriesData(TypedDict):
    id: int
    url: str
    title: str
    total_posts: int


class PostManagementSeriesListData(TypedDict):
    username: str
    series: list[PostManagementSeriesData]


class SettingPostManagementService:
    """Build and serialize existing settings post-management responses."""

    POST_MANAGEMENT_ORDERS: ClassVar[set[str]] = {
        'title',
        'read_time',
        'published_date',
        'updated_date',
        'count_likes',
        'count_comments',
    }

    @staticmethod
    def get_post_management_queryset(
        user: User,
        *,
        scheduled: bool = False,
    ) -> QuerySet[Post]:
        like_counts = PostLikes.objects.filter(
            post_id=OuterRef('id'),
        ).values('post_id').annotate(
            total=Count('id'),
        ).values('total')
        comment_counts = Comment.objects.filter(
            post_id=OuterRef('id'),
        ).values('post_id').annotate(
            total=Count('id'),
        ).values('total')
        posts = Post.objects.select_related(
            'config',
            'series',
        ).prefetch_related(
            'tags',
        ).annotate(
            count_likes=Coalesce(
                Subquery(like_counts, output_field=IntegerField()),
                Value(0),
            ),
            count_comments=Coalesce(
                Subquery(comment_counts, output_field=IntegerField()),
                Value(0),
            ),
        ).filter(
            author=user,
        ).order_by('-published_date')
        if scheduled:
            return PostStatusService.filter_scheduled(posts)
        return PostStatusService.filter_published(posts)

    @staticmethod
    def apply_post_management_filters(
        posts: QuerySet[Post],
        query: PostManagementQuery,
    ) -> QuerySet[Post]:
        if query.tag:
            posts = posts.filter(tags__value=query.tag)

        if query.series:
            posts = posts.filter(series__url=query.series)

        if query.search:
            posts = posts.filter(title__icontains=query.search)

        if query.visibility == 'public':
            posts = posts.filter(config__hide=False)
        elif query.visibility == 'hidden':
            posts = posts.filter(config__hide=True)

        return posts

    @staticmethod
    def apply_post_management_order(
        posts: QuerySet[Post],
        query: PostManagementQuery,
    ) -> QuerySet[Post]:
        if not query.order:
            return posts

        normalized_order = query.order[1:] if query.order.startswith('-') else query.order
        if normalized_order not in SettingPostManagementService.POST_MANAGEMENT_ORDERS:
            raise PostManagementQueryError('Unsupported post-management order.')

        return posts.order_by(query.order)

    @staticmethod
    def paginate_post_management_posts(
        posts: QuerySet[Post],
        page: int,
        total_count: int,
    ) -> tuple[Iterable[Post], int]:
        if page < 1:
            raise PostManagementQueryError('Invalid post-management page.')

        if total_count == 0:
            if page > 1:
                raise PostManagementQueryError('Invalid post-management page.')
            return [], 1

        try:
            page_posts = Paginator(
                objects=posts,
                offset=10,
                page=page,
            )
        except Http404 as error:
            raise PostManagementQueryError('Invalid post-management page.') from error

        return page_posts, page_posts.paginator.num_pages

    @staticmethod
    def serialize_post_management_post(
        post: Post,
        *,
        date_format: str,
    ) -> PostManagementPostData:
        count_likes = getattr(post, 'count_likes', None)
        if count_likes is None:
            count_likes = post.likes.count()

        count_comments = getattr(post, 'count_comments', None)
        if count_comments is None:
            count_comments = post.comments.count()

        return {
            'url': post.url,
            'title': post.title,
            'image': str(post.image) if post.image else None,
            'created_date': convert_to_localtime(post.published_date).strftime(date_format),
            'updated_date': convert_to_localtime(post.updated_date).strftime('%Y-%m-%d'),
            'is_hide': post.config.hide,
            'count_likes': count_likes,
            'count_comments': count_comments,
            'read_time': post.read_time,
            'tag': ','.join(post.tagging()),
            'series': post.series.url if post.series else '',
        }

    @staticmethod
    def get_post_management_data(
        user: User,
        query: PostManagementQuery,
        *,
        username: str,
        scheduled: bool = False,
    ) -> PostManagementData:
        posts = SettingPostManagementService.get_post_management_queryset(
            user,
            scheduled=scheduled,
        )
        posts = SettingPostManagementService.apply_post_management_filters(posts, query)
        posts = SettingPostManagementService.apply_post_management_order(posts, query)
        total_count = posts.count()
        page_posts, last_page = SettingPostManagementService.paginate_post_management_posts(
            posts,
            query.page,
            total_count,
        )
        date_format = '%Y-%m-%d %H:%M' if scheduled else '%Y-%m-%d'

        return {
            'username': username,
            'posts': [
                SettingPostManagementService.serialize_post_management_post(
                    post,
                    date_format=date_format,
                )
                for post in page_posts
            ],
            'last_page': last_page,
            'total_count': total_count,
        }

    @staticmethod
    def get_tag_management_data(user: User) -> PostManagementTagsData:
        tags = Post.objects.filter(
            author=user,
        ).values(
            'tags__value',
        ).annotate(
            count=Count('tags__value'),
        ).order_by('-count')

        return {
            'username': user.username,
            'tags': [
                {
                    'name': tag['tags__value'],
                    'count': tag['count'],
                }
                for tag in tags
            ],
        }

    @staticmethod
    def get_series_management_data(user: User) -> PostManagementSeriesListData:
        series_items = Series.objects.filter(
            owner=user,
        ).annotate(
            total_posts=Count(
                'posts',
                filter=Q(posts__deleted_date__isnull=True),
            ),
        ).order_by('order', '-id')

        return {
            'username': user.username,
            'series': [
                {
                    'id': series_item.id,
                    'url': series_item.url,
                    'title': series_item.name,
                    'total_posts': series_item.total_posts,
                }
                for series_item in series_items
            ],
        }
