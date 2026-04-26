from urllib.parse import unquote

from django.test import TestCase
from django.test.client import Client

from board.models import Profile, User


class SettingsViewTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.reader = User.objects.create_user(
            username='settings-reader',
            password='password123',
            email='reader@example.com',
        )
        Profile.objects.create(user=cls.reader, role=Profile.Role.READER)

        cls.staff = User.objects.create_user(
            username='settings-staff',
            password='password123',
            email='staff@example.com',
            is_staff=True,
        )
        Profile.objects.create(user=cls.staff, role=Profile.Role.EDITOR)

    def setUp(self):
        self.client = Client()

    def decode_body(self, response):
        return unquote(response.content.decode())

    def test_user_settings_render_user_namespace(self):
        self.client.login(username='settings-reader', password='password123')

        response = self.client.get('/settings/notify')

        self.assertEqual(response.status_code, 200)
        body = self.decode_body(response)
        self.assertIn('"settingsMode": "user"', body)
        self.assertIn('"basePath": "/settings"', body)

    def test_staff_admin_settings_render_admin_namespace(self):
        self.client.login(username='settings-staff', password='password123')

        response = self.client.get('/admin-settings/site-settings')

        self.assertEqual(response.status_code, 200)
        body = self.decode_body(response)
        self.assertIn('"settingsMode": "admin"', body)
        self.assertIn('"basePath": "/admin-settings"', body)
        self.assertContains(response, '관리자 설정 | BLEX')

    def test_reader_cannot_open_admin_settings_namespace(self):
        client = Client(raise_request_exception=False)
        client.login(username='settings-reader', password='password123')

        response = client.get('/admin-settings/site-settings')

        self.assertEqual(response.status_code, 403)

    def test_legacy_admin_settings_url_redirects_to_admin_namespace(self):
        self.client.login(username='settings-staff', password='password123')

        response = self.client.get('/settings/seo-aeo')

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], '/admin-settings/seo-aeo')
