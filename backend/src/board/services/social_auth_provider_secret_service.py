from __future__ import annotations

from cryptography.fernet import InvalidToken

from modules.cipher import decrypt_value, encrypt_value


class SocialAuthProviderSecretService:
    """Encrypt/decrypt OAuth client secrets stored in the database."""

    @staticmethod
    def is_encrypted(value: str) -> bool:
        if not value:
            return False
        try:
            decrypt_value(value)
            return True
        except Exception:
            return False

    @staticmethod
    def encrypt_secret(value: str) -> str:
        value = (value or '').strip()
        if not value:
            return ''
        if SocialAuthProviderSecretService.is_encrypted(value):
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
