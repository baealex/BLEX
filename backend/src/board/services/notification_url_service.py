from __future__ import annotations

import ipaddress
import re
from urllib.parse import urlsplit

from django.core.exceptions import ValidationError


class NotificationUrlService:
    """Keep notification destinations safe for browser navigation."""

    ALLOWED_SCHEMES = frozenset({'http', 'https'})
    BROWSER_HOSTNAME_PATTERN = re.compile(r'^[A-Za-z0-9._-]+$')

    @staticmethod
    def validate(url: str) -> str:
        """Allow relative paths and HTTP(S) URLs, but reject executable schemes."""
        if not isinstance(url, str):
            raise ValidationError('올바른 알림 URL을 입력해주세요.')

        normalized_url = url.strip()
        if any(ord(character) < 32 for character in normalized_url):
            raise ValidationError('알림 URL에는 제어 문자를 사용할 수 없습니다.')
        if '\\' in normalized_url:
            raise ValidationError('알림 URL에는 역슬래시를 사용할 수 없습니다.')

        try:
            parsed_url = urlsplit(normalized_url)
        except ValueError as error:
            raise ValidationError('올바른 알림 URL을 입력해주세요.') from error
        scheme = parsed_url.scheme.lower()
        if scheme and scheme not in NotificationUrlService.ALLOWED_SCHEMES:
            raise ValidationError(
                '알림 URL은 상대 경로 또는 HTTP(S) URL이어야 합니다.',
            )

        if scheme:
            NotificationUrlService._validate_http_url(normalized_url)
        elif normalized_url.startswith('//'):
            NotificationUrlService._validate_http_url(
                f'https:{normalized_url}',
            )

        return normalized_url

    @staticmethod
    def _validate_http_url(url: str) -> None:
        try:
            parsed_url = urlsplit(url)
            hostname = parsed_url.hostname
            parsed_url.port
        except ValueError as error:
            raise ValidationError('올바른 알림 URL을 입력해주세요.') from error

        if not hostname:
            raise ValidationError('올바른 알림 URL을 입력해주세요.')

        try:
            ipaddress.ip_address(hostname)
            return
        except ValueError:
            pass

        try:
            ascii_hostname = hostname.encode('idna').decode('ascii')
        except UnicodeError as error:
            raise ValidationError('올바른 알림 URL을 입력해주세요.') from error

        if (
            not NotificationUrlService.BROWSER_HOSTNAME_PATTERN.fullmatch(
                ascii_hostname,
            )
            or ascii_hostname.replace('.', '').isdigit()
        ):
            raise ValidationError('올바른 알림 URL을 입력해주세요.')
