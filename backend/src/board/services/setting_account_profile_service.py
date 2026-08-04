"""Mutation services for account and profile sections of user settings."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from django.contrib.auth.models import User
from django.core.files.uploadedfile import UploadedFile
from django.utils.translation import gettext

from board.html_utils import safe_external_url
from board.models import Profile
from board.modules.response import ErrorCode
from board.services.auth_service import AuthService, AuthValidationError
from board.services.user_social_link_service import UserSocialLinkService


class SettingAccountProfileError(Exception):
    """Raised when an account or profile mutation is rejected."""

    def __init__(self, code: ErrorCode, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class AccountUpdateResult:
    should_save: bool
    should_refresh_session: bool


class SettingAccountProfileService:
    """Apply existing account and profile mutation rules without HTTP objects."""

    @staticmethod
    def prepare_account_update(
        user: User,
        *,
        username: str,
        name: str,
        password: str,
    ) -> AccountUpdateResult:
        should_save = False

        if username and user.username != username:
            try:
                AuthService.validate_username_change_restriction(user)
                AuthService.change_username(user, username, create_log=True)
            except AuthValidationError as error:
                raise SettingAccountProfileError(error.code, error.message) from error

        if name and user.first_name != name:
            user.first_name = name
            should_save = True

        if password:
            SettingAccountProfileService.validate_password(password)
            user.set_password(password)
            should_save = True

        return AccountUpdateResult(
            should_save=should_save,
            should_refresh_session=bool(password),
        )

    @staticmethod
    def validate_password(password: str) -> None:
        if len(password) < 8:
            raise SettingAccountProfileError(
                ErrorCode.VALIDATE,
                gettext('Password must be at least 8 characters.'),
            )

        if not any(character.isdigit() for character in password):
            raise SettingAccountProfileError(
                ErrorCode.VALIDATE,
                gettext('Password must include a number.'),
            )

        if not any(character.islower() for character in password):
            raise SettingAccountProfileError(
                ErrorCode.VALIDATE,
                gettext('Password must include a lowercase letter.'),
            )

        if not any(character.isupper() for character in password):
            raise SettingAccountProfileError(
                ErrorCode.VALIDATE,
                gettext('Password must include an uppercase letter.'),
            )

        if not any(
            not character.isupper()
            and not character.islower()
            and not character.isdigit()
            for character in password
        ):
            raise SettingAccountProfileError(
                ErrorCode.VALIDATE,
                gettext('Password must include a special character.'),
            )

    @staticmethod
    def persist_account_update(user: User, result: AccountUpdateResult) -> None:
        if result.should_save:
            user.save()

    @staticmethod
    def update_profile(
        user: User,
        *,
        bio: str,
        homepage: str,
    ) -> None:
        profile = Profile.objects.get(user=user)
        safe_homepage = safe_external_url(homepage or '')
        if homepage and not safe_homepage:
            raise SettingAccountProfileError(
                ErrorCode.VALIDATE,
                '홈페이지는 http 또는 https URL이어야 합니다.',
            )
        profile.bio = bio
        profile.homepage = safe_homepage
        profile.save()

    @staticmethod
    def save_avatar(user: User, avatar: UploadedFile) -> str:
        profile = Profile.objects.get(user=user)
        profile.avatar = avatar
        profile.save()
        return profile.get_thumbnail()

    @staticmethod
    def save_cover(user: User, cover: UploadedFile) -> str | None:
        profile = Profile.objects.get(user=user)
        profile.cover = cover
        profile.save()
        return profile.cover.url if profile.cover else None

    @staticmethod
    def delete_cover(user: User) -> None:
        profile = Profile.objects.get(user=user)
        if profile.cover:
            profile.cover.delete(save=False)
            profile.cover = None
            profile.save(update_fields=['cover'])

    @staticmethod
    def update_social_links(
        user: User,
        data: Mapping[str, Any],
    ) -> list[dict[str, Any]]:
        return UserSocialLinkService.update_user_social_links(user, data)
