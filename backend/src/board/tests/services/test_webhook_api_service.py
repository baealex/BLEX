from django.test import RequestFactory, TestCase
from django.contrib.auth.models import AnonymousUser, User

from board.models import Profile, WebhookSubscription, SiteContentScope
from board.services.webhook_api_service import WebhookApiService


class WebhookApiServiceTestCase(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(username='webhook-user', password='test')
        self.profile = Profile.objects.create(user=self.user)

    def test_get_authenticated_profile_rejects_anonymous_user(self):
        request = self.factory.get('/v1/webhook/channels')
        request.user = AnonymousUser()

        profile, error = WebhookApiService.get_authenticated_profile(request)

        self.assertIsNone(profile)
        self.assertIsNotNone(error)

    def test_ensure_staff_rejects_non_staff_user(self):
        request = self.factory.get('/v1/webhook/global-channels')
        request.user = self.user

        self.assertIsNotNone(WebhookApiService.ensure_staff(request))

    def test_serialize_channels_preserves_channel_shape(self):
        WebhookSubscription.objects.create(
            scope=SiteContentScope.USER,
            author=self.profile,
            webhook_url='https://discord.com/api/webhooks/service/test',
            name='Service Channel',
        )

        payload = WebhookApiService.serialize_channels(
            WebhookApiService.get_user_channels(self.profile)
        )

        self.assertEqual(len(payload['channels']), 1)
        channel = payload['channels'][0]
        self.assertEqual(channel['name'], 'Service Channel')
        self.assertIn('webhook_url', channel)
        self.assertIn('is_active', channel)
        self.assertIn('failure_count', channel)
        self.assertIn('created_date', channel)

    def test_get_global_channels_excludes_user_channels(self):
        WebhookSubscription.objects.create(
            scope=SiteContentScope.USER,
            author=self.profile,
            webhook_url='https://discord.com/api/webhooks/user/test',
        )
        global_channel = WebhookSubscription.objects.create(
            scope=SiteContentScope.GLOBAL,
            author=None,
            webhook_url='https://discord.com/api/webhooks/global/test',
        )

        self.assertEqual(
            list(WebhookApiService.get_global_channels()),
            [global_channel],
        )
