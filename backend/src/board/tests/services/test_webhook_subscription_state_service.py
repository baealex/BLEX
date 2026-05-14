from django.test import TestCase

from board.models import Profile, User, WebhookSubscription
from board.services.webhook_subscription_state_service import WebhookSubscriptionStateService


class WebhookSubscriptionStateServiceTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='webhook-state-service-user',
            password='test',
            email='webhook-state-service-user@test.com',
        )
        self.profile = Profile.objects.create(user=self.user)
        self.channel = WebhookSubscription.objects.create(
            author=self.profile,
            webhook_url='https://discord.com/api/webhooks/state-service/test',
        )

    def test_record_success_resets_failures_without_reactivating_channel(self):
        self.channel.failure_count = WebhookSubscription.MAX_FAILURES
        self.channel.is_active = False
        self.channel.save(update_fields=['failure_count', 'is_active'])

        WebhookSubscriptionStateService.record_success(self.channel)

        self.channel.refresh_from_db()
        self.assertEqual(self.channel.failure_count, 0)
        self.assertFalse(self.channel.is_active)
        self.assertIsNotNone(self.channel.last_success_date)

    def test_record_failure_increments_failure_count_before_limit(self):
        WebhookSubscriptionStateService.record_failure(self.channel)

        self.channel.refresh_from_db()
        self.assertEqual(self.channel.failure_count, 1)
        self.assertTrue(self.channel.is_active)

    def test_record_failure_deactivates_at_max_failures(self):
        self.channel.failure_count = WebhookSubscription.MAX_FAILURES - 1
        self.channel.save(update_fields=['failure_count'])

        WebhookSubscriptionStateService.record_failure(self.channel)

        self.channel.refresh_from_db()
        self.assertEqual(self.channel.failure_count, WebhookSubscription.MAX_FAILURES)
        self.assertFalse(self.channel.is_active)
