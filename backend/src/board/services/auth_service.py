"""
Auth Service

Business logic for authentication and user management.
Extracted from views to improve testability and reusability.
"""

import re
import io
import pyotp
import qrcode
import base64
from typing import Optional, Tuple, Dict, Any

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
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


class OAuthService:
    """Service class for handling OAuth authentication"""

    OAUTH_2FA_CACHE_TIMEOUT = 300  # 5 minutes

    @staticmethod
    def create_2fa_token(user_id: int, next_url: str = '') -> str:
        """
        Create one-time OAuth 2FA token and store in cache.

        Args:
            user_id: User ID requiring 2FA
            next_url: Redirect URL after successful authentication

        Returns:
            OAuth token string
        """
        oauth_token = randstr(32)
        cache_key = f'oauth_2fa:{oauth_token}'

        cache.set(cache_key, {
            'user_id': user_id,
            'next_url': next_url,
        }, OAuthService.OAUTH_2FA_CACHE_TIMEOUT)

        return oauth_token

    @staticmethod
    def get_2fa_data(oauth_token: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve OAuth 2FA token data from cache.

        Args:
            oauth_token: Token to retrieve

        Returns:
            Dictionary with user_id and next_url, or None if expired/invalid
        """
        cache_key = f'oauth_2fa:{oauth_token}'
        return cache.get(cache_key)

    @staticmethod
    def delete_2fa_token(oauth_token: str) -> None:
        """
        Delete used OAuth 2FA token from cache.

        Args:
            oauth_token: Token to delete
        """
        cache_key = f'oauth_2fa:{oauth_token}'
        cache.delete(cache_key)


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
        if User.objects.filter(username=username).exists():
            raise AuthValidationError(
                ErrorCode.VALIDATE,
                '이미 사용중인 사용자 이름 입니다.'
            )

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
        password: Optional[str] = None,
        avatar_url: Optional[str] = None,
        token: Optional[str] = None
    ) -> Tuple[User, Profile, Config]:
        """
        Create new user with profile and config.

        Args:
            username: Username (will be made unique if needed)
            name: User's display name
            email: User's email
            password: Password for the user (optional, for regular signup)
            avatar_url: URL to download avatar from (optional)
            token: Token to store in last_name field (optional)

        Returns:
            Tuple of (User, Profile, Config)
        """
        unique_username = AuthService.generate_unique_username(username)

        user = User.objects.create_user(
            username=unique_username,
            email=email,
            password=password,
            first_name=name,
        )

        if token:
            user.last_name = token
            user.save()

        user_profile = Profile.objects.create(user=user)

        if avatar_url:
            try:
                avatar = download_image(avatar_url, stream=True)
                if avatar:
                    user_profile.avatar.save(name='png', content=File(avatar))
                    user_profile.save()
            except Exception:
                # Don't fail user creation if avatar download fails
                pass

        user_config = Config.objects.create(user=user)
        user_config.create_or_update_meta(CONFIG_TYPE.NOTIFY_MENTION, 'true')
        user_config.create_or_update_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE, 'true')

        AuthService.send_welcome_notification(user)

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
        # if settings.DEBUG:
        #     return False

        return user.config.has_two_factor_auth()

    @staticmethod
    def create_totp_secret() -> str:
        """
        Generate a new TOTP secret.

        Returns:
            Base32 encoded secret string
        """
        return pyotp.random_base32()

    @staticmethod
    def verify_totp_token(user: User, token: str) -> bool:
        """
        Verify TOTP token or recovery key.

        Args:
            user: User instance
            token: TOTP token (6 digits) or recovery key (45 chars)

        Returns:
            True if token is valid, False otherwise
        """
        try:
            two_factor_auth = TwoFactorAuth.objects.get(user=user)

            # Check if it's a recovery key (longer than 6 chars)
            if len(token) > 6:
                return two_factor_auth.recovery_key == token

            # Otherwise verify TOTP
            return two_factor_auth.verify_totp(token)
        except TwoFactorAuth.DoesNotExist:
            return False

    @staticmethod
    def get_totp_qr_code(user: User) -> Optional[str]:
        """
        Get QR code data URL for TOTP setup.

        Args:
            user: User instance

        Returns:
            Base64 encoded QR code image data URL, or None if 2FA not set up
        """
        try:
            two_factor_auth = TwoFactorAuth.objects.get(user=user)
            provisioning_uri = two_factor_auth.get_provisioning_uri()

            if not provisioning_uri:
                return None

            # Generate QR code
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(provisioning_uri)
            qr.make(fit=True)

            img = qr.make_image(fill_color="black", back_color="white")

            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()

            return f"data:image/png;base64,{img_str}"
        except TwoFactorAuth.DoesNotExist:
            return None

    @staticmethod
    @transaction.atomic
    def change_username(user: User, new_username: str, create_log: bool = True) -> None:
        """
        Change user's username.

        Args:
            user: User instance
            new_username: New username
            create_log: Whether to create username change log (default True)

        Raises:
            AuthValidationError: If validation fails
        """
        # Validate new username
        AuthService.validate_username(new_username)

        # Store old username in log if requested
        if create_log:
            UsernameChangeLog.objects.create(
                user=user,
                username=user.username
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
    def send_welcome_notification(user: User) -> None:
        """
        Send welcome notification to user based on site settings.

        Args:
            user: User instance to send notification to
        """
        try:
            site_setting = SiteSetting.get_instance()
            if site_setting.welcome_notification_message:
                content = site_setting.welcome_notification_message.replace('{name}', user.first_name)
                url = site_setting.welcome_notification_url or '/'
                create_notify(user=user, url=url, content=content)
        except Exception:
            # If anything goes wrong, don't fail the operation
            pass

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
