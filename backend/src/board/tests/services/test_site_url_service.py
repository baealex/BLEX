from django.test import RequestFactory, SimpleTestCase, override_settings

from board.services.site_url_service import SiteUrlService


class SiteUrlServiceTestCase(SimpleTestCase):
    def setUp(self):
        self.request = RequestFactory().get('/', HTTP_HOST='testserver')

    @override_settings(SITE_URL='https://blex.example/')
    def test_public_origin_uses_configured_site_url_without_trailing_slash(self):
        self.assertEqual(SiteUrlService.public_origin(self.request), 'https://blex.example')

    @override_settings(SITE_URL='https://blex.example/')
    def test_configured_origin_uses_site_url_without_trailing_slash(self):
        self.assertEqual(SiteUrlService.configured_origin(), 'https://blex.example')

    @override_settings(SITE_URL='')
    def test_public_origin_falls_back_to_request_origin(self):
        self.assertEqual(SiteUrlService.public_origin(self.request), 'http://testserver')

    @override_settings(SITE_URL='http://localhost:8000', ALLOWED_HOSTS=['*'])
    def test_public_origin_uses_request_origin_for_lan_request(self):
        request = RequestFactory().get('/', HTTP_HOST='192.168.219.106:8000')

        self.assertEqual(SiteUrlService.public_origin(request), 'http://192.168.219.106:8000')

    @override_settings(SITE_URL='http://localhost:8000', ALLOWED_HOSTS=['*'])
    def test_public_origin_keeps_localhost_for_local_request(self):
        request = RequestFactory().get('/', HTTP_HOST='localhost:8000')

        self.assertEqual(SiteUrlService.public_origin(request), 'http://localhost:8000')

    @override_settings(SITE_URL='https://blex.example')
    def test_absolute_url_normalizes_relative_paths(self):
        self.assertEqual(SiteUrlService.absolute_url(self.request, 'static/page'), 'https://blex.example/static/page')
        self.assertEqual(SiteUrlService.absolute_url(self.request, '/static/page'), 'https://blex.example/static/page')

    @override_settings(SITE_URL='https://blex.example')
    def test_configured_absolute_url_uses_site_url(self):
        self.assertEqual(
            SiteUrlService.configured_absolute_url('settings'),
            'https://blex.example/settings',
        )

    @override_settings(SITE_URL='')
    def test_configured_absolute_url_returns_path_without_site_url(self):
        self.assertEqual(SiteUrlService.configured_absolute_url('settings'), '/settings')

    @override_settings(SITE_URL='https://blex.example')
    def test_absolute_url_keeps_absolute_input(self):
        self.assertEqual(
            SiteUrlService.absolute_url(self.request, 'https://cdn.example/file.png'),
            'https://cdn.example/file.png',
        )
        self.assertEqual(
            SiteUrlService.configured_absolute_url('https://cdn.example/file.png'),
            'https://cdn.example/file.png',
        )

    @override_settings(SITE_URL='https://blex.example')
    def test_absolute_url_with_query_omits_empty_query_and_encodes_items(self):
        self.assertEqual(
            SiteUrlService.absolute_url_with_query(self.request, '/path', []),
            'https://blex.example/path',
        )
        self.assertEqual(
            SiteUrlService.absolute_url_with_query(self.request, '/path', [('sort', 'asc'), ('page', '2')]),
            'https://blex.example/path?sort=asc&page=2',
        )
