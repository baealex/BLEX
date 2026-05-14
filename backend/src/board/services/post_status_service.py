from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import Q, QuerySet
from django.utils import timezone

if TYPE_CHECKING:
    from board.models import Post


class PostStatusService:
    """Named helpers for draft, scheduled, and published post status."""

    @staticmethod
    def build_draft_filter(relation: str = '') -> Q:
        prefix = f'{relation}__' if relation else ''
        return Q(**{f'{prefix}published_date__isnull': True})

    @staticmethod
    def build_published_filter(relation: str = '') -> Q:
        prefix = f'{relation}__' if relation else ''
        return Q(**{
            f'{prefix}published_date__isnull': False,
            f'{prefix}published_date__lte': timezone.now(),
        })

    @staticmethod
    def build_scheduled_filter(relation: str = '') -> Q:
        prefix = f'{relation}__' if relation else ''
        return Q(**{
            f'{prefix}published_date__isnull': False,
            f'{prefix}published_date__gt': timezone.now(),
        })

    @staticmethod
    def filter_drafts(queryset: QuerySet) -> QuerySet:
        return queryset.filter(PostStatusService.build_draft_filter())

    @staticmethod
    def filter_published(queryset: QuerySet) -> QuerySet:
        return queryset.filter(PostStatusService.build_published_filter())

    @staticmethod
    def filter_scheduled(queryset: QuerySet) -> QuerySet:
        return queryset.filter(PostStatusService.build_scheduled_filter())

    @staticmethod
    def is_draft(post: Post) -> bool:
        return post.published_date is None

    @staticmethod
    def is_published(post: Post) -> bool:
        if post.published_date is None:
            return False
        return post.published_date <= timezone.now()

    @staticmethod
    def is_scheduled(post: Post) -> bool:
        if post.published_date is None:
            return False
        return post.published_date > timezone.now()
