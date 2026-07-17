import json

from django.contrib.admin.models import CHANGE, LogEntry
from django.test import TestCase
from django.test.client import Client

from board.models import IntegrationSetting, Profile, User
from board.services.integration_setting_service import IntegrationSettingService


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

    def test_update_integration_settings_stores_secrets_without_exposing_them(self):
        response = self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
                'telegram_bot_username': '@blex_bot',
                'telegram_bot_token': 'telegram-token',
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
        self.assertEqual(IntegrationSettingService.decrypt_secret(setting.telegram_bot_token), 'telegram-token')

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

    def test_enable_telegram_requires_username_and_token(self):
        response = self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
                'telegram_bot_username': '',
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

        response = self.client.put(
            '/v1/integration-settings',
            json.dumps({
                'telegram_enabled': True,
                'telegram_bot_username': 'blex_bot',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')

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
