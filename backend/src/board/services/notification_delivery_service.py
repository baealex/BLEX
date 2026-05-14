from __future__ import annotations

from typing import TYPE_CHECKING

from django.conf import settings

from modules.sub_task import SubTaskProcessor
from modules.telegram import TelegramBot

if TYPE_CHECKING:
    from board.models import Notify


class NotificationDeliveryService:
    """Encapsulates external notification delivery side effects."""

    @staticmethod
    def send_telegram_notification(notify: 'Notify') -> None:
        if not hasattr(notify.user, 'telegramsync'):
            return

        telegram_id = notify.user.telegramsync.get_decrypted_tid()
        if telegram_id == '':
            return

        bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
        SubTaskProcessor.process(lambda: bot.send_messages(telegram_id, [
            settings.SITE_URL + str(notify.url),
            notify.content,
        ]))
