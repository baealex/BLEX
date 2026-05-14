from django.core.cache import cache
from django.test import RequestFactory, TestCase

from board.services.auth_login_service import AuthLoginService


class AuthLoginServiceTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.factory = RequestFactory()

    def test_get_client_ip_prefers_forwarded_for(self):
        request = self.factory.post(
            '/v1/login',
            HTTP_X_FORWARDED_FOR='203.0.113.1',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(AuthLoginService.get_client_ip(request), '203.0.113.1')

    def test_login_rate_limit_allows_under_limit(self):
        request = self.factory.post('/v1/login', REMOTE_ADDR='127.0.0.1')
        for _ in range(AuthLoginService.LOGIN_ATTEMPT_LIMIT - 1):
            AuthLoginService.increment_login_attempts(request)

        self.assertIsNone(AuthLoginService.check_login_rate_limit(request))

    def test_login_rate_limit_rejects_at_limit(self):
        request = self.factory.post('/v1/login', REMOTE_ADDR='127.0.0.1')
        for _ in range(AuthLoginService.LOGIN_ATTEMPT_LIMIT):
            AuthLoginService.increment_login_attempts(request)

        response = AuthLoginService.check_login_rate_limit(request)

        self.assertIsNotNone(response)

    def test_clear_login_attempts_removes_attempt_count(self):
        request = self.factory.post('/v1/login', REMOTE_ADDR='127.0.0.1')
        AuthLoginService.increment_login_attempts(request)

        AuthLoginService.clear_login_attempts(request)

        self.assertEqual(
            cache.get(AuthLoginService.get_attempt_cache_key(request), 0),
            0,
        )
