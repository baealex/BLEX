from __future__ import annotations

from django.db.models import (
    CharField,
    Count,
    Exists,
    IntegerField,
    OuterRef,
    QuerySet,
    Subquery,
    Value,
)
from django.db.models.functions import Coalesce

from board.models import Comment, Post, PostLikes, Series
from board.services.public_post_service import PublicPostService


class PublicSeriesService:
    """Shared public visibility rules for Series surfaces."""

    DEFAULT_PUBLIC_POST_COUNT_FIELD = 'public_post_count'

    @staticmethod
    def build_public_post_count_annotation(posts_prefix: str = 'posts') -> Count:
        return Count(
            posts_prefix,
            filter=PublicPostService.build_public_filter(posts_prefix),
            distinct=True,
        )

    @staticmethod
    def with_public_post_count(
        queryset: QuerySet[Series],
        count_field: str = DEFAULT_PUBLIC_POST_COUNT_FIELD,
    ) -> QuerySet[Series]:
        return queryset.annotate(
            **{count_field: PublicSeriesService.build_public_post_count_annotation()}
        )

    @staticmethod
    def with_public_thumbnail(queryset: QuerySet[Series]) -> QuerySet[Series]:
        """Annotate the first public post image without an N+1 lookup."""
        thumbnail = PublicPostService.filter_public_posts(
            Post.objects.filter(series_id=OuterRef('pk'))
        ).order_by('pk').values('image')[:1]
        return queryset.annotate(
            public_thumbnail=Subquery(thumbnail, output_field=CharField())
        )

    @staticmethod
    def filter_public_series(
        queryset: QuerySet[Series],
        count_field: str = DEFAULT_PUBLIC_POST_COUNT_FIELD,
    ) -> QuerySet[Series]:
        return PublicSeriesService.with_public_post_count(queryset, count_field).filter(
            hide=False,
            **{f'{count_field}__gte': 1},
        )

    @staticmethod
    def filter_public_series_exists(queryset: QuerySet[Series]) -> QuerySet[Series]:
        """Filter public series without grouping every matching post.

        Detail routes only need to prove that one public post exists. An EXISTS
        predicate avoids the aggregate join used by list routes, where a count is
        part of the response.
        """
        public_posts = PublicPostService.filter_public_posts(
            Post.objects.filter(series_id=OuterRef('pk'))
        )
        return queryset.annotate(has_public_posts=Exists(public_posts)).filter(
            hide=False,
            has_public_posts=True,
        )

    @staticmethod
    def get_public_posts_with_metrics(
        series: Series,
        viewer_id: int | None = None,
    ) -> QuerySet[Post]:
        """Return lightweight public series posts with card metrics."""
        like_counts = PostLikes.objects.filter(post_id=OuterRef('id')).values(
            'post_id'
        ).annotate(total=Count('id')).values('total')
        comment_counts = Comment.objects.filter(post_id=OuterRef('id')).values(
            'post_id'
        ).annotate(total=Count('id')).values('total')
        viewer_likes = PostLikes.objects.filter(
            post_id=OuterRef('id'),
            user_id=viewer_id if viewer_id is not None else -1,
        )
        return PublicPostService.filter_public_posts(
            Post.objects.filter(series=series)
        ).only(
            'id', 'url', 'title', 'published_date', 'read_time', 'meta_description'
        ).annotate(
            count_likes=Coalesce(
                Subquery(like_counts, output_field=IntegerField()),
                Value(0),
            ),
            count_comments=Coalesce(
                Subquery(comment_counts, output_field=IntegerField()),
                Value(0),
            ),
            has_liked=Exists(viewer_likes),
        )

    @staticmethod
    def is_public(series: Series) -> bool:
        if series.hide:
            return False

        return PublicPostService.filter_public_posts(series.posts).exists()
