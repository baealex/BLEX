import os
import subprocess
import sys
from unittest.mock import patch

from django.test import SimpleTestCase

from main import settings as runtime_settings


class RuntimeSettingsTestCase(SimpleTestCase):
    def test_get_env_list_trims_empty_values(self):
        """쉼표 환경변수는 공백과 빈 값을 제거한다."""
        with patch.dict(os.environ, {'BLEX_TEST_LIST': 'alpha, beta,, gamma '}):
            self.assertEqual(
                runtime_settings.get_env_list('BLEX_TEST_LIST'),
                ['alpha', 'beta', 'gamma'],
            )

    def test_get_env_bool_accepts_common_true_values(self):
        """boolean 환경변수는 TRUE 계열 값을 참으로 처리한다."""
        for value in ['1', 'TRUE', 'true', 'YES', 'on']:
            with patch.dict(os.environ, {'BLEX_TEST_BOOL': value}):
                self.assertTrue(runtime_settings.get_env_bool('BLEX_TEST_BOOL'))

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
