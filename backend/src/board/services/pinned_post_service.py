"""
Pinned Post Service

Business logic for managing user's pinned posts on their profile.
Users can pin up to 6 posts to showcase on their profile page.
"""

import math

from typing import List, Dict, Any, Optional, Tuple, Union

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import F

from board.models import Post, PinnedPost
from board.modules.response import ErrorCode
from board.services.authoring_permission_service import AuthoringPermissionService
from board.services.public_post_service import PublicPostService


class PinnedPostError(Exception):
    """Custom exception for pinned post operations"""
    def __init__(self, code: ErrorCode, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class PinnedPostService:
    """Service class for handling pinned post operations"""

    MAX_PINNED_POSTS = 6
    DEFAULT_PINNABLE_POSTS_LIMIT = 30
    MAX_PINNABLE_POSTS_LIMIT = 100
    MAX_PINNABLE_SEARCH_QUERY_LENGTH = 100

    @staticmethod
    def _is_published_post(post: Post) -> bool:
        """Return True when the post is published and already visible."""
        return PublicPostService.is_public(post)

    @staticmethod
    def validate_user_permissions(user: User) -> None:
        if not AuthoringPermissionService.is_active_editor(user):
            raise PinnedPostError(
                ErrorCode.REJECT,
                '작가 권한이 필요합니다.',
            )

    @staticmethod
    def normalize_pinnable_post_filters(
        query: Optional[str] = '',
        limit: Optional[Union[int, str]] = None,
        page: Optional[Union[int, str]] = None,
    ) -> Tuple[str, Optional[int], int, bool]:
        normalized_query = (query or '').strip()[:PinnedPostService.MAX_PINNABLE_SEARCH_QUERY_LENGTH]
        has_pagination = limit is not None or page is not None

        if has_pagination:
            try:
                normalized_limit = int(limit) if limit is not None else PinnedPostService.DEFAULT_PINNABLE_POSTS_LIMIT
            except (TypeError, ValueError):
                normalized_limit = PinnedPostService.DEFAULT_PINNABLE_POSTS_LIMIT

            normalized_limit = max(
                1,
                min(normalized_limit, PinnedPostService.MAX_PINNABLE_POSTS_LIMIT),
            )
        else:
            normalized_limit = None

        try:
            normalized_page = int(page) if page is not None else 1
        except (TypeError, ValueError):
            raise PinnedPostError(
                ErrorCode.INVALID_PARAMETER,
                '잘못된 페이지입니다.',
            )

        if normalized_page < 1:
            raise PinnedPostError(
                ErrorCode.INVALID_PARAMETER,
                '잘못된 페이지입니다.',
            )

        return normalized_query, normalized_limit, normalized_page, has_pagination

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
            PublicPostService.build_public_filter('post'),
            user=user,
        ).order_by('order')

        return [{
            'id': pinned.id,
            'order': pinned.order,
            'post': {
                'url': pinned.post.url,
                'title': pinned.post.title,
                'image': str(pinned.post.image) if pinned.post.image else None,
                'created_date': pinned.post.published_date.strftime('%Y-%m-%d') if pinned.post.published_date else '',
            }
        } for pinned in pinned_posts]

    @staticmethod
    def get_pinnable_posts(
        user: User,
        query: Optional[str] = '',
        limit: Optional[Union[int, str]] = None,
        page: Optional[Union[int, str]] = None,
    ) -> Dict[str, Any]:
        """
        Get all posts that can be pinned by the user.
        Excludes hidden posts and already pinned posts.

        Args:
            user: User instance
            query: Optional post title search query
            limit: Maximum number of posts to return
            page: Page number to return

        Returns:
            Paginated pinnable post dictionaries
        """
        PinnedPostService.validate_user_permissions(user)
        query, limit, page, has_pagination = PinnedPostService.normalize_pinnable_post_filters(
            query,
            limit,
            page,
        )

        pinned_post_ids = PinnedPost.objects.filter(
            user=user
        ).values_list('post_id', flat=True)

        posts = PublicPostService.filter_public_posts(
            Post.objects.filter(author=user)
        ).exclude(
            id__in=pinned_post_ids
        ).order_by('-published_date', '-id')

        if query:
            posts = posts.filter(title__icontains=query)

        total_count = posts.count()
        if not has_pagination:
            return {
                'posts': [{
                    'url': post.url,
                    'title': post.title,
                    'image': str(post.image) if post.image else None,
                    'created_date': post.published_date.strftime('%Y-%m-%d') if post.published_date else '',
                } for post in posts],
                'page': 1,
                'limit': total_count,
                'last_page': 1,
                'total_count': total_count,
                'has_next': False,
                'has_previous': False,
            }

        last_page = max(1, math.ceil(total_count / limit))
        page = min(page, last_page)
        offset = (page - 1) * limit
        page_posts = posts[offset:offset + limit]

        return {
            'posts': [{
                'url': post.url,
                'title': post.title,
                'image': str(post.image) if post.image else None,
                'created_date': post.published_date.strftime('%Y-%m-%d') if post.published_date else '',
            } for post in page_posts],
            'page': page,
            'limit': limit,
            'last_page': last_page,
            'total_count': total_count,
            'has_next': page < last_page,
            'has_previous': page > 1,
        }

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
        PinnedPostService.validate_user_permissions(user)

        # Check if user has reached the limit
        current_count = PinnedPost.objects.filter(
            PublicPostService.build_public_filter('post'),
            user=user,
        ).count()
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

        # Draft/scheduled posts cannot be pinned
        if not PinnedPostService._is_published_post(post):
            raise PinnedPostError(
                ErrorCode.REJECT,
                '발행된 포스트만 고정할 수 있습니다.'
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
        PinnedPostService.validate_user_permissions(user)

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
        PinnedPostService.validate_user_permissions(user)

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
