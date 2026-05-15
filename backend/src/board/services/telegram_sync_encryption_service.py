from __future__ import annotations

from typing import TYPE_CHECKING

from cryptography.fernet import InvalidToken

from modules.cipher import decrypt_value, encrypt_value

if TYPE_CHECKING:
    from board.models import TelegramSync


class TelegramSyncEncryptionService:
    """Encapsulates TelegramSync encrypted ID persistence behavior."""

    @staticmethod
    def get_decrypted_tid(telegram_sync: 'TelegramSync') -> str:
        try:
            return decrypt_value(telegram_sync.tid)
        except (InvalidToken, Exception):
            return ''

    @staticmethod
    def is_encrypted(value: str) -> bool:
        try:
            decrypt_value(value)
            return True
        except Exception:
            return False

    @staticmethod
    def prepare_for_save(telegram_sync: 'TelegramSync') -> None:
        if (
            telegram_sync.tid
            and not TelegramSyncEncryptionService.is_encrypted(telegram_sync.tid)
        ):
            telegram_sync.tid = encrypt_value(telegram_sync.tid).decode()
