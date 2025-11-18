"""
Auth Service

Business logic for authentication and user management.
Extracted from views to improve testability and reusability.
"""

import re
from typing import Optional, Tuple, Dict, Any

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files import File
from django.db import transaction
from django.db.models import Count, Case, When, Value, Exists, OuterRef, Q

from board.constants.config_meta import CONFIG_TYPE
from board.models import (
    Config, Profile, TelegramSync,
    TwoFactorAuth, UsernameChangeLog, SiteSetting
)
from board.modules.notify import create_notify
from board.modules.response import ErrorCode
from modules.randomness import randnum, randstr
from modules.scrap import download_image
from modules.sub_task import SubTaskProcessor
from modules.telegram import TelegramBot


class AuthValidationError(Exception):
    """Custom exception for authentication validation errors"""
    def __init__(self, code: ErrorCode, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class AuthService:
    """Service class for handling authentication-related business logic"""

    # Regex patterns
    USERNAME_PATTERN = re.compile(r'[a-z0-9]{4,15}')
    EMAIL_PATTERN = re.compile(r'[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,64}')

    @staticmethod
    def validate_username(username: str) -> None:
        """
        Validate username format and availability.

        Args:
            username: Username to validate

        Raises:
            AuthValidationError: If validation fails
        """
        # Check if username already exists
        if User.objects.filter(username=username).exists():
            raise AuthValidationError(
                ErrorCode.VALIDATE,
                '이미 사용중인 사용자 이름 입니다.'
            )

        # Check format
        match = AuthService.USERNAME_PATTERN.match(username)
        if not match or len(match.group()) != len(username):
            raise AuthValidationError(
                ErrorCode.VALIDATE,
                '사용자 이름은 4~15자 사이의 소문자 영어, 숫자만 가능합니다.'
            )

    @staticmethod
    def validate_email(email: str) -> None:
        """
        Validate email format.

        Args:
            email: Email to validate

        Raises:
            AuthValidationError: If validation fails
        """
        match = AuthService.EMAIL_PATTERN.match(email)
        if not match or len(match.group()) != len(email):
            raise AuthValidationError(
                ErrorCode.VALIDATE,
                '올바른 이메일 주소가 아닙니다.'
            )

    @staticmethod
    def generate_unique_username(base_username: str) -> str:
        """
        Generate unique username by appending counter if needed.

        Args:
            base_username: Base username to start from

        Returns:
            Unique username
        """
        counter = 0
        username = base_username.lower()

        while User.objects.filter(username=username).exists():
            counter += 1
            username = f'{base_username}{counter}'

        return username

    @staticmethod
    @transaction.atomic
    def create_user(
        username: str,
        name: str,
        email: str,
        avatar_url: Optional[str] = None,
        token: Optional[str] = None
    ) -> Tuple[User, Profile, Config]:
        """
        Create new user with profile and config.

        Args:
            username: Username (will be made unique if needed)
            name: User's display name
            email: User's email
            avatar_url: URL to download avatar from (optional)
            token: Token to store in last_name field (optional)

        Returns:
            Tuple of (User, Profile, Config)
        """
        # Generate unique username
        unique_username = AuthService.generate_unique_username(username)

        # Create user
        user = User.objects.create_user(
            username=unique_username,
            email=email,
            first_name=name,
        )

        if token:
            user.last_name = token
            user.save()

        # Create profile
        user_profile = Profile.objects.create(user=user)

        # Download and set avatar
        if avatar_url:
            try:
                avatar = download_image(avatar_url, stream=True)
                if avatar:
                    user_profile.avatar.save(name='png', content=File(avatar))
                    user_profile.save()
            except Exception:
                # Don't fail user creation if avatar download fails
                pass

        # Create config
        user_config = Config.objects.create(user=user)
        user_config.create_or_update_meta(CONFIG_TYPE.NOTIFY_MENTION, 'true')
        user_config.create_or_update_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE, 'true')

        # Create welcome notification
        # Get welcome message from site settings (if available)
        try:
            site_setting = SiteSetting.get_instance()
            if site_setting.welcome_notification_message:
                content = site_setting.welcome_notification_message.replace('{name}', user.first_name)
                url = site_setting.welcome_notification_url or '/'
            else:
                # Fallback to default message
                content = (
                    f'{user.first_name}님의 가입을 진심으로 환영합니다! '
                    f'블렉스의 다양한 기능을 활용하고 싶으시다면 개발자가 직접 작성한 '
                    f'\'블렉스 노션\'을 살펴보시는 것을 추천드립니다 :)'
                )
                url = 'https://www.notion.so/edfab7c5d5be4acd8d10f347c017fcca'

            create_notify(user=user, url=url, content=content)
        except Exception:
            # If anything goes wrong, don't fail user creation
            pass

        return user, user_profile, user_config

    @staticmethod
    def get_user_login_data(user: User) -> Dict[str, Any]:
        """
        Get user data for login response.

        Args:
            user: User instance

        Returns:
            Dictionary with user data
        """
        user_with_annotations = User.objects.select_related(
            'profile', 'config'
        ).annotate(
            notify_count=Count(
                Case(
                    When(notify__has_read=False, then=Value(1))
                )
            ),
            has_connected_telegram=Exists(
                TelegramSync.objects.filter(
                    user_id=OuterRef('id'),
                    tid__regex=r'^.+'
                )
            ),
            has_connected_2fa=Exists(
                TwoFactorAuth.objects.filter(
                    user_id=OuterRef('id')
                )
            ),
            has_editor_role=Case(
                When(
                    Q(profile__role='EDITOR') | Q(profile__role='ADMIN'),
                    then=Value(True)
                ),
                default=Value(False)
            ),
        ).get(id=user.id)

        return {
            'username': user_with_annotations.username,
            'name': user_with_annotations.first_name,
            'email': user_with_annotations.email,
            'avatar': (
                user_with_annotations.profile.avatar.url
                if user_with_annotations.profile.avatar
                else ''
            ),
            'notify_count': user_with_annotations.notify_count,
            'has_connected_telegram': user_with_annotations.has_connected_telegram,
            'has_connected_2fa': user_with_annotations.has_connected_2fa,
            'has_editor_role': user_with_annotations.has_editor_role,
        }

    @staticmethod
    def check_two_factor_auth(user: User) -> bool:
        """
        Check if user has 2FA enabled.

        Args:
            user: User instance

        Returns:
            True if 2FA is enabled and should be checked
        """
        if settings.DEBUG:
            return False

        return user.config.has_two_factor_auth()

    @staticmethod
    def send_2fa_token(user: User) -> None:
        """
        Generate and send 2FA token via Telegram.

        Args:
            user: User instance
        """
        def create_and_send_token():
            token = randnum(6)
            user.twofactorauth.create_token(token)
            bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
            bot.send_message(
                user.telegramsync.get_decrypted_tid(),
                f'2차 인증 코드입니다 : {token}'
            )

        SubTaskProcessor.process(create_and_send_token)

    @staticmethod
    def verify_2fa_token(user: User, token: str) -> bool:
        """
        Verify 2FA token.

        Args:
            user: User instance
            token: Token to verify

        Returns:
            True if token is valid, False otherwise
        """
        try:
            two_factor_auth = TwoFactorAuth.objects.get(user=user)
            return two_factor_auth.verify_token(token)
        except TwoFactorAuth.DoesNotExist:
            return False

    @staticmethod
    @transaction.atomic
    def change_username(user: User, new_username: str) -> None:
        """
        Change user's username.

        Args:
            user: User instance
            new_username: New username

        Raises:
            AuthValidationError: If validation fails
        """
        # Validate new username
        AuthService.validate_username(new_username)

        # Store old username in log
        UsernameChangeLog.objects.create(
            user=user,
            old_username=user.username,
            new_username=new_username
        )

        # Update username
        user.username = new_username
        user.save()

    @staticmethod
    def change_password(user: User, old_password: str, new_password: str) -> None:
        """
        Change user's password.

        Args:
            user: User instance
            old_password: Current password
            new_password: New password

        Raises:
            AuthValidationError: If old password is incorrect
        """
        if not user.check_password(old_password):
            raise AuthValidationError(
                ErrorCode.VALIDATE,
                '현재 비밀번호가 올바르지 않습니다.'
            )

        user.set_password(new_password)
        user.save()

    @staticmethod
    def update_user_profile(
        profile: Profile,
        bio: Optional[str] = None,
        avatar: Optional[Any] = None,
        cover: Optional[Any] = None,
    ) -> Profile:
        """
        Update user profile.

        Args:
            profile: Profile instance
            bio: New bio (optional)
            avatar: New avatar image (optional)
            cover: New cover image (optional)

        Returns:
            Updated Profile instance
        """
        if bio is not None:
            profile.bio = bio

        if avatar is not None:
            profile.avatar = avatar

        if cover is not None:
            profile.cover = cover

        profile.save()
        return profile

    @staticmethod
    @transaction.atomic
    def delete_user_account(user: User) -> None:
        """
        Delete user account and all related data.

        Args:
            user: User instance to delete
        """
        # Delete related data through CASCADE
        # Profile, Config, Posts, Comments, etc. will be deleted automatically
        user.delete()
