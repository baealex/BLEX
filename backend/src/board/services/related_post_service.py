"""Candidate selection and scoring for related posts."""

from __future__ import annotations

import random

from dataclasses import dataclass
from datetime import datetime
from typing import Callable, ClassVar, cast

from django.db.models import Count, F, Q, QuerySet
from django.utils import timezone

from board.models import Post
from board.services.public_post_service import PublicPostService


RelatedPostJitter = Callable[[float, float], float]


@dataclass(frozen=True)
class ScoredRelatedPost:
    post: Post
    score: float
    tag_overlap: int


class RelatedPostService:
    """Return public related posts using the existing scoring algorithm."""

    MAX_RELATED_POSTS: ClassVar[int] = 8

    @staticmethod
    def calculate_tag_score(
        candidate_tags: set[str],
        current_tag_set: set[str],
    ) -> tuple[int, int]:
        tag_overlap = len(current_tag_set & candidate_tags)
        return min(tag_overlap * 3, 10), tag_overlap

    @staticmethod
    def calculate_popularity_score(
        likes_count: int,
        comments_count: int,
    ) -> int:
        popularity = (likes_count * 2) + comments_count
        return min(popularity, 10)

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

    @staticmethod
    def get_candidates(post: Post, current_tags: list[str]) -> QuerySet[Post]:
        return PublicPostService.filter_public_posts(
            Post.objects.select_related(
                'author', 'author__profile', 'config'
            ).prefetch_related('tags')
        ).exclude(
            id=post.id
        ).annotate(
            author_username=F('author__username'),
            author_name=F('author__first_name'),
            author_image=F('author__profile__avatar'),
            candidate_tag_overlap=Count(
                'tags',
                filter=Q(tags__value__in=current_tags),
                distinct=True,
            ),
            likes_count=Count('likes', distinct=True),
            comments_count=Count('comments', distinct=True),
        ).filter(
            candidate_tag_overlap__gt=0,
        )

    @classmethod
    def get_related_posts(
        cls,
        post: Post,
        *,
        jitter: RelatedPostJitter | None = None,
    ) -> list[Post]:
        current_tags = [tag.value for tag in post.tags.all()]
        if not current_tags:
            return []

        current_tag_set = set(current_tags)
        candidates = cls.get_candidates(post, current_tags)
        scored_posts: list[ScoredRelatedPost] = []
        now = timezone.now()
        jitter_score = jitter if jitter is not None else random.uniform

        for candidate in candidates:
            candidate_tags = {
                tag.value
                for tag in candidate.tags.all()
            }
            tag_score, tag_overlap = cls.calculate_tag_score(
                candidate_tags,
                current_tag_set,
            )
            popularity_score = cls.calculate_popularity_score(
                cast(int, candidate.likes_count),
                cast(int, candidate.comments_count),
            )
            recency_score = cls.calculate_recency_score(
                cast(datetime, candidate.published_date),
                now,
            )

            score = tag_score + popularity_score + recency_score
            if candidate.author.id == post.author.id:
                score -= 5
            score += jitter_score(-3, 3)

            scored_posts.append(ScoredRelatedPost(
                post=candidate,
                score=score,
                tag_overlap=tag_overlap,
            ))

        scored_posts.sort(
            key=lambda item: (item.score, item.tag_overlap),
            reverse=True,
        )
        return [
            item.post
            for item in scored_posts[:cls.MAX_RELATED_POSTS]
        ]
