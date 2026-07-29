"""Validation helpers for outbound webhook URLs."""

import ipaddress
import socket
from urllib.parse import urlsplit


class WebhookUrlService:
    """Reject webhook destinations that can reach local network resources."""

    ALLOWED_SCHEMES = {'http', 'https'}
    BLOCKED_HOSTNAMES = {
        'instance-data.ec2.internal',
        'localhost',
        'metadata.google.internal',
    }

    @classmethod
    def is_safe_url(cls, url: str, *, resolve_host: bool = False) -> bool:
        if not isinstance(url, str) or not url or len(url) > 500:
            return False
        if any(character in url for character in '\x00\r\n\t\\'):
            return False

        try:
            parsed = urlsplit(url)
            hostname = parsed.hostname
            port = parsed.port
        except ValueError:
            return False

        scheme = parsed.scheme.lower()
        hostname = (hostname or '').rstrip('.').lower()
        if scheme not in cls.ALLOWED_SCHEMES or not hostname:
            return False
        if parsed.username or parsed.password or parsed.fragment:
            return False
        if port is not None and not (1 <= port <= 65535):
            return False
        if hostname in cls.BLOCKED_HOSTNAMES or hostname.endswith('.localhost'):
            return False
        if hostname.endswith('.local'):
            return False

        try:
            address = ipaddress.ip_address(hostname)
        except ValueError:
            address = None

        if address is not None:
            return address.is_global

        if not resolve_host:
            return True

        try:
            resolved_addresses = {
                result[4][0]
                for result in socket.getaddrinfo(
                    hostname,
                    port or (443 if scheme == 'https' else 80),
                    type=socket.SOCK_STREAM,
                )
            }
        except (OSError, socket.gaierror):
            return False

        if not resolved_addresses:
            return False

        return all(cls._is_global_address(address) for address in resolved_addresses)

    @staticmethod
    def _is_global_address(address: str) -> bool:
        try:
            return ipaddress.ip_address(address).is_global
        except ValueError:
            return False
