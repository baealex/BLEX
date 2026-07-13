from __future__ import annotations

from dataclasses import dataclass

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction

from board.models import Post, PostLikes


@dataclass(frozen=True)
class PostLikeToggleResult:
    count_likes: int
    has_liked: bool
    created: bool


class PostLikeService:
    """Manage the transactional boundary for template post-like toggles."""

    @staticmethod
    def _create_like(post: Post, user: User) -> bool:
        try:
            with transaction.atomic():
                PostLikes.objects.create(post=post, user=user)
            return True
        except IntegrityError:
            if PostLikes.objects.filter(post=post, user=user).exists():
                return False
            raise

    @staticmethod
    def toggle(post: Post, user: User) -> PostLikeToggleResult:
        with transaction.atomic():
            locked_post = Post.objects.select_for_update().get(pk=post.pk)
            existing_like = PostLikes.objects.filter(
                post=locked_post,
                user=user,
            ).first()

            if existing_like is not None:
                existing_like.delete()
                has_liked = False
                created = False
            else:
                created = PostLikeService._create_like(locked_post, user)
                has_liked = True

            count_likes = PostLikes.objects.filter(post=locked_post).count()

        return PostLikeToggleResult(
            count_likes=count_likes,
            has_liked=has_liked,
            created=created,
        )
