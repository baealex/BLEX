from unittest.mock import patch

from django.test import SimpleTestCase

from board.services.webhook_url_service import WebhookUrlService


class WebhookUrlServiceTestCase(SimpleTestCase):
    def test_rejects_private_ip_literals(self):
        for url in (
            'http://127.0.0.1:8000/hook',
            'http://10.0.0.1/hook',
            'http://[::1]/hook',
            'http://169.254.169.254/latest/meta-data',
        ):
            with self.subTest(url=url):
                self.assertFalse(WebhookUrlService.is_safe_url(url))

    def test_rejects_credentials_fragments_and_local_hostnames(self):
        for url in (
            'https://user:password@example.com/hook',
            'https://example.com/hook#fragment',
            'https://service.local/hook',
            'https://localhost/hook',
        ):
            with self.subTest(url=url):
                self.assertFalse(WebhookUrlService.is_safe_url(url))

    @patch(
        'board.services.webhook_url_service.socket.getaddrinfo',
        return_value=[(
            2,
            1,
            6,
            '',
            ('93.184.216.34', 443),
        )],
    )
    def test_resolves_and_allows_public_hostname(self, mock_getaddrinfo):
        self.assertTrue(
            WebhookUrlService.is_safe_url(
                'https://hooks.example.com/webhook',
                resolve_host=True,
            )
        )
        mock_getaddrinfo.assert_called_once()

    @patch(
        'board.services.webhook_url_service.socket.getaddrinfo',
        return_value=[(
            2,
            1,
            6,
            '',
            ('10.0.0.5', 443),
        )],
    )
    def test_rejects_hostname_resolving_to_private_address(self, mock_getaddrinfo):
        self.assertFalse(
            WebhookUrlService.is_safe_url(
                'https://hooks.example.com/webhook',
                resolve_host=True,
            )
        )
        mock_getaddrinfo.assert_called_once()
