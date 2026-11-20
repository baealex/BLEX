from __future__ import annotations

import hashlib
import hmac
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

import requests
from django.conf import settings
from django.http import HttpRequest

from board.services.integration_setting_service import IntegrationSettingService
from modules.telegram import TelegramBot

if TYPE_CHECKING:
    from board.models import IntegrationSetting


class TelegramConnectionState(str, Enum):
    DISABLED = 'disabled'
    CONNECTED = 'connected'
    NOT_CONNECTED = 'not_connected'
    INVALID_TOKEN = 'invalid_token'
    REJECTED = 'rejected'
    DELIVERY_FAILED = 'delivery_failed'
    UNREACHABLE = 'unreachable'


@dataclass(frozen=True)
class TelegramConnectionStatus:
    state: TelegramConnectionState
    detail: str = ''

    def to_dict(self) -> dict[str, str]:
        return {
            'state': self.state.value,
            'detail': self.detail,
        }


class TelegramWebhookService:
    """Register BLEX as the bot webhook and verify that updates come from Telegram."""

    WEBHOOK_PATH = '/v1/telegram/webHook'
    SECRET_HEADER = 'HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'
    ALLOWED_UPDATES = ['message']
    # Telegram answers 401 for an unknown token and 404 for a token it cannot parse.
    INVALID_TOKEN_ERROR_CODES = {401, 404}

    @staticmethod
    def create_secret(bot_token: str) -> str:
        return hmac.new(
            settings.SECRET_KEY.encode(),
            f'telegram-webhook:{bot_token}'.encode(),
            hashlib.sha256,
        ).hexdigest()

    @classmethod
    def is_authentic_request(cls, request: HttpRequest, bot_token: str) -> bool:
        received_secret = request.META.get(cls.SECRET_HEADER, '')
        return hmac.compare_digest(
            received_secret.encode(),
            cls.create_secret(bot_token).encode(),
        )

    @staticmethod
    def call_bot_api(call: Callable[[], object]) -> dict | None:
        """Return the Bot API response, or None when Telegram could not be reached or answered garbage."""
        try:
            response = call()
        except (requests.RequestException, ValueError):
            return None
        return response if isinstance(response, dict) else None

    @classmethod
    def confirm_bot(cls, setting: IntegrationSetting) -> TelegramConnectionStatus | None:
        """Copy the bot username from Telegram onto the setting.

        Returns None once Telegram confirms the token, otherwise the failure. The caller saves the setting.
        """
        bot_token = IntegrationSettingService.get_telegram_bot_token(setting)
        if not bot_token:
            return TelegramConnectionStatus(TelegramConnectionState.DISABLED)

        bot_profile = cls.call_bot_api(TelegramBot(bot_token).get_me)
        if bot_profile is None:
            return TelegramConnectionStatus(TelegramConnectionState.UNREACHABLE)
        if not bot_profile.get('ok'):
            if bot_profile.get('error_code') in cls.INVALID_TOKEN_ERROR_CODES:
                return TelegramConnectionStatus(TelegramConnectionState.INVALID_TOKEN)
            return cls.rejected(bot_profile)

        result = bot_profile.get('result')
        bot_username = IntegrationSettingService.normalize_bot_username(
            result.get('username') if isinstance(result, dict) else None,
        )
        if bot_username:
            setting.telegram_bot_username = bot_username
        return None

    @classmethod
    def register_webhook(cls, setting: IntegrationSetting, webhook_url: str) -> TelegramConnectionStatus:
        bot_token = IntegrationSettingService.get_telegram_bot_token(setting)
        if not bot_token:
            return TelegramConnectionStatus(TelegramConnectionState.DISABLED)

        registration = cls.call_bot_api(lambda: TelegramBot(bot_token).set_webhook(
            webhook_url,
            secret_token=cls.create_secret(bot_token),
            allowed_updates=cls.ALLOWED_UPDATES,
        ))
        if registration is None:
            return TelegramConnectionStatus(TelegramConnectionState.UNREACHABLE)
        if not registration.get('ok'):
            return cls.rejected(registration)
        return TelegramConnectionStatus(TelegramConnectionState.CONNECTED)

    @classmethod
    def inspect(cls, setting: IntegrationSetting, webhook_url: str) -> TelegramConnectionStatus:
        bot_token = IntegrationSettingService.get_telegram_bot_token(setting)
        if not bot_token:
            return TelegramConnectionStatus(TelegramConnectionState.DISABLED)

        # Users cannot open a connect link without the bot username, so offer a reconnect to fetch it.
        if not setting.telegram_bot_username.strip():
            return TelegramConnectionStatus(TelegramConnectionState.NOT_CONNECTED)

        webhook_info = cls.call_bot_api(TelegramBot(bot_token).get_webhook_info)
        if webhook_info is None:
            return TelegramConnectionStatus(TelegramConnectionState.UNREACHABLE)
        if not webhook_info.get('ok'):
            if webhook_info.get('error_code') in cls.INVALID_TOKEN_ERROR_CODES:
                return TelegramConnectionStatus(TelegramConnectionState.INVALID_TOKEN)
            return cls.rejected(webhook_info)

        webhook = webhook_info.get('result')
        if not isinstance(webhook, dict) or webhook.get('url') != webhook_url:
            return TelegramConnectionStatus(TelegramConnectionState.NOT_CONNECTED)

        # Telegram keeps undelivered updates queued while BLEX rejects them, e.g. after SECRET_KEY changes.
        if webhook.get('pending_update_count') and webhook.get('last_error_message'):
            return TelegramConnectionStatus(
                TelegramConnectionState.DELIVERY_FAILED,
                str(webhook['last_error_message']),
            )
        return TelegramConnectionStatus(TelegramConnectionState.CONNECTED)

    @staticmethod
    def rejected(response: dict) -> TelegramConnectionStatus:
        return TelegramConnectionStatus(
            TelegramConnectionState.REJECTED,
            str(response.get('description') or ''),
        )
