"""
Post Service

Business logic for post operations.
Extracted from views to improve testability and reusability.
"""

import random
from typing import Optional, Dict, Any, Tuple, List
from datetime import datetime

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import (
    Q, F, Case, Exists, When, Value, OuterRef, Count
)
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify

from board.models import Post, PostContent, PostConfig, Series, PostLikes
from board.modules.post_description import create_post_description
from board.services.tag_service import TagService
from board.modules.response import ErrorCode
from board.services.webhook_service import WebhookService
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
    def send_post_notifications(post: Post, post_config: PostConfig) -> None:
        """
        Send notifications for new post publication.
        - Sends to site-wide Discord webhook (if configured)
        - Sends to all webhook subscribers of the author

        Args:
            post: Post instance
            post_config: PostConfig instance
        """
        if post_config.hide or not post.is_published():
            return

        # Site-wide Discord notification (optional, via environment variable)
        if settings.DISCORD_NEW_POSTS_WEBHOOK:
            def send_site_webhook():
                post_url = settings.SITE_URL + post.get_absolute_url()
                Discord.send_webhook(
                    url=settings.DISCORD_NEW_POSTS_WEBHOOK,
                    content=f'[새 글이 발행되었어요!]({post_url})'
                )
            SubTaskProcessor.process(send_site_webhook)

        # Author's notification channels
        WebhookService.notify_channels(post, post_config)

    @staticmethod
    @transaction.atomic
    def create_post(
        user: User,
        title: str,
        text_html: str,
        subtitle: str = '',
        description: str = '',
        reserved_date_str: str = '',
        series_url: str = '',
        custom_url: str = '',
        tag: str = '',
        image: Optional[Any] = None,
        is_hide: bool = False,
        is_notice: bool = False,
        is_advertise: bool = False,
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

        Returns:
            Tuple of (Post, PostContent, PostConfig)

        Raises:
            PostValidationError: If validation fails
        """
        PostService.validate_user_permissions(user)

        PostService.validate_post_data(title, text_html)

        post = Post()
        post.title = title
        post.subtitle = subtitle
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
            post.published_date = reserved_date
        else:
            post.published_date = timezone.now()

        series = PostService.get_or_none_series(user, series_url)
        if series:
            post.series = series

        if image:
            post.image = image

        url = PostService.create_post_url(title, custom_url)
        post.create_unique_url(url)
        post.save()

        TagService.set_post_tags(post, tag)

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

        PostService.send_post_notifications(post, post_config)

        return post, post_content, post_config

    @staticmethod
    def get_post_detail(
        username: str,
        url: str,
        user: Optional[User] = None
    ) -> Post:
        """
        Get post detail with all necessary related data.

        Args:
            username: Author username
            url: Post URL
            user: Requesting user (optional)

        Returns:
            Post instance with annotated data
        """
        return get_object_or_404(Post.objects.select_related(
            'config', 'content', 'series', 'author', 'author__profile'
        ).prefetch_related(
            'tags'
        ).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar'),
            count_likes=Count('likes', distinct=True),
            count_comments=Count('comments', distinct=True),
            has_liked=Exists(
                PostLikes.objects.filter(
                    post__id=OuterRef('id'),
                    user__id=user.id if user and user.id else -1
                )
            ),
        ), author__username=username, url=url)

    @staticmethod
    def _calculate_tag_score(candidate_tags: set, current_tag_set: set) -> int:
        """Calculate score based on tag overlap (max 10)."""
        tag_overlap = len(current_tag_set & candidate_tags)
        return min(tag_overlap * 3, 10), tag_overlap

    @staticmethod
    def _calculate_popularity_score(likes_count: int, comments_count: int) -> int:
        """Calculate score based on engagement (max 10)."""
        popularity = (likes_count * 2) + comments_count
        return min(popularity, 10)

    @staticmethod
    def _calculate_recency_score(created_date, now) -> int:
        """Calculate score based on post age."""
        days_old = (now - created_date).days
        if days_old < 7:
            return 5
        elif days_old < 30:
            return 3
        elif days_old < 90:
            return 1
        return 0

    @staticmethod
    def get_related_posts(post: Post) -> List[Post]:
        """
        Get related posts based on tags and popularity.

        Args:
            post: Reference post

        Returns:
            List of related posts
        """
        if not post.tags.exists():
            return []

        current_tags = list(post.tags.values_list('value', flat=True))
        current_tag_set = set(current_tags)

        candidates = Post.objects.select_related(
            'author', 'author__profile', 'config'
        ).prefetch_related('tags').filter(
            tags__value__in=current_tags,
            config__hide=False,
            published_date__isnull=False,
            published_date__lte=timezone.now(),
        ).exclude(
            id=post.id
        ).annotate(
            author_username=F('author__username'),
            author_name=F('author__first_name'),
            author_image=F('author__profile__avatar'),
            likes_count=Count('likes', distinct=True),
            comments_count=Count('comments', distinct=True),
        ).distinct()

        scored_posts = []
        now = timezone.now()

        for candidate in candidates:
            candidate_tags = set(tag.value for tag in candidate.tags.all())
            tag_score, tag_overlap = PostService._calculate_tag_score(
                candidate_tags, current_tag_set
            )
            popularity_score = PostService._calculate_popularity_score(
                candidate.likes_count, candidate.comments_count
            )
            recency_score = PostService._calculate_recency_score(
                candidate.created_date, now
            )

            score = tag_score + popularity_score + recency_score
            if candidate.author.id == post.author.id:
                score -= 5
            score += random.uniform(-3, 3)

            scored_posts.append({
                'post': candidate,
                'score': score,
                'tag_overlap': tag_overlap,
            })

        scored_posts.sort(key=lambda x: (x['score'], x['tag_overlap']), reverse=True)

        return [x['post'] for x in scored_posts[:8]]

    @staticmethod
    @transaction.atomic
    def update_post(
        post: Post,
        title: Optional[str] = None,
        subtitle: Optional[str] = None,
        text_html: Optional[str] = None,
        description: Optional[str] = None,
        series_url: Optional[str] = None,
        custom_url: Optional[str] = None,
        tag: Optional[str] = None,
        image: Optional[Any] = None,
        image_delete: bool = False,
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

        if subtitle is not None:
            post.subtitle = subtitle

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
            TagService.set_post_tags(post, tag)

        if image_delete:
            if post.image:
                post.image.delete(save=False)
                post.image = None
        elif image is not None:
            if post.image:
                post.image.delete(save=False)
            post.image = image

        if post.is_published():
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

    MAX_DRAFTS_PER_USER = 100

    @staticmethod
    @transaction.atomic
    def create_draft(
        user: User,
        title: str = '',
        text_html: str = '',
        subtitle: str = '',
        description: str = '',
        series_url: str = '',
        tag: str = '',
    ) -> Post:
        """
        Create a draft post (published_date=null).
        Relaxed validation: empty content is allowed.

        Returns:
            Post instance (draft)

        Raises:
            PostValidationError: If validation fails
        """
        PostService.validate_user_permissions(user)

        draft_count = Post.objects.filter(
            author=user,
            published_date__isnull=True,
        ).count()
        if draft_count >= PostService.MAX_DRAFTS_PER_USER:
            raise PostValidationError(
                ErrorCode.SIZE_OVERFLOW,
                f'임시 저장 글은 최대 {PostService.MAX_DRAFTS_PER_USER}개까지 가능합니다.'
            )

        post = Post()
        post.title = title or '제목 없음'
        post.subtitle = subtitle
        post.author = user
        post.published_date = None

        if description:
            post.meta_description = description
        elif text_html:
            post.meta_description = create_post_description(
                post_content_html=text_html
            )

        series = PostService.get_or_none_series(user, series_url)
        if series:
            post.series = series

        url = PostService.create_post_url(post.title)
        post.create_unique_url(url)
        post.save()

        if tag:
            TagService.set_post_tags(post, tag)

        PostContent.objects.create(
            post=post,
            text_md=text_html,
            text_html=text_html
        )

        PostConfig.objects.create(post=post)

        return post

    @staticmethod
    @transaction.atomic
    def update_draft(
        post: Post,
        title: Optional[str] = None,
        text_html: Optional[str] = None,
        subtitle: Optional[str] = None,
        description: Optional[str] = None,
        series_url: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> Post:
        """
        Update a draft post. No notifications sent.

        Returns:
            Updated Post instance
        """
        if title is not None:
            post.title = title or '제목 없음'

        if subtitle is not None:
            post.subtitle = subtitle

        if text_html is not None:
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
        elif text_html is not None and text_html:
            post.meta_description = create_post_description(
                post_content_html=text_html
            )

        if series_url is not None:
            series = PostService.get_or_none_series(post.author, series_url)
            post.series = series

        if tag is not None:
            TagService.set_post_tags(post, tag)

        post.updated_date = timezone.now()
        post.save()

        return post

    @staticmethod
    @transaction.atomic
    def publish_draft(
        post: Post,
        title: Optional[str] = None,
        text_html: Optional[str] = None,
        subtitle: Optional[str] = None,
        description: Optional[str] = None,
        series_url: Optional[str] = None,
        custom_url: Optional[str] = None,
        tag: Optional[str] = None,
        image: Optional[Any] = None,
        is_hide: bool = False,
        is_notice: bool = False,
        is_advertise: bool = False,
        reserved_date_str: str = '',
    ) -> Post:
        """
        Publish a draft by setting published_date and sending notifications.

        Returns:
            Published Post instance

        Raises:
            PostValidationError: If validation fails
        """
        if title is not None:
            post.title = title
        if subtitle is not None:
            post.subtitle = subtitle

        PostService.validate_post_data(post.title, text_html or (post.content.text_html if hasattr(post, 'content') else ''))

        if text_html is not None:
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
            TagService.set_post_tags(post, tag)

        if image is not None:
            if post.image:
                post.image.delete(save=False)
            post.image = image

        reserved_date = PostService.validate_reserved_date(reserved_date_str)
        if reserved_date:
            post.published_date = reserved_date
        else:
            post.published_date = timezone.now()

        post.updated_date = timezone.now()
        post.save()

        post_config = post.config
        post_config.hide = is_hide
        post_config.notice = is_notice
        post_config.advertise = is_advertise
        post_config.save()

        PostService.send_post_notifications(post, post_config)

        return post

    @staticmethod
    def get_user_drafts(user: User):
        """Get all draft posts for a user."""
        return Post.objects.select_related(
            'config',
        ).prefetch_related(
            'tags',
        ).filter(
            author=user,
            published_date__isnull=True,
        ).order_by('-updated_date')

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
