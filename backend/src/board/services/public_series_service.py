from __future__ import annotations

from django.db.models import Count, QuerySet

from board.models import Series
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
    def filter_public_series(
        queryset: QuerySet[Series],
        count_field: str = DEFAULT_PUBLIC_POST_COUNT_FIELD,
    ) -> QuerySet[Series]:
        return PublicSeriesService.with_public_post_count(queryset, count_field).filter(
            hide=False,
            **{f'{count_field}__gte': 1},
        )

    @staticmethod
    def is_public(series: Series) -> bool:
        if series.hide:
            return False

        return PublicPostService.filter_public_posts(series.posts).exists()
