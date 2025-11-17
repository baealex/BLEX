"""
Series Service

Business logic for series operations.
Extracted from views to improve testability and reusability.
"""

from typing import Optional, List, Tuple
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count, Case, When, F

from board.models import Series, Post
from board.modules.response import ErrorCode


class SeriesValidationError(Exception):
    """Custom exception for series validation errors"""
    def __init__(self, code: ErrorCode, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class SeriesService:
    """Service class for handling series-related business logic"""

    @staticmethod
    def validate_user_permissions(user: User) -> None:
        """
        Validate if user has permission to manage series.

        Args:
            user: User instance to validate

        Raises:
            SeriesValidationError: If user doesn't have permission
        """
        if not user.is_authenticated:
            raise SeriesValidationError(
                ErrorCode.AUTHENTICATION,
                '로그인이 필요합니다.'
            )

    @staticmethod
    def validate_series_data(name: str, url: str = None, require_url: bool = True) -> None:
        """
        Validate series data.

        Args:
            name: Series name
            url: Series URL (optional if auto-generation is enabled)
            require_url: Whether URL is required

        Raises:
            SeriesValidationError: If validation fails
        """
        if not name or not name.strip():
            raise SeriesValidationError(
                ErrorCode.REQUIRE,
                '시리즈 이름을 입력해주세요.'
            )
        if require_url and (not url or not url.strip()):
            raise SeriesValidationError(
                ErrorCode.REQUIRE,
                'URL을 입력해주세요.'
            )

    @staticmethod
    def check_url_duplicate(user: User, url: str, exclude_series_id: Optional[int] = None) -> None:
        """
        Check if series URL is already used by the user.

        Args:
            user: Series owner
            url: URL to check
            exclude_series_id: Series ID to exclude from check (for updates)

        Raises:
            SeriesValidationError: If URL is already used
        """
        query = Series.objects.filter(owner=user, url=url)
        if exclude_series_id:
            query = query.exclude(id=exclude_series_id)

        if query.exists():
            raise SeriesValidationError(
                ErrorCode.DUPLICATE,
                '이미 존재하는 URL입니다.'
            )

    @staticmethod
    def can_user_edit_series(user: User, series: Series) -> bool:
        """
        Check if user can edit the series.

        Args:
            user: User instance
            series: Series instance

        Returns:
            True if user can edit, False otherwise
        """
        return user.is_authenticated and (
            user == series.owner or user.is_staff
        )

    @staticmethod
    @transaction.atomic
    def create_series(
        user: User,
        name: str,
        url: str = '',
        description: str = '',
        post_ids: Optional[List[int]] = None
    ) -> Series:
        """
        Create a new series.

        Args:
            user: Series owner
            name: Series name
            url: Series URL (will be auto-generated from name if empty)
            description: Series description (optional)
            post_ids: List of post IDs to add to series (optional)

        Returns:
            Created Series instance

        Raises:
            SeriesValidationError: If validation fails
        """
        # Validate permissions
        SeriesService.validate_user_permissions(user)

        # Auto-generate URL if not provided
        auto_generate_url = not url or not url.strip()

        # Validate data
        SeriesService.validate_series_data(name, url, require_url=not auto_generate_url)

        # Check URL duplicate only if URL is provided
        if not auto_generate_url:
            SeriesService.check_url_duplicate(user, url)

        # Create series
        series = Series(
            owner=user,
            name=name.strip(),
            text_md=description.strip(),
            text_html=description.strip()
        )

        # Set URL (auto-generate if needed)
        if auto_generate_url:
            series.create_unique_url()
        else:
            series.create_unique_url(url.strip())

        series.save()

        # Add posts to series if provided
        if post_ids:
            SeriesService.add_posts_to_series(series, post_ids)

        return series

    @staticmethod
    @transaction.atomic
    def update_series(
        series: Series,
        name: Optional[str] = None,
        url: Optional[str] = None,
        description: Optional[str] = None,
        post_ids: Optional[List[int]] = None
    ) -> Series:
        """
        Update existing series.

        Args:
            series: Series instance to update
            name: New series name (optional)
            url: New series URL (optional)
            description: New description (optional)
            post_ids: New list of post IDs (optional, replaces existing)

        Returns:
            Updated Series instance

        Raises:
            SeriesValidationError: If validation fails
        """
        # Update fields
        if name is not None:
            name = name.strip()
            if not name:
                raise SeriesValidationError(
                    ErrorCode.REQUIRE,
                    '시리즈 이름을 입력해주세요.'
                )
            series.name = name

        if url is not None:
            url = url.strip()
            if not url:
                raise SeriesValidationError(
                    ErrorCode.REQUIRE,
                    'URL을 입력해주세요.'
                )
            # Check URL duplicate (excluding current series)
            SeriesService.check_url_duplicate(series.owner, url, exclude_series_id=series.id)
            series.url = url

        if description is not None:
            series.text_md = description.strip()
            series.text_html = description.strip()

        series.save()

        # Update posts if provided
        if post_ids is not None:
            # Remove all current posts from series
            Post.objects.filter(series=series).update(series=None)
            # Add new posts
            SeriesService.add_posts_to_series(series, post_ids)

        return series

    @staticmethod
    @transaction.atomic
    def delete_series(series: Series) -> None:
        """
        Delete series.

        Args:
            series: Series instance to delete
        """
        series.delete()

    @staticmethod
    @transaction.atomic
    def update_series_order(user: User, order_data: List[Tuple[int, int]]) -> None:
        """
        Update series order for user.

        Args:
            user: Series owner
            order_data: List of (series_id, new_order) tuples

        Raises:
            SeriesValidationError: If validation fails
        """
        SeriesService.validate_user_permissions(user)

        if not order_data:
            raise SeriesValidationError(
                ErrorCode.INVALID_PARAMETER,
                '순서 정보가 필요합니다.'
            )

        for series_id, new_order in order_data:
            try:
                series = Series.objects.get(id=series_id, owner=user)
                series.order = new_order
                series.save()
            except Series.DoesNotExist:
                # Skip invalid series IDs
                pass

    @staticmethod
    @transaction.atomic
    def add_posts_to_series(series: Series, post_ids: List[int]) -> None:
        """
        Add posts to series.

        Args:
            series: Series instance
            post_ids: List of post IDs to add
        """
        for post_id in post_ids:
            if post_id:  # Skip empty values
                try:
                    post = Post.objects.get(id=post_id, author=series.owner)
                    post.series = series
                    post.save()
                except Post.DoesNotExist:
                    # Skip invalid post IDs
                    pass

    @staticmethod
    def get_user_series_list(user: User, include_post_count: bool = True):
        """
        Get all series for a user.

        Args:
            user: Series owner
            include_post_count: Whether to include post count annotation

        Returns:
            QuerySet of Series
        """
        query = Series.objects.filter(owner=user)

        if include_post_count:
            query = query.annotate(
                total_posts=Count('posts')
            )

        return query.order_by('order', '-id')

    @staticmethod
    def get_posts_available_for_series(user: User):
        """
        Get posts that can be added to a series (not already in one).

        Args:
            user: Post author

        Returns:
            QuerySet of Post
        """
        from django.utils import timezone

        return Post.objects.filter(
            author=user,
            series=None,
            config__hide=False,
            created_date__lte=timezone.now()
        ).order_by('-created_date')

    @staticmethod
    def get_public_series_list(username: str, page: int = 1, offset: int = 10):
        """
        Get public series list for a user.

        Args:
            username: Username
            page: Page number
            offset: Items per page

        Returns:
            QuerySet of Series with annotations
        """
        from django.utils import timezone

        return Series.objects.annotate(
            owner_username=F('owner__username'),
            total_posts=Count(
                Case(
                    When(
                        posts__created_date__lte=timezone.now(),
                        posts__config__hide=False,
                        then=1
                    )
                )
            )
        ).filter(
            owner__username=username,
            total_posts__gte=1,
            hide=False,
        ).order_by('order', '-id')
