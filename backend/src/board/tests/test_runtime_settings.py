import os
import subprocess
import sys
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from board.checks import check_public_site_url
from main import settings as runtime_settings


class RuntimeSettingsTestCase(SimpleTestCase):
    def test_get_env_list_trims_empty_values(self):
        """쉼표 환경변수는 공백과 빈 값을 제거한다."""
        with patch.dict(os.environ, {'BLEX_TEST_LIST': 'alpha, beta,, gamma '}):
            self.assertEqual(
                runtime_settings.get_env_list('BLEX_TEST_LIST'),
                ['alpha', 'beta', 'gamma'],
            )

    def test_get_env_optional_returns_none_for_empty_values(self):
        """빈 문자열 환경변수는 미설정처럼 처리한다."""
        for value in ['', '   ']:
            with patch.dict(os.environ, {'BLEX_TEST_OPTIONAL': value}):
                self.assertIsNone(
                    runtime_settings.get_env_optional('BLEX_TEST_OPTIONAL'),
                )

    def test_session_cookie_domain_ignores_loopback_hosts(self):
        """로컬 개발 호스트는 host-only 세션 쿠키를 사용한다."""
        for value in ['localhost', '.localhost', '127.0.0.1', '0.0.0.0', '::1']:
            with patch.dict(os.environ, {'BLEX_TEST_COOKIE_DOMAIN': value}):
                self.assertIsNone(
                    runtime_settings.get_session_cookie_domain('BLEX_TEST_COOKIE_DOMAIN'),
                )

    def test_session_cookie_domain_keeps_real_domain(self):
        """실제 도메인은 세션 쿠키 도메인으로 유지한다."""
        with patch.dict(os.environ, {'BLEX_TEST_COOKIE_DOMAIN': '.example.com'}):
            self.assertEqual(
                runtime_settings.get_session_cookie_domain('BLEX_TEST_COOKIE_DOMAIN'),
                '.example.com',
            )

    def test_get_env_http_origin_accepts_http_origin(self):
        """HTTP(S) origin 환경변수는 CORS origin으로 사용할 수 있게 정리한다."""
        with patch.dict(os.environ, {'BLEX_TEST_ORIGIN': 'https://blog.example.com/'}):
            self.assertEqual(
                runtime_settings.get_env_http_origin('BLEX_TEST_ORIGIN'),
                'https://blog.example.com',
            )

    def test_get_env_http_origin_ignores_invalid_values(self):
        """origin이 아닌 값은 CORS 설정에 넣지 않는다."""
        for value in [
            '',
            'blog.example.com',
            '/relative',
            'https://blog.example.com/path',
            'https://blog.example.com?query=1',
            'https://blog.example.com#fragment',
            'https://user:pass@blog.example.com',
        ]:
            with patch.dict(os.environ, {'BLEX_TEST_ORIGIN': value}):
                self.assertIsNone(
                    runtime_settings.get_env_http_origin('BLEX_TEST_ORIGIN'),
                )

    def test_runtime_cors_origins_ignore_missing_site_url(self):
        """SITE_URL 누락은 CORS 오류가 아니라 BLEX 공개 URL 경고로 드러난다."""
        env = {
            **os.environ,
            'SECRET_KEY': 'test-secret',
            'CIPHER_KEY': 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
            'DEBUG': 'FALSE',
            'RESOURCE_URL': '',
            'SITE_URL': '',
            'TZ': 'Asia/Seoul',
        }

        result = subprocess.run(
            [
                sys.executable,
                '-c',
                'from main import settings; print(settings.CORS_ALLOWED_ORIGINS)',
            ],
            cwd=runtime_settings.BASE_DIR,
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )

        self.assertEqual(result.stdout.strip(), '[]')

    def test_runtime_resource_url_defaults_to_local_resources_path(self):
        """RESOURCE_URL 미설정 배포도 기본 /resources/ 경로로 설정을 로드한다."""
        env = {
            **os.environ,
            'SECRET_KEY': 'test-secret',
            'CIPHER_KEY': 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
            'DEBUG': 'FALSE',
            'SITE_URL': 'https://blex.example',
            'TZ': 'Asia/Seoul',
        }
        env.pop('RESOURCE_URL', None)

        result = subprocess.run(
            [
                sys.executable,
                '-c',
                'from main import settings; print(settings.RESOURCE_URL)',
            ],
            cwd=runtime_settings.BASE_DIR,
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )

        self.assertEqual(result.stdout.strip(), '/resources/')

    def test_runtime_secure_cookies_default_to_enabled_outside_debug(self):
        """운영 모드에서는 외부 HTTPS 프록시 뒤에서 쓸 Secure 쿠키를 기본으로 발급한다."""
        env = {
            **os.environ,
            'SECRET_KEY': 'test-secret',
            'CIPHER_KEY': 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
            'DEBUG': 'FALSE',
            'RESOURCE_URL': '',
            'SITE_URL': 'https://blex.example',
            'TZ': 'Asia/Seoul',
        }

        result = subprocess.run(
            [
                sys.executable,
                '-c',
                (
                    'from main import settings; '
                    'print(settings.SESSION_COOKIE_SECURE, settings.CSRF_COOKIE_SECURE)'
                ),
            ],
            cwd=runtime_settings.BASE_DIR,
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )

        self.assertEqual(result.stdout.strip(), 'True True')

    def test_runtime_session_cookie_domain_ignores_localhost_env(self):
        """SESSION_COOKIE_DOMAIN=localhost도 실제 설정에서는 host-only 쿠키로 처리한다."""
        env = {
            **os.environ,
            'SECRET_KEY': 'test-secret',
            'CIPHER_KEY': 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
            'DEBUG': 'TRUE',
            'RESOURCE_URL': '',
            'SITE_URL': 'http://localhost:8000',
            'SESSION_COOKIE_DOMAIN': 'localhost',
            'TZ': 'Asia/Seoul',
        }

        result = subprocess.run(
            [
                sys.executable,
                '-c',
                'from main import settings; print(repr(settings.SESSION_COOKIE_DOMAIN))',
            ],
            cwd=runtime_settings.BASE_DIR,
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )

        self.assertEqual(result.stdout.strip(), 'None')

    def test_allowed_hosts_default_keeps_existing_wildcard(self):
        """ALLOWED_HOSTS 미설정 배포는 기존처럼 와일드카드 호스트를 유지한다."""
        env = {
            **os.environ,
            'SECRET_KEY': 'test-secret',
            'CIPHER_KEY': 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
            'DEBUG': 'FALSE',
            'RESOURCE_URL': '',
            'SITE_URL': 'https://blex.example',
            'TZ': 'Asia/Seoul',
        }
        env.pop('ALLOWED_HOSTS', None)

        result = subprocess.run(
            [
                sys.executable,
                '-c',
                'from main import settings; print(settings.ALLOWED_HOSTS)',
            ],
            cwd=runtime_settings.BASE_DIR,
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )

        self.assertEqual(result.stdout.strip(), "['*']")

    def test_allowed_hosts_reads_comma_separated_env(self):
        """ALLOWED_HOSTS를 설정하면 쉼표 목록을 사용한다."""
        with patch.dict(os.environ, {'BLEX_TEST_ALLOWED_HOSTS': 'blog.example.com, www.example.com'}):
            self.assertEqual(
                runtime_settings.get_env_list('BLEX_TEST_ALLOWED_HOSTS', ['*']),
                ['blog.example.com', 'www.example.com'],
            )

    @override_settings(DEBUG=True, TESTING=False, SITE_URL='http://localhost:8000')
    def test_public_site_url_check_skips_debug_mode(self):
        """개발 모드에서는 로컬 SITE_URL을 허용한다."""
        self.assertEqual(check_public_site_url(None), [])

    @override_settings(DEBUG=False, TESTING=False, SITE_URL='')
    def test_public_site_url_check_warns_when_missing_in_production(self):
        """운영 모드에서 SITE_URL이 없으면 공개 URL 정책 경고를 낸다."""
        warnings = check_public_site_url(None)

        self.assertEqual([warning.id for warning in warnings], ['board.W001'])

    @override_settings(DEBUG=False, TESTING=False, SITE_URL='https://blex.example/path')
    def test_public_site_url_check_warns_when_site_url_is_not_origin(self):
        """운영 모드에서 SITE_URL은 path 없는 origin이어야 한다."""
        warnings = check_public_site_url(None)

        self.assertEqual([warning.id for warning in warnings], ['board.W002'])

    @override_settings(DEBUG=False, TESTING=False, SITE_URL='http://localhost:8000')
    def test_public_site_url_check_warns_for_local_origin_in_production(self):
        """운영 모드에서 로컬 SITE_URL은 공개 표면 경고를 낸다."""
        warnings = check_public_site_url(None)

        self.assertEqual([warning.id for warning in warnings], ['board.W003'])

    @override_settings(DEBUG=False, TESTING=False, SITE_URL='http://blex.example')
    def test_public_site_url_check_warns_for_http_public_origin_in_production(self):
        """운영 모드에서 공개 SITE_URL은 HTTPS를 써야 한다."""
        warnings = check_public_site_url(None)

        self.assertEqual([warning.id for warning in warnings], ['board.W004'])

    @override_settings(DEBUG=False, TESTING=False, SITE_URL='https://blex.example')
    def test_public_site_url_check_accepts_public_origin(self):
        """운영 모드의 실제 공개 origin은 경고하지 않는다."""
        self.assertEqual(check_public_site_url(None), [])
