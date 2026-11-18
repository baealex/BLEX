from unittest.mock import patch

from django.test import RequestFactory, TestCase

from board.services.auth_login_service import AuthLoginService


class AuthLoginServiceTestCase(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_get_client_ip_prefers_forwarded_for(self):
        request = self.factory.post(
            '/v1/login',
            HTTP_X_FORWARDED_FOR='203.0.113.1',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(AuthLoginService.get_client_ip(request), '203.0.113.1')

    def test_get_client_ip_ignores_forwarded_for_from_untrusted_source(self):
        request = self.factory.post(
            '/v1/login',
            HTTP_X_FORWARDED_FOR='203.0.113.1',
            REMOTE_ADDR='198.51.100.10',
        )

        self.assertEqual(AuthLoginService.get_client_ip(request), '198.51.100.10')

    def test_get_client_ip_uses_rightmost_untrusted_forwarded_address(self):
        request = self.factory.post(
            '/v1/login',
            HTTP_X_FORWARDED_FOR='198.51.100.10, 127.0.0.1, 203.0.113.1',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(AuthLoginService.get_client_ip(request), '203.0.113.1')

    @patch('board.services.auth_login_service.time', return_value=6000)
    def test_ip_limit_is_shared_by_accounts(self, clock):
        request = self.factory.post('/v1/login', REMOTE_ADDR='198.51.100.10')
        for index in range(AuthLoginService.LOGIN_ATTEMPT_LIMIT):
            self.assertIsNotNone(AuthLoginService.reserve_login_attempt(request, f'user{index}'))

        self.assertIsNone(AuthLoginService.reserve_login_attempt(request, 'another-user'))
        clock.return_value += AuthLoginService.LOGIN_ATTEMPT_TTL_SECONDS
        self.assertIsNotNone(AuthLoginService.reserve_login_attempt(request, 'another-user'))

    @patch('board.services.auth_login_service.time', return_value=6000)
    def test_account_limit_is_shared_by_ips(self, _clock):
        for index in range(AuthLoginService.ACCOUNT_ATTEMPT_LIMIT):
            request = self.factory.post('/v1/login', REMOTE_ADDR=f'203.0.113.{index + 1}')
            self.assertIsNotNone(AuthLoginService.reserve_login_attempt(request, 'account'))

        request = self.factory.post('/v1/login', REMOTE_ADDR='198.51.100.10')
        self.assertIsNone(AuthLoginService.reserve_login_attempt(request, 'ACCOUNT'))
        self.assertIsNotNone(AuthLoginService.reserve_login_attempt(request, 'another-account'))

    def test_success_releases_only_its_own_reservation(self):
        request = self.factory.post('/v1/login', REMOTE_ADDR='198.51.100.10')
        AuthLoginService.reserve_login_attempt(request, 'account')
        successful_attempt = AuthLoginService.reserve_login_attempt(request, 'account')
        successful_attempt.release()

        for _ in range(AuthLoginService.LOGIN_ATTEMPT_LIMIT - 1):
            self.assertIsNotNone(AuthLoginService.reserve_login_attempt(request, 'account'))
        self.assertIsNone(AuthLoginService.reserve_login_attempt(request, 'account'))
