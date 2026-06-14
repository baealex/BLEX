from __future__ import annotations

from django.db import transaction

from board.constants.social_auth import SUPPORTED_SOCIAL_AUTH_PROVIDERS
from board.models import SocialAuthProvider
from board.services.social_auth_provider_secret_service import SocialAuthProviderSecretService


class SocialAuthProviderService:
    SUPPORTED_PROVIDERS = SUPPORTED_SOCIAL_AUTH_PROVIDERS

    @classmethod
    def ensure_supported_providers(cls) -> None:
        for key in cls.SUPPORTED_PROVIDERS:
            SocialAuthProvider.objects.get_or_create(
                key=key,
                defaults={
                    'is_enabled': False,
                },
            )

    @classmethod
    def supported_keys(cls) -> list[str]:
        return list(cls.SUPPORTED_PROVIDERS.keys())

    @classmethod
    def is_enabled(cls, key: str) -> bool:
        provider = cls.get_provider(key)
        return bool(provider and provider.is_enabled)

    @classmethod
    def get_client_id(cls, key: str) -> str:
        provider = cls.get_provider(key)
        if not provider or not provider.is_enabled:
            return ''
        return provider.client_id

    @classmethod
    def get_client_secret(cls, key: str) -> str:
        provider = cls.get_provider(key)
        if not provider or not provider.is_enabled:
            return ''
        return SocialAuthProviderSecretService.decrypt_secret(provider.client_secret)

    @classmethod
    def get_provider(cls, key: str) -> SocialAuthProvider | None:
        if key not in cls.SUPPORTED_PROVIDERS:
            return None
        cls.ensure_supported_providers()
        return SocialAuthProvider.objects.filter(key=key).first()

    @classmethod
    def serialize_public_providers(cls) -> list[dict[str, str]]:
        cls.ensure_supported_providers()
        providers = []
        for provider in SocialAuthProvider.objects.filter(
            key__in=cls.supported_keys(),
            is_enabled=True,
        ).order_by('id'):
            client_id = cls.get_client_id(provider.key)
            if not client_id or not cls.get_client_secret(provider.key):
                continue
            providers.append({
                'key': provider.key,
                'name': cls.SUPPORTED_PROVIDERS[provider.key]['name'],
                'client_id': client_id,
            })
        return providers

    @classmethod
    def serialize_admin_providers(cls) -> list[dict[str, object]]:
        cls.ensure_supported_providers()
        providers = []
        for provider in SocialAuthProvider.objects.filter(key__in=cls.supported_keys()).order_by('id'):
            providers.append({
                'key': provider.key,
                'name': cls.SUPPORTED_PROVIDERS[provider.key]['name'],
                'is_enabled': provider.is_enabled,
                'client_id': provider.client_id,
                'has_client_secret': bool(provider.client_secret),
            })
        return providers

    @classmethod
    @transaction.atomic
    def update_admin_providers(cls, payload: object) -> None:
        if not isinstance(payload, list):
            return

        cls.ensure_supported_providers()
        provider_map = {
            provider.key: provider
            for provider in SocialAuthProvider.objects.filter(key__in=cls.supported_keys())
        }
        for item in payload:
            if not isinstance(item, dict):
                continue
            key = item.get('key')
            provider = provider_map.get(key)
            if provider is None:
                continue

            if 'is_enabled' in item:
                provider.is_enabled = item.get('is_enabled') is True
            if isinstance(item.get('client_id'), str):
                provider.client_id = item['client_id'].strip()
            if isinstance(item.get('client_secret'), str) and item['client_secret']:
                provider.client_secret = SocialAuthProviderSecretService.encrypt_secret(item['client_secret'])
            if item.get('clear_client_secret') is True:
                provider.client_secret = ''
            provider.save(update_fields=['is_enabled', 'client_id', 'client_secret'])
