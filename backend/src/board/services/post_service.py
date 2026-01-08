"""
Post Service

Business logic for post operations.
Extracted from views to improve testability and reusability.
"""

from typing import Optional, Dict, Any, Tuple, List
from datetime import datetime

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify

from board.models import Post, PostContent, PostConfig, Series, TempPosts
from board.modules.post_description import create_post_description
from board.modules.response import ErrorCode
from modules.discord import Discord
from modules.sub_task import SubTaskProcessor


class PostValidationError(Exception):
    """Custom exception for post validation errors"""
    def __init__(self, code: ErrorCode, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class PostService:
    """Service class for handling post-related business logic"""

    @staticmethod
    def validate_user_permissions(user: User) -> None:
        """
        Validate if user has permission to create posts.

        Args:
            user: User instance to validate

        Raises:
            PostValidationError: If user doesn't have permission
        """
        if not user.is_active:
            raise PostValidationError(
                ErrorCode.VALIDATE,
                '활성화되지 않은 사용자입니다.'
            )

        if not user.profile.is_editor():
            raise PostValidationError(
                ErrorCode.VALIDATE,
                '작성 권한이 없습니다.'
            )

    @staticmethod
    def validate_post_data(title: str, text_html: str) -> None:
        """
        Validate post data.

        Args:
            title: Post title
            text_html: Post content in HTML

        Raises:
            PostValidationError: If validation fails
        """
        if not title:
            raise PostValidationError(
                ErrorCode.VALIDATE,
                '제목을 입력해주세요.'
            )
        if not text_html:
            raise PostValidationError(
                ErrorCode.VALIDATE,
                '내용을 입력해주세요.'
            )

    @staticmethod
    def validate_reserved_date(reserved_date_str: str) -> Optional[datetime]:
        """
        Validate and parse reserved date.

        Args:
            reserved_date_str: Reserved date string

        Returns:
            Parsed datetime object or None

        Raises:
            PostValidationError: If date is in the past
        """
        if not reserved_date_str:
            return None

        reserved_date = parse_datetime(reserved_date_str)
        if reserved_date and reserved_date < timezone.now():
            raise PostValidationError(
                ErrorCode.VALIDATE,
                '예약시간이 현재시간보다 이전입니다.'
            )
        return reserved_date

    @staticmethod
    def get_or_none_series(user: User, series_url: str) -> Optional[Series]:
        """
        Get series by URL for given user.

        Args:
            user: Post author
            series_url: Series URL

        Returns:
            Series instance or None
        """
        if not series_url:
            return None

        return Series.objects.filter(
            owner=user,
            url=series_url
        ).first()

    @staticmethod
    def create_post_url(title: str, custom_url: str = '') -> str:
        """
        Create URL slug for post.

        Args:
            title: Post title
            custom_url: Custom URL if provided

        Returns:
            Slugified URL
        """
        if custom_url:
            return slugify(custom_url, allow_unicode=True)
        return slugify(title, allow_unicode=True)

    @staticmethod
    def send_discord_notification(post: Post, post_config: PostConfig) -> None:
        """
        Send Discord webhook notification for new post.

        Args:
            post: Post instance
            post_config: PostConfig instance
        """
        if (not post_config.hide and
            post.is_published() and
            settings.DISCORD_NEW_POSTS_WEBHOOK):

            def send_webhook():
                post_url = settings.SITE_URL + post.get_absolute_url()
                Discord.send_webhook(
                    url=settings.DISCORD_NEW_POSTS_WEBHOOK,
                    content=f'[새 글이 발행되었어요!]({post_url})'
                )

            SubTaskProcessor.process(send_webhook)

    @staticmethod
    def delete_temp_post(user: User, token: str) -> None:
        """
        Delete temporary post if exists.

        Args:
            user: Post author
            token: Temp post token
        """
        if not token:
            return

        try:
            TempPosts.objects.get(token=token, author=user).delete()
        except TempPosts.DoesNotExist:
            pass

    @staticmethod
    @transaction.atomic
    def create_post(
        user: User,
        title: str,
        text_html: str,
        description: str = '',
        reserved_date_str: str = '',
        series_url: str = '',
        custom_url: str = '',
        tag: str = '',
        image: Optional[Any] = None,
        is_hide: bool = False,
        is_notice: bool = False,
        is_advertise: bool = False,
        temp_post_token: str = ''
    ) -> Tuple[Post, PostContent, PostConfig]:
        """
        Create a new post with all related objects.

        Args:
            user: Post author
            title: Post title
            text_html: Post content in HTML
            description: Meta description (optional)
            reserved_date_str: Reserved publication date (optional)
            series_url: Series URL (optional)
            custom_url: Custom URL slug (optional)
            tag: Tags string (optional)
            image: Post cover image (optional)
            is_hide: Hide post flag
            is_notice: Notice post flag
            is_advertise: Advertisement flag
            temp_post_token: Token to delete temp post (optional)

        Returns:
            Tuple of (Post, PostContent, PostConfig)

        Raises:
            PostValidationError: If validation fails
        """
        PostService.validate_user_permissions(user)

        PostService.validate_post_data(title, text_html)

        post = Post()
        post.title = title
        post.author = user

        if description:
            post.meta_description = description
        else:
            post.meta_description = create_post_description(
                post_content_html=text_html
            )

        reserved_date = PostService.validate_reserved_date(reserved_date_str)
        if reserved_date:
            post.created_date = reserved_date
            post.updated_date = reserved_date

        series = PostService.get_or_none_series(user, series_url)
        if series:
            post.series = series

        if image:
            post.image = image

        url = PostService.create_post_url(title, custom_url)
        post.create_unique_url(url)
        post.save()

        post.set_tags(tag)

        post_content = PostContent.objects.create(
            post=post,
            text_md=text_html,  # Store HTML in both fields for compatibility
            text_html=text_html
        )

        post_config = PostConfig.objects.create(
            post=post,
            hide=is_hide,
            notice=is_notice,
            advertise=is_advertise
        )

        PostService.send_discord_notification(post, post_config)

        PostService.delete_temp_post(user, temp_post_token)

        return post, post_content, post_config

    @staticmethod
    @transaction.atomic
    def update_post(
        post: Post,
        title: Optional[str] = None,
        text_html: Optional[str] = None,
        description: Optional[str] = None,
        series_url: Optional[str] = None,
        custom_url: Optional[str] = None,
        tag: Optional[str] = None,
        image: Optional[Any] = None,
        is_hide: Optional[bool] = None,
        is_notice: Optional[bool] = None,
        is_advertise: Optional[bool] = None,
    ) -> Post:
        """
        Update existing post.

        Args:
            post: Post instance to update
            title: New title (optional)
            text_html: New content (optional)
            description: New description (optional)
            series_url: New series URL (optional)
            custom_url: New custom URL (optional)
            tag: New tags (optional)
            image: New image (optional)
            is_hide: New hide flag (optional)
            is_notice: New notice flag (optional)
            is_advertise: New advertise flag (optional)

        Returns:
            Updated Post instance
        """
        if title is not None:
            post.title = title

        if text_html is not None:
            PostService.validate_post_data(title or post.title, text_html)

            try:
                post_content = post.content
                post_content.text_html = text_html
                post_content.text_md = text_html
                post_content.save()
            except PostContent.DoesNotExist:
                PostContent.objects.create(
                    post=post,
                    text_html=text_html,
                    text_md=text_html
                )

        if description is not None:
            post.meta_description = description
        elif text_html is not None:
            post.meta_description = create_post_description(
                post_content_html=text_html
            )

        if series_url is not None:
            series = PostService.get_or_none_series(post.author, series_url)
            post.series = series

        if custom_url is not None:
            url = PostService.create_post_url(post.title, custom_url)
            post.create_unique_url(url)

        if tag is not None:
            post.set_tags(tag)

        if image is not None:
            post.image = image

        post.updated_date = timezone.now()
        post.save()

        if is_hide is not None or is_notice is not None or is_advertise is not None:
            post_config = post.config
            if is_hide is not None:
                post_config.hide = is_hide
            if is_notice is not None:
                post_config.notice = is_notice
            if is_advertise is not None:
                post_config.advertise = is_advertise
            post_config.save()

        return post

    @staticmethod
    def can_user_edit_post(user: User, post: Post) -> bool:
        """
        Check if user can edit the post.

        Args:
            user: User instance
            post: Post instance

        Returns:
            True if user can edit, False otherwise
        """
        return user.is_authenticated and (
            user == post.author or user.is_staff
        )

    @staticmethod
    def can_user_delete_post(user: User, post: Post) -> bool:
        """
        Check if user can delete the post.

        Args:
            user: User instance
            post: Post instance

        Returns:
            True if user can delete, False otherwise
        """
        return user.is_authenticated and (
            user == post.author or user.is_staff
        )

    @staticmethod
    @transaction.atomic
    def delete_post(post: Post) -> None:
        """
        Delete post and related objects.

        Args:
            post: Post instance to delete
        """
        post.delete()

    @staticmethod
    def get_visible_series_posts(post: Post) -> List[Post]:
        """
        Get visible series posts for pagination.
        
        Args:
            post: Current post instance
            
        Returns:
            List of visible posts
        """
        if not post.series:
            return []

        series_posts = list(Post.objects.filter(
            series=post.series,
            config__hide=False,
        ).order_by('created_date'))
        
        post.series_total = len(series_posts)

        for i, series_post in enumerate(series_posts):
            series_post.series_index = i + 1
            if series_post.id == post.id:
                post.series_index = i + 1
        
        if not hasattr(post, 'series_index'):
            return []
        
        current_idx = post.series_index - 1
        
        post.prev_post = series_posts[current_idx - 1] if current_idx > 0 else None
        post.next_post = series_posts[current_idx + 1] if current_idx < post.series_total - 1 else None

        if post.series_total <= 5:
            return series_posts
        elif post.series_index <= 3:
            return series_posts[:5]
        elif post.series_index >= post.series_total - 2:
            return series_posts[-5:]
        else:
            start = max(0, current_idx - 2)
            end = min(post.series_total, current_idx + 3)
            return series_posts[start:end]
