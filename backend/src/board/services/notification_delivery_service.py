from __future__ import annotations

from typing import TYPE_CHECKING

from board.services.integration_setting_service import IntegrationSettingService
from board.services.site_url_service import SiteUrlService
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

        bot_token = IntegrationSettingService.get_telegram_bot_token()
        if not bot_token:
            return

        bot = TelegramBot(bot_token)
        SubTaskProcessor.process(lambda: bot.send_messages(telegram_id, [
            SiteUrlService.configured_absolute_url(str(notify.url)),
            notify.content,
        ]))
