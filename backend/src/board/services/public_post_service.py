from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import Q, QuerySet
from django.utils import timezone

if TYPE_CHECKING:
    from board.models import Post


class PublicPostService:
    """Shared query helpers for posts visible on public surfaces."""

    @staticmethod
    def build_public_filter(relation: str = '') -> Q:
        """
        Build a reusable public-post condition.

        Args:
            relation: Optional relation path to Post, such as ``posts`` or
                ``series__posts``. Leave empty when filtering Post directly.
        """
        prefix = f'{relation}__' if relation else ''
        return Q(**{
            f'{prefix}published_date__isnull': False,
            f'{prefix}published_date__lte': timezone.now(),
            f'{prefix}config__hide': False,
        })

    @staticmethod
    def filter_public_posts(queryset: QuerySet) -> QuerySet:
        return queryset.filter(PublicPostService.build_public_filter())

    @staticmethod
    def is_public(post: Post) -> bool:
        if post.published_date is None:
            return False
        if post.published_date > timezone.now():
            return False
        if hasattr(post, 'config') and post.config.hide:
            return False
        return True
