from __future__ import annotations

from urllib.parse import urlencode, urlsplit

from django.conf import settings
from django.http import HttpRequest


LOCAL_SITE_HOSTS = {'localhost', '127.0.0.1', '0.0.0.0', '::1'}
TEST_REQUEST_HOSTS = {'testserver'}


class SiteUrlService:
    """Build public absolute URLs from one origin policy."""

    @staticmethod
    def configured_origin() -> str:
        return (settings.SITE_URL or '').strip().rstrip('/')

    @staticmethod
    def public_origin(request: HttpRequest) -> str:
        configured_origin = SiteUrlService.configured_origin()
        if configured_origin:
            parsed_origin = urlsplit(configured_origin)
            configured_host = (parsed_origin.hostname or '').lower()
            request_host = (urlsplit(f'//{request.get_host()}').hostname or '').lower()
            if (
                configured_host in LOCAL_SITE_HOSTS
                and request_host
                and request_host not in LOCAL_SITE_HOSTS
                and request_host not in TEST_REQUEST_HOSTS
            ):
                return request.build_absolute_uri('/').rstrip('/')

            return configured_origin

        return request.build_absolute_uri('/').rstrip('/')

    @staticmethod
    def normalize_path(path: str) -> str:
        return path if path.startswith('/') else f'/{path}'

    @staticmethod
    def absolute_url(request: HttpRequest, path: str) -> str:
        if path.startswith(('http://', 'https://')):
            return path

        normalized_path = SiteUrlService.normalize_path(path)
        return f'{SiteUrlService.public_origin(request)}{normalized_path}'

    @staticmethod
    def configured_absolute_url(path: str) -> str:
        if path.startswith(('http://', 'https://')):
            return path

        normalized_path = SiteUrlService.normalize_path(path)
        configured_origin = SiteUrlService.configured_origin()
        if not configured_origin:
            return normalized_path

        return f'{configured_origin}{normalized_path}'

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
