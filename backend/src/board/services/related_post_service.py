"""Candidate selection and scoring for related posts."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Callable, ClassVar

from django.db.models import (
    Case,
    Count,
    Exists,
    ExpressionWrapper,
    F,
    FloatField,
    IntegerField,
    OuterRef,
    Q,
    QuerySet,
    Value,
    When,
)
from django.db.models.functions import Cast, Least
from django.utils import timezone

from board.models import Post
from board.services.public_post_service import PublicPostService


RelatedPostJitter = Callable[[float, float], float]


class RelatedPostService:
    """Return deterministic public recommendations led by tag relevance."""

    MAX_RELATED_POSTS: ClassVar[int] = 8
    TAG_OVERLAP_WEIGHT: ClassVar[int] = 3
    MAX_TAG_SCORE: ClassVar[int] = 10
    LIKE_WEIGHT: ClassVar[int] = 2
    MAX_POPULARITY_SCORE: ClassVar[int] = 10

    @staticmethod
    def calculate_tag_score(
        candidate_tags: set[str],
        current_tag_set: set[str],
    ) -> tuple[int, int]:
        tag_overlap = len(current_tag_set & candidate_tags)
        return min(
            tag_overlap * RelatedPostService.TAG_OVERLAP_WEIGHT,
            RelatedPostService.MAX_TAG_SCORE,
        ), tag_overlap

    @staticmethod
    def calculate_popularity_score(
        likes_count: int,
        comments_count: int,
    ) -> int:
        popularity = (
            likes_count * RelatedPostService.LIKE_WEIGHT
        ) + comments_count
        return min(popularity, RelatedPostService.MAX_POPULARITY_SCORE)

    @staticmethod
    def calculate_recency_score(
        published_date: datetime,
        now: datetime,
    ) -> int:
        days_old = (now - published_date).days
        if days_old < 7:
            return 5
        if days_old < 30:
            return 3
        if days_old < 90:
            return 1
        return 0

    @classmethod
    def get_candidates(
        cls,
        post: Post,
        current_tags: list[str],
        *,
        now: datetime | None = None,
    ) -> QuerySet[Post]:
        ranking_time = now or timezone.now()
        shared_tag_match = Post.tags.through.objects.filter(
            post_id=OuterRef('pk'),
            tag__value__in=current_tags,
        )
        tag_union_count = (
            Value(len(current_tags))
            + F('candidate_tag_count')
            - F('candidate_tag_overlap')
        )

        candidates = PublicPostService.filter_public_posts(
            Post.objects.select_related(
                'author', 'author__profile', 'config'
            )
        ).exclude(
            id=post.id
        ).alias(
            has_shared_tag=Exists(shared_tag_match),
        ).filter(
            has_shared_tag=True,
        ).annotate(
            author_username=F('author__username'),
            author_name=F('author__first_name'),
            author_image=F('author__profile__avatar'),
            candidate_tag_overlap=Count(
                'tags',
                filter=Q(tags__value__in=current_tags),
                distinct=True,
            ),
            candidate_tag_count=Count('tags', distinct=True),
            likes_count=Count('likes', distinct=True),
            comments_count=Count('comments', distinct=True),
        )

        candidates = candidates.annotate(
            tag_score=Least(
                F('candidate_tag_overlap') * Value(cls.TAG_OVERLAP_WEIGHT),
                Value(cls.MAX_TAG_SCORE),
                output_field=IntegerField(),
            ),
            tag_similarity=ExpressionWrapper(
                Cast(F('candidate_tag_overlap'), FloatField())
                / Cast(tag_union_count, FloatField()),
                output_field=FloatField(),
            ),
            popularity_score=Least(
                (
                    F('likes_count') * Value(cls.LIKE_WEIGHT)
                    + F('comments_count')
                ),
                Value(cls.MAX_POPULARITY_SCORE),
                output_field=IntegerField(),
            ),
            recency_score=Case(
                When(
                    published_date__gt=ranking_time - timedelta(days=7),
                    then=Value(5),
                ),
                When(
                    published_date__gt=ranking_time - timedelta(days=30),
                    then=Value(3),
                ),
                When(
                    published_date__gt=ranking_time - timedelta(days=90),
                    then=Value(1),
                ),
                default=Value(0),
                output_field=IntegerField(),
            ),
            same_author_rank=Case(
                When(author_id=post.author_id, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            ),
        ).annotate(
            quality_score=F('popularity_score') + F('recency_score'),
        )

        return candidates.order_by(
            '-tag_score',
            '-candidate_tag_overlap',
            '-tag_similarity',
            'same_author_rank',
            '-quality_score',
            '-published_date',
            '-pk',
        )

    @classmethod
    def get_related_posts(
        cls,
        post: Post,
        *,
        jitter: RelatedPostJitter | None = None,
    ) -> list[Post]:
        """Return the top matches; ``jitter`` remains accepted for compatibility."""
        current_tags = [tag.value for tag in post.tags.all()]
        if not current_tags:
            return []

        candidates = cls.get_candidates(post, current_tags)
        return list(candidates[:cls.MAX_RELATED_POSTS])
