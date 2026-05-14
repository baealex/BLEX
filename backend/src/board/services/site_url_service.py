from __future__ import annotations

from urllib.parse import urlencode

from django.conf import settings
from django.http import HttpRequest


class SiteUrlService:
    """Build public absolute URLs from one origin policy."""

    @staticmethod
    def public_origin(request: HttpRequest) -> str:
        configured_origin = (settings.SITE_URL or '').strip().rstrip('/')
        if configured_origin:
            return configured_origin

        return request.build_absolute_uri('/').rstrip('/')

    @staticmethod
    def absolute_url(request: HttpRequest, path: str) -> str:
        if path.startswith(('http://', 'https://')):
            return path

        normalized_path = path if path.startswith('/') else f'/{path}'
        return f'{SiteUrlService.public_origin(request)}{normalized_path}'

    @staticmethod
    def absolute_url_with_query(
        request: HttpRequest,
        path: str,
        query_items: list[tuple[str, str]],
    ) -> str:
        url = SiteUrlService.absolute_url(request, path)
        if not query_items:
            return url

        return f'{url}?{urlencode(query_items)}'
