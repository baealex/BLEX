from urllib.parse import urlsplit

from django.conf import settings
from django.core.checks import Tags, Warning, register

from board.services.site_url_service import LOCAL_SITE_HOSTS, SiteUrlService


@register(Tags.security)
def check_public_site_url(app_configs, **kwargs):
    if settings.DEBUG or getattr(settings, 'TESTING', False):
        return []

    configured_origin = SiteUrlService.configured_origin()
    if not configured_origin:
        return [
            Warning(
                'SITE_URL is not configured. Public links in notifications, '
                'webhooks, and discovery metadata may be relative.',
                hint=(
                    'Set SITE_URL to the public HTTPS origin, for example '
                    'https://blog.example.com.'
                ),
                id='board.W001',
            )
        ]

    parsed_origin = urlsplit(configured_origin)
    if parsed_origin.scheme not in {'http', 'https'} or not parsed_origin.netloc:
        return [
            Warning(
                'SITE_URL is not an absolute HTTP(S) origin.',
                hint=(
                    'Set SITE_URL to the public HTTPS origin, for example '
                    'https://blog.example.com.'
                ),
                id='board.W002',
            )
        ]

    if (parsed_origin.hostname or '').lower() in LOCAL_SITE_HOSTS:
        return [
            Warning(
                'SITE_URL points to a local host in production mode.',
                hint=(
                    'Set SITE_URL to the public HTTPS origin before exposing '
                    'this deployment.'
                ),
                id='board.W003',
            )
        ]

    return []
