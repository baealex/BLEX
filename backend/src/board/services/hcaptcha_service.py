from __future__ import annotations

import requests
from cryptography.fernet import InvalidToken

from board.models import LoginSetting
from modules.cipher import decrypt_value, encrypt_value


class HCaptchaConfigurationError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class HCaptchaService:
    VERIFY_URL = 'https://hcaptcha.com/siteverify'

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

    @classmethod
    def get_config(cls, setting: LoginSetting | None = None) -> dict[str, object]:
        setting = setting or LoginSetting.get_instance()
        return {
            'enabled': setting.hcaptcha_enabled,
            'site_key': setting.hcaptcha_site_key.strip(),
            'secret_key': cls.decrypt_secret(setting.hcaptcha_secret_key),
        }

    @classmethod
    def get_site_key(cls) -> str:
        config = cls.get_config()
        if not config['enabled'] or not config['secret_key']:
            return ''
        return str(config['site_key'])

    @classmethod
    def is_enabled(cls) -> bool:
        config = cls.get_config()
        return bool(config['enabled'] and config['secret_key'])

    @classmethod
    def verify_response(cls, response_token: str) -> bool:
        response_token = (response_token or '').strip()
        if not response_token:
            return False

        config = cls.get_config()
        secret_key = str(config['secret_key'])
        if not config['enabled']:
            return True
        if not secret_key:
            return False

        try:
            response = requests.post(
                cls.VERIFY_URL,
                data={
                    'response': response_token,
                    'secret': secret_key,
                },
                timeout=5,
            )
        except requests.RequestException:
            return False

        try:
            result = response.json()
        except ValueError:
            return False

        return result.get('success') is True

    @classmethod
    def serialize_admin_config(cls, setting: LoginSetting) -> dict[str, object]:
        config = cls.get_config(setting)
        return {
            'hcaptcha_enabled': bool(config['enabled']),
            'hcaptcha_site_key': str(config['site_key']),
            'hcaptcha_has_secret_key': bool(config['secret_key']),
        }

    @classmethod
    def update_admin_config(cls, setting: LoginSetting, payload: dict) -> None:
        hcaptcha_keys = {
            'hcaptcha_enabled',
            'hcaptcha_site_key',
            'hcaptcha_secret_key',
            'clear_hcaptcha_secret_key',
        }
        if not any(key in payload for key in hcaptcha_keys):
            return

        if 'hcaptcha_enabled' in payload:
            setting.hcaptcha_enabled = payload['hcaptcha_enabled'] is True

        if isinstance(payload.get('hcaptcha_site_key'), str):
            setting.hcaptcha_site_key = payload['hcaptcha_site_key'].strip()

        if payload.get('clear_hcaptcha_secret_key') is True:
            setting.hcaptcha_secret_key = ''

        if isinstance(payload.get('hcaptcha_secret_key'), str) and payload['hcaptcha_secret_key'].strip():
            setting.hcaptcha_secret_key = cls.encrypt_secret(payload['hcaptcha_secret_key'])

        if setting.hcaptcha_enabled:
            if not setting.hcaptcha_site_key.strip():
                raise HCaptchaConfigurationError('hCaptcha Site Key를 입력해주세요.')
            if not cls.decrypt_secret(setting.hcaptcha_secret_key):
                raise HCaptchaConfigurationError('hCaptcha Secret Key를 입력해주세요.')
