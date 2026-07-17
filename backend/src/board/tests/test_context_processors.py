from django.contrib.auth.models import User
from django.db import connection
from django.test import RequestFactory, TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import resolve, reverse

from board.context_processors import oauth_settings, site_settings
from board.models import SiteSetting, SocialAuthProvider
from board.services.agent_content_service import AgentContentService


class OAuthSettingsContextProcessorTestCase(TestCase):
    def test_loads_enabled_provider_client_ids_in_one_query(self):
        SocialAuthProvider.objects.update_or_create(
            key='google',
            defaults={
                'client_id': 'google-client',
                'is_enabled': True,
            },
        )
        SocialAuthProvider.objects.update_or_create(
            key='github',
            defaults={
                'client_id': 'github-client',
                'is_enabled': False,
            },
        )

        with CaptureQueriesContext(connection) as queries:
            context = oauth_settings(RequestFactory().get('/'))

        self.assertEqual(len(queries), 1)
        provider_query = queries.captured_queries[0]['sql'].lower()
        self.assertNotIn('client_secret', provider_query)
        self.assertEqual(context, {
            'GOOGLE_OAUTH_CLIENT_ID': 'google-client',
            'GITHUB_OAUTH_CLIENT_ID': '',
        })

    def test_skips_oauth_settings_for_admin_templates(self):
        path = reverse('admin:index')
        request = RequestFactory().get(path)
        request.resolver_match = resolve(path)

        with self.assertNumQueries(0):
            context = oauth_settings(request)

        self.assertEqual(context, {})

    def test_admin_index_does_not_query_oauth_providers(self):
        admin_user = User.objects.create_superuser(
            username='oauth-settings-admin',
            email='oauth-settings-admin@example.com',
            password='test',
        )
        self.client.force_login(admin_user)

        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(reverse('admin:index'))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(any(
            'board_socialauthprovider' in query['sql'].lower()
            for query in queries.captured_queries
        ))

    def test_site_setting_is_reused_for_the_rest_of_the_request(self):
        SiteSetting.get_instance()
        request = RequestFactory().get('/')

        with self.assertNumQueries(1):
            context = site_settings(request)
            seo_enabled = AgentContentService.is_seo_enabled(request)

        self.assertEqual(seo_enabled, context['site_setting'].seo_enabled)
