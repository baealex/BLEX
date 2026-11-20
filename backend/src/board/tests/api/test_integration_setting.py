import json
from unittest.mock import patch

import requests
from django.contrib.admin.models import CHANGE, LogEntry
from django.test import TestCase, override_settings
from django.test.client import Client

from board.models import IntegrationSetting, Profile, User
from board.services.integration_setting_service import IntegrationSettingService
from board.services.telegram_webhook_service import TelegramWebhookService


TELEGRAM_BOT_PATH = 'board.services.telegram_webhook_service.TelegramBot'
BOT_TOKEN = '123456:telegram-token'


def configure_reachable_bot(mock_bot_class, username='blex_bot'):
    bot = mock_bot_class.return_value
    bot.get_me.return_value = {'ok': True, 'result': {'username': username}}
    bot.set_webhook.return_value = {'ok': True, 'result': True}
    return bot


class IntegrationSettingAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.staff_user = User.objects.create_user(
            username='integrationstaff',
            password='test',
            email='integrationstaff@test.com',
            is_staff=True,
        )
        Profile.objects.create(user=cls.staff_user)

        cls.superuser = User.objects.create_superuser(
            username='integration-superuser',
            password='test',
            email='integration-superuser@test.com',
        )

        cls.normal_user = User.objects.create_user(
            username='integrationnormal',
            password='test',
            email='integrationnormal@test.com',
        )
        Profile.objects.create(user=cls.normal_user)

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        self.client.login(username='integration-superuser', password='test')
        self.delegated_staff_client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        self.delegated_staff_client.login(username='integrationstaff', password='test')

    def test_get_integration_settings_requires_superuser(self):
        guest_client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        response = guest_client.get('/v1/integration-settings')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

        normal_client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        normal_client.login(username='integrationnormal', password='test')
        response = normal_client.get('/v1/integration-settings')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

        response = self.delegated_staff_client.get('/v1/integration-settings')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    @patch(TELEGRAM_BOT_PATH)
    def test_update_integration_settings_stores_secrets_without_exposing_them(self, mock_bot_class):
        configure_reachable_bot(mock_bot_class)
        response = self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
                'telegram_bot_username': '@blex_bot',
                'telegram_bot_token': BOT_TOKEN,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertTrue(body['telegramEnabled'])
        self.assertEqual(body['telegramBotUsername'], 'blex_bot')
        self.assertTrue(body['telegramHasBotToken'])
        self.assertNotIn('telegramToken', json.dumps(body))
        self.assertNotIn('telegram-token', json.dumps(body))

        setting = IntegrationSetting.get_instance()
        self.assertNotEqual(setting.telegram_bot_token, 'telegram-token')
        self.assertEqual(IntegrationSettingService.decrypt_secret(setting.telegram_bot_token), BOT_TOKEN)

        audit_log = LogEntry.objects.get(
            user=self.superuser,
            action_flag=CHANGE,
            change_message='Updated notification integration settings',
        )
        self.assertEqual(audit_log.object_id, '1')
        self.assertNotIn('telegram-token', audit_log.change_message)

    def test_delegated_staff_cannot_update_integration_settings(self):
        """텔레그램 토큰 설정은 최고 관리자만 변경할 수 있다."""
        response = self.delegated_staff_client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
                'telegram_bot_username': 'unauthorized_bot',
                'telegram_bot_token': 'unauthorized-token',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
        setting = IntegrationSetting.get_instance()
        self.assertFalse(setting.telegram_enabled)
        self.assertEqual(setting.telegram_bot_token, '')

    def test_enable_telegram_requires_bot_token(self):
        response = self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')

        setting = IntegrationSetting.get_instance()
        self.assertFalse(setting.telegram_enabled)
        self.assertEqual(setting.telegram_bot_username, '')
        self.assertEqual(setting.telegram_bot_token, '')

    @override_settings(SITE_URL='https://blog.example.com')
    @patch(TELEGRAM_BOT_PATH)
    def test_saving_bot_token_fills_username_and_registers_webhook(self, mock_bot_class):
        """관리자는 토큰만 넣으면 봇 이름과 웹훅 등록을 BLEX가 처리한다."""
        bot = configure_reachable_bot(mock_bot_class, username='found_bot')

        response = self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
                'telegram_bot_token': BOT_TOKEN,
            }),
            content_type='application/json',
        )

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['telegramBotUsername'], 'found_bot')
        self.assertEqual(content['body']['telegramConnection'], {'state': 'connected', 'detail': ''})
        mock_bot_class.assert_called_with(BOT_TOKEN)
        bot.set_webhook.assert_called_once_with(
            'https://blog.example.com/v1/telegram/webHook',
            secret_token=TelegramWebhookService.create_secret(BOT_TOKEN),
            allowed_updates=['message'],
        )
        setting = IntegrationSetting.get_instance()
        self.assertTrue(setting.telegram_enabled)
        self.assertEqual(setting.telegram_bot_username, 'found_bot')

    @patch(TELEGRAM_BOT_PATH)
    def test_new_bot_token_replaces_username_from_previous_bot(self, mock_bot_class):
        configure_reachable_bot(mock_bot_class, username='new_bot')
        setting = IntegrationSetting.get_instance()
        setting.telegram_enabled = True
        setting.telegram_bot_username = 'old_bot'
        setting.telegram_bot_token = IntegrationSettingService.encrypt_secret('111:old-token')
        setting.save()

        response = self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
                'telegram_bot_token': '222:new-token',
            }),
            content_type='application/json',
        )

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['telegramBotUsername'], 'new_bot')

    @patch(TELEGRAM_BOT_PATH)
    def test_invalid_bot_token_is_not_saved(self, mock_bot_class):
        mock_bot_class.return_value.get_me.return_value = {
            'ok': False,
            'error_code': 401,
            'description': 'Unauthorized',
        }

        response = self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
                'telegram_bot_token': '999:wrong-token',
            }),
            content_type='application/json',
        )

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')
        mock_bot_class.return_value.set_webhook.assert_not_called()
        setting = IntegrationSetting.get_instance()
        self.assertFalse(setting.telegram_enabled)
        self.assertEqual(setting.telegram_bot_token, '')

    @patch(TELEGRAM_BOT_PATH)
    def test_webhook_rejection_is_reported_after_saving(self, mock_bot_class):
        """웹훅 등록이 거부돼도 설정은 저장하고 이유를 그대로 보여 준다."""
        bot = configure_reachable_bot(mock_bot_class)
        bot.set_webhook.return_value = {
            'ok': False,
            'error_code': 400,
            'description': 'Bad Request: bad webhook: HTTPS url must be provided for webhook',
        }

        response = self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
                'telegram_bot_token': BOT_TOKEN,
            }),
            content_type='application/json',
        )

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['telegramConnection'], {
            'state': 'rejected',
            'detail': 'Bad Request: bad webhook: HTTPS url must be provided for webhook',
        })
        setting = IntegrationSetting.get_instance()
        self.assertTrue(setting.telegram_enabled)
        self.assertEqual(setting.telegram_bot_username, 'blex_bot')

    @patch(TELEGRAM_BOT_PATH)
    def test_unreachable_telegram_keeps_settings_and_reports_state(self, mock_bot_class):
        mock_bot_class.return_value.get_me.side_effect = requests.ConnectionError()

        response = self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
                'telegram_bot_token': BOT_TOKEN,
            }),
            content_type='application/json',
        )

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['telegramConnection']['state'], 'unreachable')
        setting = IntegrationSetting.get_instance()
        self.assertTrue(setting.telegram_enabled)
        self.assertEqual(IntegrationSettingService.decrypt_secret(setting.telegram_bot_token), BOT_TOKEN)

    @override_settings(SITE_URL='https://blog.example.com')
    @patch(TELEGRAM_BOT_PATH)
    def test_get_reports_webhook_state(self, mock_bot_class):
        setting = IntegrationSetting.get_instance()
        setting.telegram_enabled = True
        setting.telegram_bot_username = 'blex_bot'
        setting.telegram_bot_token = IntegrationSettingService.encrypt_secret('telegram-token')
        setting.save()
        webhook_info = mock_bot_class.return_value.get_webhook_info

        webhook_info.return_value = {
            'ok': True,
            'result': {'url': 'https://blog.example.com/v1/telegram/webHook', 'pending_update_count': 0},
        }
        content = json.loads(self.client.get('/v1/integration-settings').content)
        self.assertEqual(content['body']['telegramConnection']['state'], 'connected')

        webhook_info.return_value = {'ok': True, 'result': {'url': '', 'pending_update_count': 0}}
        content = json.loads(self.client.get('/v1/integration-settings').content)
        self.assertEqual(content['body']['telegramConnection']['state'], 'not_connected')

        webhook_info.return_value = {
            'ok': True,
            'result': {
                'url': 'https://blog.example.com/v1/telegram/webHook',
                'pending_update_count': 3,
                'last_error_message': 'Wrong response from the webhook: 403 Forbidden',
            },
        }
        content = json.loads(self.client.get('/v1/integration-settings').content)
        self.assertEqual(content['body']['telegramConnection'], {
            'state': 'delivery_failed',
            'detail': 'Wrong response from the webhook: 403 Forbidden',
        })

    def test_malformed_bot_token_is_rejected_before_calling_telegram(self):
        with patch(TELEGRAM_BOT_PATH) as mock_bot_class:
            response = self.client.put(
                '/v1/integration-settings',
                json.dumps({
                    'telegram_enabled': True,
                    'telegram_bot_token': '123/../getUpdates?x=',
                }),
                content_type='application/json',
            )

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')
        mock_bot_class.assert_not_called()
        self.assertEqual(IntegrationSetting.get_instance().telegram_bot_token, '')

    @patch(TELEGRAM_BOT_PATH)
    def test_bot_token_telegram_cannot_parse_is_rejected(self, mock_bot_class):
        mock_bot_class.return_value.get_me.return_value = {
            'ok': False,
            'error_code': 404,
            'description': 'Not Found',
        }

        response = self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
                'telegram_bot_token': BOT_TOKEN,
            }),
            content_type='application/json',
        )

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')
        self.assertFalse(IntegrationSetting.get_instance().telegram_enabled)

    @patch(TELEGRAM_BOT_PATH)
    def test_webhook_is_registered_after_settings_are_saved(self, mock_bot_class):
        """텔레그램은 등록 직후 쌓인 메시지를 보내므로, 저장이 먼저 끝나 있어야 한다."""
        bot = configure_reachable_bot(mock_bot_class)
        saved_state_at_registration = {}

        def register(*args, **kwargs):
            setting = IntegrationSetting.objects.get(pk=1)
            saved_state_at_registration['enabled'] = setting.telegram_enabled
            saved_state_at_registration['token'] = IntegrationSettingService.decrypt_secret(
                setting.telegram_bot_token,
            )
            return {'ok': True, 'result': True}

        bot.set_webhook.side_effect = register

        self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
                'telegram_bot_token': BOT_TOKEN,
            }),
            content_type='application/json',
        )

        self.assertEqual(saved_state_at_registration, {'enabled': True, 'token': BOT_TOKEN})

    @patch(TELEGRAM_BOT_PATH)
    def test_resaving_same_token_while_telegram_is_unreachable_keeps_bot_username(self, mock_bot_class):
        mock_bot_class.return_value.get_me.side_effect = requests.ConnectionError()
        setting = IntegrationSetting.get_instance()
        setting.telegram_enabled = True
        setting.telegram_bot_username = 'blex_bot'
        setting.telegram_bot_token = IntegrationSettingService.encrypt_secret(BOT_TOKEN)
        setting.save()

        response = self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
                'telegram_bot_token': BOT_TOKEN,
            }),
            content_type='application/json',
        )

        content = json.loads(response.content)
        self.assertEqual(content['body']['telegramConnection']['state'], 'unreachable')
        self.assertEqual(IntegrationSetting.get_instance().telegram_bot_username, 'blex_bot')

    @patch(TELEGRAM_BOT_PATH)
    def test_missing_bot_username_is_reported_as_not_connected(self, mock_bot_class):
        """봇 이름이 없으면 사용자가 연결할 수 없으므로 다시 연결을 안내한다."""
        setting = IntegrationSetting.get_instance()
        setting.telegram_enabled = True
        setting.telegram_bot_username = ''
        setting.telegram_bot_token = IntegrationSettingService.encrypt_secret(BOT_TOKEN)
        setting.save()

        content = json.loads(self.client.get('/v1/integration-settings').content)

        self.assertEqual(content['body']['telegramConnection']['state'], 'not_connected')
        mock_bot_class.return_value.get_webhook_info.assert_not_called()

    @patch(TELEGRAM_BOT_PATH)
    def test_unexpected_telegram_response_is_reported_as_unreachable(self, mock_bot_class):
        mock_bot_class.return_value.get_me.return_value = []

        response = self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
                'telegram_bot_token': BOT_TOKEN,
            }),
            content_type='application/json',
        )

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['telegramConnection']['state'], 'unreachable')

    def test_get_does_not_contact_telegram_when_disabled(self):
        with patch(TELEGRAM_BOT_PATH) as mock_bot_class:
            content = json.loads(self.client.get('/v1/integration-settings').content)

        self.assertEqual(content['body']['telegramConnection']['state'], 'disabled')
        mock_bot_class.assert_not_called()

    def test_update_integration_settings_rejects_invalid_json_payload(self):
        response = self.client.put(
            '/v1/integration-settings',
            '{invalid',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')

        response = self.client.put(
            '/v1/integration-settings',
            json.dumps([]),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')

        response = self.client.put('/v1/integration-settings')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')

    def test_disabling_telegram_keeps_saved_bot_secret(self):
        setting = IntegrationSetting.get_instance()
        setting.telegram_enabled = True
        setting.telegram_bot_username = 'blex_bot'
        setting.telegram_bot_token = IntegrationSettingService.encrypt_secret('telegram-token')
        setting.save()

        response = self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': False,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertFalse(content['body']['telegramEnabled'])
        setting.refresh_from_db()
        self.assertEqual(IntegrationSettingService.decrypt_secret(setting.telegram_bot_token), 'telegram-token')
