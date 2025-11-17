"""
Tag Service

Business logic for tag operations.
Extracted from views to improve testability and reusability.
"""

from typing import Optional
from django.db.models import F, Count, Case, When, Exists, OuterRef
from django.utils import timezone

from board.models import Tag, Post, PostLikes


class TagService:
    """Service class for handling tag-related business logic"""

    @staticmethod
    def get_tag_list_with_count(page: int = 1, offset: int = 50):
        """
        Get list of tags with post count.

        Args:
            page: Page number
            offset: Items per page

        Returns:
            QuerySet of Tag with count annotation
        """
        return Tag.objects.filter(
            posts__config__hide=False
        ).annotate(
            count=Count(
                Case(
                    When(
                        posts__config__hide=False,
                        then='posts'
                    ),
                )
            ),
        ).order_by('-count', 'value')

    @staticmethod
    def get_posts_by_tag(tag_name: str, user_id: Optional[int] = None, page: int = 1, offset: int = 24):
        """
        Get posts filtered by tag.

        Args:
            tag_name: Tag name to filter by
            user_id: Current user ID for like status (optional)
            page: Page number
            offset: Items per page

        Returns:
            QuerySet of Post with annotations
        """
        return Post.objects.select_related(
            'config', 'content'
        ).filter(
            created_date__lte=timezone.now(),
            config__hide=False,
            tags__value=tag_name
        ).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar'),
            count_likes=Count('likes', distinct=True),
            count_comments=Count('comments', distinct=True),
            has_liked=Exists(
                PostLikes.objects.filter(
                    post__id=OuterRef('id'),
                    user__id=user_id if user_id else -1
                )
            ),
        ).order_by('-created_date')

    @staticmethod
    def get_head_post_by_tag(tag_name: str):
        """
        Get the head post for a tag (post with URL matching tag name).

        Args:
            tag_name: Tag name

        Returns:
            Post instance or None
        """
        return Post.objects.filter(
            url=tag_name,
            config__hide=False
        ).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar'),
        ).first()

    @staticmethod
    def tag_exists(tag_name: str) -> bool:
        """
        Check if tag exists and has visible posts.

        Args:
            tag_name: Tag name to check

        Returns:
            True if tag exists with visible posts, False otherwise
        """
        return Tag.objects.filter(
            value=tag_name,
            posts__config__hide=False
        ).exists()

    @staticmethod
    def get_user_tags(username: str):
        """
        Get tags used by a specific user, ordered by usage count.

        Args:
            username: Username

        Returns:
            QuerySet of Tag with count annotation
        """
        return Tag.objects.filter(
            posts__author__username=username,
            posts__config__hide=False,
        ).annotate(
            count=Count(
                Case(
                    When(
                        posts__author__username=username,
                        posts__config__hide=False,
                        then='posts'
                    ),
                )
            )
        ).order_by('-count')
