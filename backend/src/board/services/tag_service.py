"""
Tag Service

Business logic for tag operations.
Extracted from views to improve testability and reusability.
"""

from __future__ import annotations

from typing import Optional, Set, Dict
from django.db.models import F, Count, Case, When, Exists, OuterRef
from django.utils import timezone
from django.utils.text import slugify

from board.models import Tag, PostLikes, Post


class TagService:
    """Service class for handling tag-related business logic"""

    DEFAULT_TAG = '미분류'

    @staticmethod
    def parse_tags(tags: str) -> Set[str]:
        """
        Parse tag string into a set of unique tag values.

        Args:
            tags: Comma, hyphen, or underscore separated tag string

        Returns:
            Set of unique tag values
        """
        tags = tags.replace(',', '-').replace('_', '-')
        parsed = slugify(tags, allow_unicode=True).split('-')
        if len(parsed) == 1 and parsed[0] == '':
            return {TagService.DEFAULT_TAG}
        return set(parsed)

    @staticmethod
    def get_or_create_tags(tag_values: Set[str]) -> Dict[str, Tag]:
        """
        Get existing tags or create new ones efficiently using bulk operations.

        Args:
            tag_values: Set of tag values to get or create

        Returns:
            Dictionary mapping tag values to Tag instances
        """
        existing_tags = {t.value: t for t in Tag.objects.filter(value__in=tag_values)}
        new_tag_values = tag_values - set(existing_tags.keys())

        if new_tag_values:
            Tag.objects.bulk_create(
                [Tag(value=tag) for tag in new_tag_values],
                ignore_conflicts=True
            )
            new_tags = Tag.objects.filter(value__in=new_tag_values)
            existing_tags.update({t.value: t for t in new_tags})

        return existing_tags

    @staticmethod
    def set_post_tags(post: 'Post', tags: str) -> None:
        """
        Set tags for a post, parsing the tag string and creating/linking tags.

        Args:
            post: Post instance to set tags for
            tags: Tag string to parse
        """
        post.tags.clear()
        unique_tags = TagService.parse_tags(tags)
        tag_objects = TagService.get_or_create_tags(unique_tags)
        post.tags.add(*tag_objects.values())

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
            published_date__isnull=False,
            published_date__lte=timezone.now(),
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
