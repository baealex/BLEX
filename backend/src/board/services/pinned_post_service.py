"""
Pinned Post Service

Business logic for managing user's pinned posts on their profile.
Users can pin up to 6 posts to showcase on their profile page.
"""

from typing import List, Dict, Any

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import F

from board.models import Post, PinnedPost
from board.modules.response import ErrorCode


class PinnedPostError(Exception):
    """Custom exception for pinned post operations"""
    def __init__(self, code: ErrorCode, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class PinnedPostService:
    """Service class for handling pinned post operations"""

    MAX_PINNED_POSTS = 6

    @staticmethod
    def get_user_pinned_posts(user: User) -> List[Dict[str, Any]]:
        """
        Get all pinned posts for a user.

        Args:
            user: User instance

        Returns:
            List of pinned post dictionaries with order
        """
        pinned_posts = PinnedPost.objects.select_related(
            'post', 'post__author'
        ).filter(
            user=user
        ).order_by('order')

        return [{
            'id': pinned.id,
            'order': pinned.order,
            'post': {
                'url': pinned.post.url,
                'title': pinned.post.title,
                'image': str(pinned.post.image) if pinned.post.image else None,
                'created_date': pinned.post.created_date,
            }
        } for pinned in pinned_posts]

    @staticmethod
    def get_pinnable_posts(user: User) -> List[Dict[str, Any]]:
        """
        Get all posts that can be pinned by the user.
        Excludes hidden posts and already pinned posts.

        Args:
            user: User instance

        Returns:
            List of pinnable post dictionaries
        """
        pinned_post_ids = PinnedPost.objects.filter(
            user=user
        ).values_list('post_id', flat=True)

        posts = Post.objects.filter(
            author=user,
            config__hide=False
        ).exclude(
            id__in=pinned_post_ids
        ).order_by('-created_date')

        return [{
            'url': post.url,
            'title': post.title,
            'image': str(post.image) if post.image else None,
            'created_date': post.created_date,
        } for post in posts]

    @staticmethod
    @transaction.atomic
    def add_pinned_post(user: User, post_url: str) -> PinnedPost:
        """
        Pin a post to user's profile.

        Args:
            user: User instance
            post_url: URL of the post to pin

        Returns:
            Created PinnedPost instance

        Raises:
            PinnedPostError: If validation fails
        """
        # Check if user has reached the limit
        current_count = PinnedPost.objects.filter(user=user).count()
        if current_count >= PinnedPostService.MAX_PINNED_POSTS:
            raise PinnedPostError(
                ErrorCode.REJECT,
                f'최대 {PinnedPostService.MAX_PINNED_POSTS}개까지 고정할 수 있습니다.'
            )

        # Get the post
        try:
            post = Post.objects.select_related('config').get(
                author=user,
                url=post_url
            )
        except Post.DoesNotExist:
            raise PinnedPostError(
                ErrorCode.REJECT,
                '글을 찾을 수 없습니다.'
            )

        # Check if post is hidden
        if post.config.hide:
            raise PinnedPostError(
                ErrorCode.REJECT,
                '숨김 처리된 글은 고정할 수 없습니다.'
            )

        # Check if already pinned
        if PinnedPost.objects.filter(user=user, post=post).exists():
            raise PinnedPostError(
                ErrorCode.REJECT,
                '이미 고정된 글입니다.'
            )

        # Get the next order number
        max_order = PinnedPost.objects.filter(user=user).order_by('-order').first()
        next_order = (max_order.order + 1) if max_order else 0

        # Create pinned post
        pinned_post = PinnedPost.objects.create(
            user=user,
            post=post,
            order=next_order
        )

        return pinned_post

    @staticmethod
    @transaction.atomic
    def remove_pinned_post(user: User, post_url: str) -> None:
        """
        Remove a pinned post from user's profile.

        Args:
            user: User instance
            post_url: URL of the post to unpin

        Raises:
            PinnedPostError: If post is not found or not pinned
        """
        try:
            pinned_post = PinnedPost.objects.select_related('post').get(
                user=user,
                post__url=post_url
            )
        except PinnedPost.DoesNotExist:
            raise PinnedPostError(
                ErrorCode.REJECT,
                '고정된 글을 찾을 수 없습니다.'
            )

        deleted_order = pinned_post.order
        pinned_post.delete()

        # Reorder remaining pinned posts
        PinnedPost.objects.filter(
            user=user,
            order__gt=deleted_order
        ).update(order=F('order') - 1)

    @staticmethod
    @transaction.atomic
    def reorder_pinned_posts(user: User, post_urls: List[str]) -> None:
        """
        Reorder pinned posts based on the provided order.

        Args:
            user: User instance
            post_urls: List of post URLs in desired order

        Raises:
            PinnedPostError: If validation fails
        """
        if len(post_urls) > PinnedPostService.MAX_PINNED_POSTS:
            raise PinnedPostError(
                ErrorCode.REJECT,
                f'최대 {PinnedPostService.MAX_PINNED_POSTS}개까지 고정할 수 있습니다.'
            )

        # Get all current pinned posts for the user
        current_pinned = {
            p.post.url: p
            for p in PinnedPost.objects.select_related('post').filter(user=user)
        }

        # Validate all URLs are currently pinned
        for url in post_urls:
            if url not in current_pinned:
                raise PinnedPostError(
                    ErrorCode.REJECT,
                    f'고정되지 않은 글이 포함되어 있습니다: {url}'
                )

        # Update order
        for index, url in enumerate(post_urls):
            pinned = current_pinned[url]
            if pinned.order != index:
                pinned.order = index
                pinned.save(update_fields=['order'])
