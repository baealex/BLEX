from __future__ import annotations

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from django.utils.crypto import constant_time_compare

from board.constants.config_meta import CONFIG_TYPE
from board.models import Config, Profile, SiteSetting
from board.services.auth_service import AuthService


class InitialSetupBlockedError(Exception):
    pass


class InitialSetupService:
    @staticmethod
    def has_admin_account() -> bool:
        return User.objects.filter(Q(is_staff=True) | Q(is_superuser=True)).exists()

    @staticmethod
    def should_prompt_for_initial_setup() -> bool:
        return not InitialSetupService.has_admin_account()

    @staticmethod
    def requires_setup_token() -> bool:
        return bool(settings.INITIAL_SETUP_TOKEN) or not settings.DEBUG

    @staticmethod
    def is_valid_setup_token(token: str) -> bool:
        if not InitialSetupService.requires_setup_token():
            return True

        configured_token = settings.INITIAL_SETUP_TOKEN
        return bool(
            configured_token
            and token
            and constant_time_compare(token, configured_token)
        )

    @staticmethod
    @transaction.atomic
    def create_initial_admin(
        username: str,
        display_name: str,
        email: str,
        password: str,
    ) -> User:
        SiteSetting.objects.select_for_update().get_or_create(pk=1)

        if InitialSetupService.has_admin_account():
            raise InitialSetupBlockedError('Initial setup is already complete.')

        user = User.objects.create_user(
            username=username.lower(),
            email=email,
            password=password,
            first_name=display_name,
            is_staff=True,
            is_superuser=True,
        )

        Profile.objects.create(user=user, role=Profile.Role.EDITOR)
        config = Config.objects.create(user=user)
        config.create_or_update_meta(CONFIG_TYPE.NOTIFY_MENTION, 'true')
        config.create_or_update_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE, 'true')
        AuthService.send_welcome_notification(user)

        return user
