from django.test import RequestFactory, TestCase

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

        with self.assertNumQueries(1):
            context = oauth_settings(RequestFactory().get('/'))

        self.assertEqual(context, {
            'GOOGLE_OAUTH_CLIENT_ID': 'google-client',
            'GITHUB_OAUTH_CLIENT_ID': '',
        })

    def test_site_setting_is_reused_for_the_rest_of_the_request(self):
        SiteSetting.get_instance()
        request = RequestFactory().get('/')

        with self.assertNumQueries(1):
            context = site_settings(request)
            seo_enabled = AgentContentService.is_seo_enabled(request)

        self.assertEqual(seo_enabled, context['site_setting'].seo_enabled)
