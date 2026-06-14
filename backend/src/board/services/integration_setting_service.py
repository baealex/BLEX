from __future__ import annotations

from typing import TYPE_CHECKING

from cryptography.fernet import InvalidToken
from django.apps import apps

from modules.cipher import decrypt_value, encrypt_value

if TYPE_CHECKING:
    from board.models import IntegrationSetting


class IntegrationSettingConfigurationError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class IntegrationSettingService:
    @staticmethod
    def get_setting_model():
        return apps.get_model('board', 'IntegrationSetting')

    @staticmethod
    def is_encrypted(value: str) -> bool:
        if not value:
            return False
        try:
            decrypt_value(value)
            return True
        except Exception:
            return False

    @classmethod
    def encrypt_secret(cls, value: str) -> str:
        value = (value or '').strip()
        if not value:
            return ''
        if cls.is_encrypted(value):
            return value
        return encrypt_value(value).decode()

    @staticmethod
    def decrypt_secret(value: str) -> str:
        value = value or ''
        if not value:
            return ''
        try:
            return decrypt_value(value)
        except (InvalidToken, Exception):
            return ''

    @staticmethod
    def normalize_bot_username(value: object) -> str:
        if not isinstance(value, str):
            return ''
        return value.strip().lstrip('@')

    @classmethod
    def get_telegram_bot_token(cls, setting: IntegrationSetting | None = None) -> str:
        setting = setting or cls.get_setting_model().get_instance()
        if not setting.telegram_enabled:
            return ''
        return cls.decrypt_secret(setting.telegram_bot_token)

    @classmethod
    def is_telegram_configured(cls, setting: IntegrationSetting | None = None) -> bool:
        setting = setting or cls.get_setting_model().get_instance()
        return bool(
            setting.telegram_enabled
            and setting.telegram_bot_username.strip()
            and cls.decrypt_secret(setting.telegram_bot_token)
        )

    @staticmethod
    def has_user_telegram_connection(user) -> bool:
        if not hasattr(user, 'telegramsync'):
            return False
        return bool(user.telegramsync.tid)

    @classmethod
    def serialize_admin_config(cls, setting: IntegrationSetting) -> dict[str, object]:
        return {
            'telegram_enabled': setting.telegram_enabled,
            'telegram_bot_username': setting.telegram_bot_username.strip(),
            'telegram_has_bot_token': bool(cls.decrypt_secret(setting.telegram_bot_token)),
            'updated_date': setting.updated_date.isoformat(),
        }

    @classmethod
    def serialize_user_telegram_status(cls, user) -> dict[str, object]:
        setting = cls.get_setting_model().get_instance()
        is_configured = cls.is_telegram_configured(setting)
        return {
            'is_connected': cls.has_user_telegram_connection(user),
            'is_configured': is_configured,
            'bot_username': setting.telegram_bot_username.strip() if is_configured else '',
        }

    @classmethod
    def update_admin_config(cls, setting: IntegrationSetting, payload: dict) -> None:
        if 'telegram_enabled' in payload:
            setting.telegram_enabled = payload['telegram_enabled'] is True

        if 'telegram_bot_username' in payload:
            setting.telegram_bot_username = cls.normalize_bot_username(payload.get('telegram_bot_username'))

        if payload.get('clear_telegram_bot_token') is True:
            setting.telegram_bot_token = ''

        if isinstance(payload.get('telegram_bot_token'), str) and payload['telegram_bot_token'].strip():
            setting.telegram_bot_token = cls.encrypt_secret(payload['telegram_bot_token'])

        if not setting.telegram_enabled:
            return

        if not setting.telegram_bot_username.strip():
            raise IntegrationSettingConfigurationError('텔레그램 봇 사용자명을 입력해주세요.')
        if not cls.decrypt_secret(setting.telegram_bot_token):
            raise IntegrationSettingConfigurationError('텔레그램 봇 토큰을 입력해주세요.')
