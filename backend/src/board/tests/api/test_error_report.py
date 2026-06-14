from django.test import Client, TestCase

from board.models import Config, Profile, User


class ErrorReportAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='testuser',
            password='testpass',
            email='test@test.com',
        )
        Profile.objects.create(user=cls.user, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.user)

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'

    def test_error_report_requires_csrf_token_when_enforced(self):
        csrf_client = Client(enforce_csrf_checks=True)

        response = csrf_client.post('/v1/report/error', {
            'content': 'Missing CSRF token'
        })

        self.assertEqual(response.status_code, 403)

    def test_error_report_accepts_form_csrf_token_when_enforced(self):
        csrf_client = Client(enforce_csrf_checks=True)
        token = 'a' * 32
        csrf_client.cookies['csrftoken'] = token

        response = csrf_client.post('/v1/report/error', {
            'csrfmiddlewaretoken': token,
            'content': 'Report with CSRF token'
        })

        self.assertEqual(response.status_code, 200)

    def test_error_report_post_returns_ok_without_forwarding(self):
        response = self.client.post('/v1/report/error', {
            'user': 'testuser',
            'path': '/test/path',
            'content': 'Test error'
        })

        self.assertEqual(response.status_code, 200)

    def test_error_report_missing_content_still_returns_ok(self):
        response = self.client.post('/v1/report/error', {
            'path': '/dashboard',
        })

        self.assertEqual(response.status_code, 200)

    def test_error_report_invalid_method(self):
        response = self.client.get('/v1/report/error')
        self.assertEqual(response.status_code, 404)

        response = self.client.put('/v1/report/error', {})
        self.assertEqual(response.status_code, 404)

        response = self.client.delete('/v1/report/error')
        self.assertEqual(response.status_code, 404)
