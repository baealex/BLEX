import json

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

        cls.normal_user = User.objects.create_user(
            username='integrationnormal',
            password='test',
            email='integrationnormal@test.com',
        )
        Profile.objects.create(user=cls.normal_user)

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        self.client.login(username='integrationstaff', password='test')

    def test_get_integration_settings_requires_staff(self):
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
