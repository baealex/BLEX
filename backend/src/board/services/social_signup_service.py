"""Typed orchestration for the social-signup API."""

from __future__ import annotations

import json

from dataclasses import dataclass
from enum import Enum
from typing import ClassVar, Mapping, Protocol, cast

from django.contrib.auth.models import User
from django.db import transaction

from board.models import SocialAuth, SocialAuthProvider, UserLinkMeta
from board.services.auth_service import AuthService
from board.services.initial_setup_service import InitialSetupService
from board.services.social_auth_provider_service import SocialAuthProviderService
from modules import oauth


class SocialSignupErrorKind(Enum):
    INITIAL_SETUP_REQUIRED = 'initial_setup_required'
    UNSUPPORTED_PROVIDER = 'unsupported_provider'
    PROVIDER_DISABLED = 'provider_disabled'
    MISSING_CODE = 'missing_code'
    EXTERNAL_AUTH_FAILED = 'external_auth_failed'


class SocialSignupError(Exception):
    """Raised when social signup cannot continue before persistence."""

    def __init__(self, kind: SocialSignupErrorKind):
        super().__init__(kind.value)
        self.kind = kind


@dataclass(frozen=True)
class SocialSignupIdentity:
    provider_key: str
    uid: str
    username: str
    name: str
    email: str
    avatar_url: str | None
    extra_data: Mapping[str, object]
    link_name: str | None = None
    link_value: str | None = None


@dataclass(frozen=True)
class SocialSignupResult:
    user: User
    is_first_login: bool


class SocialSignupProviderAdapter(Protocol):
    provider_key: ClassVar[str]

    @staticmethod
    def authenticate(code: str) -> oauth.State:
        ...

    @staticmethod
    def map_identity(user_data: Mapping[str, object]) -> SocialSignupIdentity:
        ...


class GitHubSocialSignupAdapter:
    provider_key = 'github'

    @staticmethod
    def authenticate(code: str) -> oauth.State:
        return oauth.auth_github(code)

    @staticmethod
    def map_identity(user_data: Mapping[str, object]) -> SocialSignupIdentity:
        username = cast(str, user_data.get('login'))
        return SocialSignupIdentity(
            provider_key=GitHubSocialSignupAdapter.provider_key,
            uid=cast(str, user_data.get('node_id')),
            username=username,
            name=cast(str, user_data.get('name')),
            email='',
            avatar_url=cast(str | None, user_data.get('avatar_url')),
            extra_data=user_data,
            link_name='github',
            link_value=f'https://github.com/{username}',
        )


class GoogleSocialSignupAdapter:
    provider_key = 'google'

    @staticmethod
    def authenticate(code: str) -> oauth.State:
        return oauth.auth_google(code)

    @staticmethod
    def map_identity(user_data: Mapping[str, object]) -> SocialSignupIdentity:
        email = cast(str, user_data.get('email'))
        return SocialSignupIdentity(
            provider_key=GoogleSocialSignupAdapter.provider_key,
            uid=cast(str, user_data.get('id')),
            username=email.split('@')[0],
            name=cast(str, user_data.get('name')),
            email=email,
            avatar_url=cast(str | None, user_data.get('picture')),
            extra_data=user_data,
        )


class SocialSignupService:
    """Authenticate a provider identity and persist a social account atomically."""

    ADAPTERS: ClassVar[dict[str, type[SocialSignupProviderAdapter]]] = {
        GitHubSocialSignupAdapter.provider_key: GitHubSocialSignupAdapter,
        GoogleSocialSignupAdapter.provider_key: GoogleSocialSignupAdapter,
    }

    @classmethod
    def sign_up(cls, provider_key: str, code: str | None) -> SocialSignupResult:
        if InitialSetupService.should_prompt_for_initial_setup():
            raise SocialSignupError(SocialSignupErrorKind.INITIAL_SETUP_REQUIRED)

        adapter = cls.ADAPTERS.get(provider_key)
        if adapter is None or provider_key not in SocialAuthProviderService.supported_keys():
            raise SocialSignupError(SocialSignupErrorKind.UNSUPPORTED_PROVIDER)

        provider = SocialAuthProviderService.get_enabled_provider(provider_key)
        if provider is None:
            raise SocialSignupError(SocialSignupErrorKind.PROVIDER_DISABLED)

        if not code:
            raise SocialSignupError(SocialSignupErrorKind.MISSING_CODE)

        state = adapter.authenticate(code)
        if not state.success:
            raise SocialSignupError(SocialSignupErrorKind.EXTERNAL_AUTH_FAILED)

        identity = adapter.map_identity(cast(Mapping[str, object], state.user))
        social_auth = SocialAuth.objects.filter(
            provider=provider,
            uid=identity.uid,
        ).select_related('user').first()
        if social_auth:
            return SocialSignupResult(
                user=social_auth.user,
                is_first_login=False,
            )

        user = cls._create_social_user(provider, identity)
        return SocialSignupResult(user=user, is_first_login=True)

    @staticmethod
    @transaction.atomic
    def _create_social_user(
        provider: SocialAuthProvider,
        identity: SocialSignupIdentity,
    ) -> User:
        user, _profile, _config = AuthService.create_user(
            username=identity.username,
            name=identity.name,
            email=identity.email,
            avatar_url=identity.avatar_url,
        )
        SocialAuth.objects.create(
            user=user,
            provider=provider,
            uid=identity.uid,
            extra_data=json.dumps(identity.extra_data, ensure_ascii=False),
        )

        if identity.link_name and identity.link_value:
            UserLinkMeta.objects.create(
                user=user,
                name=identity.link_name,
                value=identity.link_value,
            )

        return user
