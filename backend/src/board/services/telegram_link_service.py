from __future__ import annotations

import base64
import io
import secrets
import string
from dataclasses import dataclass
from datetime import timedelta
from enum import Enum

import qrcode
from django.contrib.auth.models import User
from django.utils import timezone
from django.utils.translation import gettext

from board.models import TelegramSync
from board.services.site_url_service import SiteUrlService


class TelegramLinkResult(str, Enum):
    LINKED = 'linked'
    EXPIRED = 'expired'
    NOT_FOUND = 'not_found'


@dataclass(frozen=True)
class TelegramMessage:
    sender_id: int | str
    text: str


@dataclass(frozen=True)
class TelegramConnectLink:
    token: str
    link: str
    qr_code: str

    def to_dict(self) -> dict[str, str]:
        return {
            'token': self.token,
            'link': self.link,
            'qr_code': self.qr_code,
        }


class TelegramLinkService:
    """Connect a BLEX account to the Telegram chat that sends its one-time token."""

    TOKEN_LENGTH = 6
    TOKEN_ALPHABET = string.ascii_letters + string.digits
    TOKEN_LIFETIME = timedelta(hours=24)
    START_COMMAND = '/start'

    @classmethod
    def create_unique_token(cls) -> str:
        while True:
            token = ''.join(secrets.choice(cls.TOKEN_ALPHABET) for _ in range(cls.TOKEN_LENGTH))
            if not TelegramSync.objects.filter(auth_token=token).exists():
                return token

    @classmethod
    def issue_link(cls, user: User, bot_username: str) -> TelegramConnectLink:
        token = cls.create_unique_token()
        token_exp = timezone.now() + cls.TOKEN_LIFETIME
        telegram_sync = TelegramSync.objects.filter(user=user).first()
        if telegram_sync is None:
            TelegramSync.objects.create(user=user, auth_token=token, auth_token_exp=token_exp)
        else:
            telegram_sync.auth_token = token
            telegram_sync.auth_token_exp = token_exp
            # Leave tid alone so a link finishing in the webhook at the same moment is not undone.
            telegram_sync.save(update_fields=['auth_token', 'auth_token_exp'])

        link = cls.build_start_link(bot_username, token)
        return TelegramConnectLink(
            token=token,
            link=link,
            qr_code=cls.build_qr_code(link),
        )

    @staticmethod
    def build_start_link(bot_username: str, token: str) -> str:
        # Telegram sends "/start <token>" to the bot when the user taps Start.
        return f'https://t.me/{bot_username}?start={token}'

    @staticmethod
    def build_qr_code(link: str) -> str:
        qr = qrcode.QRCode(box_size=8, border=2)
        qr.add_data(link)
        qr.make(fit=True)

        image = qr.make_image(fill_color='black', back_color='white')
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        encoded_image = base64.b64encode(buffer.getvalue()).decode()
        return f'data:image/png;base64,{encoded_image}'

    @staticmethod
    def read_message(payload: dict) -> TelegramMessage | None:
        message = payload.get('message')
        if not isinstance(message, dict):
            return None

        sender = message.get('from')
        if not isinstance(sender, dict) or sender.get('id') is None:
            return None

        text = message.get('text')
        return TelegramMessage(
            sender_id=sender['id'],
            text=text if isinstance(text, str) else '',
        )

    @classmethod
    def extract_token(cls, text: str) -> str:
        """Accept both a deep-link start command and a code typed by the user."""
        parts = text.split()
        if not parts:
            return ''

        command = parts[0]
        if command == cls.START_COMMAND or command.startswith(f'{cls.START_COMMAND}@'):
            return parts[1] if len(parts) == 2 else ''

        return command if len(parts) == 1 else ''

    @classmethod
    def link_account(cls, message: TelegramMessage) -> TelegramLinkResult:
        token = cls.extract_token(message.text)
        if not token:
            return TelegramLinkResult.NOT_FOUND

        telegram_sync = TelegramSync.objects.filter(auth_token=token).first()
        if telegram_sync is None:
            return TelegramLinkResult.NOT_FOUND

        # Claim the one-time token atomically so two chats sending it at once cannot both link.
        claimed = TelegramSync.objects.filter(pk=telegram_sync.pk, auth_token=token).update(auth_token='')
        if not claimed:
            return TelegramLinkResult.NOT_FOUND
        if telegram_sync.is_token_expire():
            return TelegramLinkResult.EXPIRED

        telegram_sync.tid = str(message.sender_id)
        telegram_sync.save(update_fields=['tid'])
        return TelegramLinkResult.LINKED

    @staticmethod
    def build_reply(result: TelegramLinkResult) -> str:
        if result == TelegramLinkResult.LINKED:
            return gettext('Telegram connected successfully.')
        if result == TelegramLinkResult.EXPIRED:
            return gettext('This token has expired. Try connecting again from the website.')
        return gettext('Explore more from BLEX!') + '\n\n' + SiteUrlService.configured_absolute_url('/notion')
