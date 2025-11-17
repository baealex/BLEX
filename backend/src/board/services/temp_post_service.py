"""
Temp Post Service

Business logic for temporary post operations.
Extracted from views to improve testability and reusability.
"""

from typing import Optional, List
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from board.models import TempPosts
from board.modules.response import ErrorCode
from modules.randomness import randstr


class TempPostValidationError(Exception):
    """Custom exception for temp post validation errors"""
    def __init__(self, code: ErrorCode, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class TempPostService:
    """Service class for handling temporary post-related business logic"""

    # Maximum number of temp posts per user
    MAX_TEMP_POSTS_PER_USER = 100

    @staticmethod
    def validate_user_permissions(user: User) -> None:
        """
        Validate if user has permission to manage temp posts.

        Args:
            user: User instance to validate

        Raises:
            TempPostValidationError: If user doesn't have permission
        """
        if not user.is_active:
            raise TempPostValidationError(
                ErrorCode.NEED_LOGIN,
                '로그인이 필요합니다.'
            )

    @staticmethod
    def check_user_temp_post_limit(user: User) -> None:
        """
        Check if user has reached the limit of temp posts.

        Args:
            user: User instance

        Raises:
            TempPostValidationError: If limit is reached
        """
        temp_post_count = TempPosts.objects.filter(author=user).count()
        if temp_post_count >= TempPostService.MAX_TEMP_POSTS_PER_USER:
            raise TempPostValidationError(
                ErrorCode.SIZE_OVERFLOW,
                f'임시 저장 글은 최대 {TempPostService.MAX_TEMP_POSTS_PER_USER}개까지 가능합니다.'
            )

    @staticmethod
    def generate_unique_token(user: User) -> str:
        """
        Generate unique token for temp post.

        Args:
            user: Post author

        Returns:
            Unique token string
        """
        token = randstr(25)
        while TempPosts.objects.filter(token=token, author=user).exists():
            token = randstr(25)
        return token

    @staticmethod
    def find_existing_temp_post(user: User, content: str) -> Optional[TempPosts]:
        """
        Find existing temp post with similar content.

        Args:
            user: Post author
            content: Post content

        Returns:
            TempPosts instance or None
        """
        return TempPosts.objects.filter(
            author=user,
            text_md=content
        ).first()

    @staticmethod
    @transaction.atomic
    def create_temp_post(
        user: User,
        title: str = '',
        content: str = '',
        tags: Optional[List[str]] = None
    ) -> TempPosts:
        """
        Create a new temporary post or update existing one.

        Args:
            user: Post author
            title: Post title (optional, defaults to '제목 없음')
            content: Post content
            tags: List of tags (optional)

        Returns:
            TempPosts instance

        Raises:
            TempPostValidationError: If validation fails
        """
        # Validate permissions
        TempPostService.validate_user_permissions(user)

        # Check temp post limit
        TempPostService.check_user_temp_post_limit(user)

        # Process title and tags
        if not title or not title.strip():
            title = '제목 없음'

        tag_string = ''
        if tags:
            if isinstance(tags, list):
                tag_string = ','.join(tags) if tags else ''
            else:
                tag_string = str(tags) if tags else ''

        # Try to find existing temp post with same content
        existing_temp = TempPostService.find_existing_temp_post(user, content)

        if existing_temp:
            # Update existing temp post
            existing_temp.title = title
            existing_temp.text_md = content
            existing_temp.tag = tag_string
            existing_temp.updated_date = timezone.now()
            existing_temp.save()
            return existing_temp
        else:
            # Create new temp post
            token = TempPostService.generate_unique_token(user)
            temp_post = TempPosts(
                token=token,
                author=user,
                title=title,
                text_md=content,
                tag=tag_string
            )
            temp_post.save()
            return temp_post

    @staticmethod
    @transaction.atomic
    def update_temp_post(
        temp_post: TempPosts,
        title: Optional[str] = None,
        content: Optional[str] = None,
        tags: Optional[str] = None
    ) -> TempPosts:
        """
        Update existing temporary post.

        Args:
            temp_post: TempPosts instance to update
            title: New title (optional)
            content: New content (optional)
            tags: New tags (optional)

        Returns:
            Updated TempPosts instance
        """
        if title is not None:
            temp_post.title = title

        if content is not None:
            temp_post.text_md = content

        if tags is not None:
            temp_post.tag = tags

        temp_post.updated_date = timezone.now()
        temp_post.save()
        return temp_post

    @staticmethod
    @transaction.atomic
    def delete_temp_post(temp_post: TempPosts) -> None:
        """
        Delete temporary post.

        Args:
            temp_post: TempPosts instance to delete
        """
        temp_post.delete()

    @staticmethod
    def get_user_temp_posts(user: User):
        """
        Get all temporary posts for a user.

        Args:
            user: Post author

        Returns:
            QuerySet of TempPosts
        """
        return TempPosts.objects.filter(author=user)

    @staticmethod
    def can_user_access_temp_post(user: User, temp_post: TempPosts) -> bool:
        """
        Check if user can access the temp post.

        Args:
            user: User instance
            temp_post: TempPosts instance

        Returns:
            True if user can access, False otherwise
        """
        return user.is_authenticated and (
            user == temp_post.author or user.is_staff
        )
