import json

from django.test import TestCase
from django.test.client import Client

from board.models import LoginSetting, Profile, SocialAuthProvider, User
from board.services.hcaptcha_service import HCaptchaService
from board.services.social_auth_provider_service import SocialAuthProviderService


class LoginSettingAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.staff_user = User.objects.create_user(
            username='staffuser',
            password='test',
            email='staff@test.com',
            is_staff=True,
        )
        Profile.objects.create(user=cls.staff_user)

        cls.normal_user = User.objects.create_user(
            username='normaluser',
            password='test',
            email='normal@test.com',
        )
        Profile.objects.create(user=cls.normal_user)

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        self.client.login(username='staffuser', password='test')

    def test_get_login_settings_not_login(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')

        response = client.get('/v1/login-settings')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_login_settings_normal_user(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')

        response = client.get('/v1/login-settings')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_get_login_settings_does_not_expose_secret_values(self):
        setting = LoginSetting.get_instance()
        setting.hcaptcha_enabled = True
        setting.hcaptcha_site_key = 'site-key'
        setting.hcaptcha_secret_key = HCaptchaService.encrypt_secret('hcaptcha-secret')
        setting.save()
        SocialAuthProvider.objects.update_or_create(
            key='google',
            defaults={
                'is_enabled': True,
                'client_id': 'google-client-id',
                'client_secret': 'google-secret',
            }
        )

        response = self.client.get('/v1/login-settings')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertTrue(body['hcaptchaHasSecretKey'])
        self.assertNotIn('hcaptchaSecretKey', body)
        self.assertNotIn('hcaptcha_secret_key', json.dumps(body))

        google = next(
            provider for provider in body['socialAuthProviders']
            if provider['key'] == 'google'
        )
        self.assertTrue(google['hasClientSecret'])
        self.assertNotIn('clientSecret', google)
        self.assertNotIn('client_secret', json.dumps(google))

    def test_update_login_settings_stores_secret_values_without_exposing_them(self):
        data = {
            'welcome_notification_message': '환영합니다, {name}님!',
            'welcome_notification_url': '/welcome',
            'account_deletion_redirect_url': 'https://forms.example.com/exit',
            'hcaptcha_enabled': True,
            'hcaptcha_site_key': 'site-key',
            'hcaptcha_secret_key': 'hcaptcha-secret',
            'social_auth_providers': [
                {
                    'key': 'google',
                    'is_enabled': True,
                    'client_id': 'google-client-id',
                    'client_secret': 'google-secret',
                },
            ],
        }

        response = self.client.put(
            '/v1/login-settings',
            json.dumps(data),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertEqual(body['welcomeNotificationMessage'], '환영합니다, {name}님!')
        self.assertEqual(body['welcomeNotificationUrl'], '/welcome')
        self.assertEqual(body['accountDeletionRedirectUrl'], 'https://forms.example.com/exit')
        self.assertTrue(body['hcaptchaEnabled'])
        self.assertEqual(body['hcaptchaSiteKey'], 'site-key')
        self.assertTrue(body['hcaptchaHasSecretKey'])
        self.assertNotIn('hcaptchaSecretKey', body)

        setting = LoginSetting.get_instance()
        self.assertNotEqual(setting.hcaptcha_secret_key, 'hcaptcha-secret')
        self.assertEqual(HCaptchaService.decrypt_secret(setting.hcaptcha_secret_key), 'hcaptcha-secret')

        google = SocialAuthProvider.objects.get(key='google')
        self.assertTrue(google.is_enabled)
        self.assertEqual(google.client_id, 'google-client-id')
        self.assertNotEqual(google.client_secret, 'google-secret')
        self.assertEqual(SocialAuthProviderService.get_client_secret('google'), 'google-secret')

        body_google = next(
            provider for provider in body['socialAuthProviders']
            if provider['key'] == 'google'
        )
        self.assertTrue(body_google['hasClientSecret'])
        self.assertNotIn('clientSecret', body_google)

    def test_update_social_auth_provider_keeps_existing_secret_when_blank(self):
        SocialAuthProvider.objects.update_or_create(
            key='github',
            defaults={
                'is_enabled': True,
                'client_id': 'old-client-id',
                'client_secret': 'old-secret',
            }
        )

        response = self.client.put(
            '/v1/login-settings',
            json.dumps({
                'social_auth_providers': [{
                    'key': 'github',
                    'is_enabled': True,
                    'client_id': 'new-client-id',
                }]
            }),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        github = SocialAuthProvider.objects.get(key='github')
        self.assertEqual(github.client_id, 'new-client-id')
        self.assertNotEqual(github.client_secret, 'old-secret')
        self.assertEqual(SocialAuthProviderService.get_client_secret('github'), 'old-secret')

    def test_update_hcaptcha_keeps_existing_secret_when_blank(self):
        setting = LoginSetting.get_instance()
        setting.hcaptcha_enabled = True
        setting.hcaptcha_site_key = 'old-site-key'
        setting.hcaptcha_secret_key = HCaptchaService.encrypt_secret('old-secret')
        setting.save()

        response = self.client.put(
            '/v1/login-settings',
            json.dumps({
                'hcaptcha_enabled': True,
                'hcaptcha_site_key': 'new-site-key',
            }),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        setting.refresh_from_db()
        self.assertEqual(setting.hcaptcha_site_key, 'new-site-key')
        self.assertEqual(HCaptchaService.decrypt_secret(setting.hcaptcha_secret_key), 'old-secret')

    def test_update_hcaptcha_can_clear_secret_when_disabled(self):
        setting = LoginSetting.get_instance()
        setting.hcaptcha_enabled = True
        setting.hcaptcha_site_key = 'site-key'
        setting.hcaptcha_secret_key = HCaptchaService.encrypt_secret('old-secret')
        setting.save()

        response = self.client.put(
            '/v1/login-settings',
            json.dumps({
                'hcaptcha_enabled': False,
                'clear_hcaptcha_secret_key': True,
            }),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertFalse(content['body']['hcaptchaHasSecretKey'])

        setting.refresh_from_db()
        self.assertEqual(setting.hcaptcha_secret_key, '')

    def test_enable_hcaptcha_requires_site_key_and_secret(self):
        response = self.client.put(
            '/v1/login-settings',
            json.dumps({
                'hcaptcha_enabled': True,
                'hcaptcha_site_key': '',
            }),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')
