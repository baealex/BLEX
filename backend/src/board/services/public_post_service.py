from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import Q, QuerySet

if TYPE_CHECKING:
    from board.models import Post

from board.services.post_status_service import PostStatusService


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
        return PostStatusService.build_published_filter(relation) & Q(**{
            f'{prefix}config__hide': False,
        })

    @staticmethod
    def filter_public_posts(queryset: QuerySet) -> QuerySet:
        return queryset.filter(PublicPostService.build_public_filter())

    @staticmethod
    def is_public(post: Post) -> bool:
        if not PostStatusService.is_published(post):
            return False
        if hasattr(post, 'config') and post.config.hide:
            return False
        return True
