"""
User Service

Business logic for user profile and activity operations.
Extracted from views to improve testability and reusability.
Note: Authentication-related operations are in AuthService.
"""

import datetime
from itertools import chain
from typing import Optional, Dict, Any, List

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import F, Count, Case, When
from django.utils import timezone

from board.models import (
    Profile, UsernameChangeLog, Post, PinnedPost,
    Series, Comment, Tag
)
from board.modules.response import ErrorCode
from modules.markdown import parse_to_html


class UserValidationError(Exception):
    """Custom exception for user validation errors"""
    def __init__(self, code: ErrorCode, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class UserService:
    """Service class for handling user profile and activity-related business logic"""

    @staticmethod
    def validate_user_permissions(current_user: User, target_user: User) -> None:
        """
        Validate if current user has permission to modify target user's data.

        Args:
            current_user: User performing the action
            target_user: User whose data is being modified

        Raises:
            UserValidationError: If user doesn't have permission
        """
        if not current_user.is_active:
            raise UserValidationError(
                ErrorCode.NEED_LOGIN,
                '로그인이 필요합니다.'
            )

        if current_user != target_user and not current_user.is_staff:
            raise UserValidationError(
                ErrorCode.AUTHENTICATION,
                '권한이 없습니다.'
            )

    @staticmethod
    def get_user_profile_data(user: User) -> Dict[str, Any]:
        """
        Get user profile data.

        Args:
            user: User instance

        Returns:
            Dictionary with profile data
        """
        user_profile = Profile.objects.get(user=user)
        return {
            'image': user_profile.get_thumbnail(),
            'username': user.username,
            'name': user.first_name,
            'bio': user_profile.bio,
            'homepage': user_profile.homepage,
        }

    @staticmethod
    def get_user_social_data(user: User) -> Dict[str, Any]:
        """
        Get user social links.

        Args:
            user: User instance

        Returns:
            Dictionary with social data
        """
        user_profile = Profile.objects.get(user=user)
        return user_profile.collect_social()

    @staticmethod
    def get_user_tags(user: User) -> List[Dict[str, Any]]:
        """
        Get tags used by user with count.

        Args:
            user: User instance

        Returns:
            List of tag dictionaries
        """
        tags = Tag.objects.filter(
            posts__author=user,
            posts__config__hide=False,
        ).annotate(
            count=Count(
                Case(
                    When(
                        posts__author=user,
                        posts__config__hide=False,
                        then='posts'
                    ),
                )
            )
        ).order_by('-count')

        return list(map(lambda tag: {
            'name': tag.value,
            'count': tag.count,
        }, tags))

    @staticmethod
    def get_user_pinned_or_most_liked_posts(user: User) -> List[Dict[str, Any]]:
        """
        Get user's pinned posts, or most liked posts if no pinned posts.

        Args:
            user: User instance

        Returns:
            List of post dictionaries
        """
        # Try to get pinned posts first
        pinned_posts = PinnedPost.objects.select_related(
            'post'
        ).filter(
            user=user
        ).annotate(
            author_username=F('user__username'),
            author_image=F('user__profile__avatar'),
        ).order_by('order')

        if pinned_posts.exists():
            return list(map(lambda pinned_post: {
                'url': pinned_post.post.url,
                'title': pinned_post.post.title,
                'image': str(pinned_post.post.image),
                'read_time': pinned_post.post.read_time,
                'created_date': pinned_post.post.created_date,
                'author_image': pinned_post.author_image,
                'author': pinned_post.author_username,
            }, pinned_posts))

        # If no pinned posts, get most liked posts
        posts = Post.objects.filter(
            author=user,
            config__hide=False,
            config__notice=False,
            created_date__lte=timezone.now(),
        ).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar'),
            likes_count=Count('likes', distinct=True),
        ).order_by('-likes_count', '-created_date')[:6]

        return list(map(lambda post: {
            'url': post.url,
            'title': post.title,
            'image': str(post.image),
            'read_time': post.read_time,
            'created_date': post.created_date,
            'author_image': post.author_image,
            'author': post.author_username,
        }, posts))

    @staticmethod
    def get_user_recent_activity(user: User, days: int = 7) -> List[Dict[str, Any]]:
        """
        Get user's recent activity (posts, series, comments).

        Args:
            user: User instance
            days: Number of days to look back

        Returns:
            List of activity dictionaries
        """
        cutoff_date = timezone.now() - datetime.timedelta(days=days)

        posts = Post.objects.filter(
            created_date__gte=cutoff_date,
            created_date__lte=timezone.now(),
            author=user,
            config__hide=False
        ).order_by('-created_date')

        series = Series.objects.filter(
            created_date__gte=cutoff_date,
            created_date__lte=timezone.now(),
            owner=user
        ).order_by('-created_date')

        comments = Comment.objects.filter(
            created_date__gte=cutoff_date,
            created_date__lte=timezone.now(),
            author=user,
            post__config__hide=False
        ).order_by('-created_date')

        # Combine and sort all activities
        activity = sorted(
            chain(posts, series, comments),
            key=lambda instance: instance.created_date,
            reverse=True
        )

        result = []
        for active in activity:
            active_dict = {}
            active_type = str(type(active))

            if 'Post' in active_type:
                active_dict = {
                    'type': 'edit',
                    'text': active.title
                }
            elif 'Comment' in active_type:
                active_dict = {
                    'type': 'comment',
                    'text': active.post.title
                }
            elif 'Series' in active_type:
                active_dict = {
                    'type': 'bookmark',
                    'text': active.name
                }

            active_dict['url'] = active.get_absolute_url()
            active_dict['created_date'] = active.created_date
            result.append(active_dict)

        return result

    @staticmethod
    def get_user_about(user: User) -> Dict[str, str]:
        """
        Get user's about page content.

        Args:
            user: User instance

        Returns:
            Dictionary with about_md and about_html
        """
        return {
            'about_md': user.profile.about_md,
            'about_html': user.profile.about_html
        }

    @staticmethod
    @transaction.atomic
    def update_user_about(user: User, about_md: str) -> None:
        """
        Update user's about page.

        Args:
            user: User instance
            about_md: About page content in markdown
        """
        about_html = parse_to_html(about_md)

        if hasattr(user, 'profile'):
            user.profile.about_md = about_md
            user.profile.about_html = about_html
            user.profile.save()
        else:
            profile = Profile(user=user)
            profile.about_md = about_md
            profile.about_html = about_html
            profile.save()

    @staticmethod
    def check_username_redirect(old_username: str) -> Optional[Dict[str, str]]:
        """
        Check if username has been changed and get redirect info.

        Args:
            old_username: Old username to check

        Returns:
            Dictionary with redirect info or None
        """
        log = UsernameChangeLog.objects.filter(
            username=old_username
        ).annotate(
            user_username=F('user__username'),
        ).first()

        if log:
            return {
                'old_username': log.username,
                'new_username': log.user_username,
                'created_date': log.created_date
            }

        return None

    @staticmethod
    def get_user_data_by_includes(user: User, includes: List[str]) -> Dict[str, Any]:
        """
        Get user data based on specified includes.

        Args:
            user: User instance
            includes: List of data types to include

        Returns:
            Dictionary with requested data
        """
        data = {}

        for include in set(includes):
            if include == 'profile':
                data[include] = UserService.get_user_profile_data(user)
            elif include == 'social':
                data[include] = UserService.get_user_social_data(user)
            elif include == 'tags':
                data[include] = UserService.get_user_tags(user)
            elif include == 'most':
                data[include] = UserService.get_user_pinned_or_most_liked_posts(user)
            elif include == 'recent':
                data[include] = UserService.get_user_recent_activity(user)
            elif include == 'about':
                data[include] = UserService.get_user_about(user)['about_html']

        return data
