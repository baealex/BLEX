from unittest.mock import patch

from django.test import TestCase, override_settings

from board.models import IntegrationSetting, Notify, TelegramSync, User
from board.services.integration_setting_service import IntegrationSettingService


class NotifySendNotifyTestCase(TestCase):
    """Characterization tests for Notify.send_notify() delivery side effects."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='notify-user',
            password='test',
            email='notify@test.com',
        )

    def create_notify(self):
        return Notify.objects.create(
            user=self.user,
            key='notify-key',
            url='/settings',
            content='Hello notify',
        )

    def configure_telegram_bot(self):
        setting = IntegrationSetting.get_instance()
        setting.telegram_enabled = True
        setting.telegram_bot_username = 'test_bot'
        setting.telegram_bot_token = IntegrationSettingService.encrypt_secret('token')
        setting.save()

    @patch('board.services.notification_delivery_service.SubTaskProcessor.process')
    @patch('board.services.notification_delivery_service.TelegramBot')
    def test_send_notify_without_telegram_sync_is_noop(self, mock_bot, mock_process):
        notify = self.create_notify()

        notify.send_notify()

        mock_bot.assert_not_called()
        mock_process.assert_not_called()

    @patch('board.services.notification_delivery_service.SubTaskProcessor.process')
    @patch('board.services.notification_delivery_service.TelegramBot')
    def test_send_notify_with_blank_telegram_id_is_noop(self, mock_bot, mock_process):
        TelegramSync.objects.create(user=self.user, tid='')
        notify = self.create_notify()

        notify.send_notify()

        mock_bot.assert_not_called()
        mock_process.assert_not_called()

    @patch('board.services.notification_delivery_service.SubTaskProcessor.process')
    @patch('board.services.notification_delivery_service.TelegramBot')
    def test_send_notify_without_bot_configuration_is_noop(self, mock_bot, mock_process):
        TelegramSync.objects.create(user=self.user, tid='123456')
        notify = self.create_notify()

        notify.send_notify()

        mock_bot.assert_not_called()
        mock_process.assert_not_called()

    @override_settings(SITE_URL='https://example.test')
    @patch('board.services.notification_delivery_service.SubTaskProcessor.process')
    @patch('board.services.notification_delivery_service.TelegramBot')
    def test_send_notify_dispatches_telegram_message(self, mock_bot, mock_process):
        self.configure_telegram_bot()
        TelegramSync.objects.create(user=self.user, tid='123456')
        notify = self.create_notify()

        notify.send_notify()

        mock_bot.assert_called_once_with('token')
        mock_process.assert_called_once()

        callback = mock_process.call_args.args[0]
        callback()

        mock_bot.return_value.send_messages.assert_called_once_with(
            '123456',
            ['https://example.test/settings', 'Hello notify'],
        )
