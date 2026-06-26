from __future__ import annotations

import hashlib
import hmac
import re
from typing import TYPE_CHECKING

from cryptography.fernet import InvalidToken

from modules.cipher import decrypt_value, encrypt_value

if TYPE_CHECKING:
    from board.models import TwoFactorAuth


class TwoFactorAuthSecretService:
    """Protect TOTP secrets and recovery keys stored for 2FA."""

    SHA256_HEX_PATTERN = re.compile(r'^[0-9a-f]{64}$')
    TOTP_SECRET_PATTERN = re.compile(r'^[A-Z2-7=]{16,64}$')

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
    def encrypt_totp_secret(cls, value: str) -> str:
        value = (value or '').strip()
        if not value:
            return ''
        if cls.is_encrypted(value):
            return value
        return encrypt_value(value).decode()

    @classmethod
    def decrypt_totp_secret(cls, value: str) -> str:
        value = (value or '').strip()
        if not value:
            return ''
        try:
            return decrypt_value(value)
        except (InvalidToken, Exception):
            if cls.is_plain_totp_secret(value):
                return value
            return ''

    @classmethod
    def is_plain_totp_secret(cls, value: str) -> bool:
        return bool(cls.TOTP_SECRET_PATTERN.fullmatch((value or '').strip().upper()))

    @classmethod
    def is_recovery_key_hash(cls, value: str) -> bool:
        return bool(cls.SHA256_HEX_PATTERN.fullmatch((value or '').strip()))

    @staticmethod
    def hash_recovery_key(value: str) -> str:
        return hashlib.sha256((value or '').strip().encode('utf-8')).hexdigest()

    @classmethod
    def protect_recovery_key(cls, value: str) -> str:
        value = (value or '').strip()
        if not value:
            return ''
        if cls.is_recovery_key_hash(value):
            return value
        return cls.hash_recovery_key(value)

    @classmethod
    def verify_recovery_key(cls, stored_value: str, token: str) -> bool:
        stored_value = (stored_value or '').strip()
        token = (token or '').strip()
        if not stored_value or not token:
            return False

        if cls.is_recovery_key_hash(stored_value):
            return hmac.compare_digest(stored_value, cls.hash_recovery_key(token))

        return hmac.compare_digest(stored_value, token)

    @classmethod
    def prepare_for_save(cls, two_factor_auth: 'TwoFactorAuth') -> None:
        if two_factor_auth.totp_secret:
            two_factor_auth.totp_secret = cls.encrypt_totp_secret(two_factor_auth.totp_secret)
        if two_factor_auth.recovery_key:
            two_factor_auth.recovery_key = cls.protect_recovery_key(two_factor_auth.recovery_key)
