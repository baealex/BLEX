from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from board.models import Profile, User, WebhookSubscription


class WebhookSubscriptionModelMethodsTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='webhook-transition-user',
            password='test',
            email='webhook-transition-user@test.com',
        )
        self.profile = Profile.objects.create(user=self.user)
        self.channel = WebhookSubscription.objects.create(
            author=self.profile,
            webhook_url='https://discord.com/api/webhooks/transition/test',
        )

    def test_record_success_resets_failures_and_sets_last_success_date(self):
        now = timezone.now()
        self.channel.failure_count = 2
        self.channel.save(update_fields=['failure_count'])

        with patch('board.models.timezone.now', return_value=now):
            self.channel.record_success()

        self.channel.refresh_from_db()
        self.assertEqual(self.channel.failure_count, 0)
        self.assertEqual(self.channel.last_success_date, now)
        self.assertTrue(self.channel.is_active)

    def test_record_success_does_not_reactivate_inactive_channel(self):
        self.channel.failure_count = WebhookSubscription.MAX_FAILURES
        self.channel.is_active = False
        self.channel.save(update_fields=['failure_count', 'is_active'])

        self.channel.record_success()

        self.channel.refresh_from_db()
        self.assertEqual(self.channel.failure_count, 0)
        self.assertFalse(self.channel.is_active)
        self.assertIsNotNone(self.channel.last_success_date)

    def test_record_failure_increments_failure_count_without_deactivation_before_limit(self):
        self.channel.failure_count = WebhookSubscription.MAX_FAILURES - 2
        self.channel.save(update_fields=['failure_count'])

        self.channel.record_failure()

        self.channel.refresh_from_db()
        self.assertEqual(
            self.channel.failure_count,
            WebhookSubscription.MAX_FAILURES - 1,
        )
        self.assertTrue(self.channel.is_active)

    def test_record_failure_deactivates_at_max_failures(self):
        self.channel.failure_count = WebhookSubscription.MAX_FAILURES - 1
        self.channel.save(update_fields=['failure_count'])

        self.channel.record_failure()

        self.channel.refresh_from_db()
        self.assertEqual(self.channel.failure_count, WebhookSubscription.MAX_FAILURES)
        self.assertFalse(self.channel.is_active)

    def test_record_failure_preserves_last_success_date(self):
        last_success_date = timezone.now()
        self.channel.last_success_date = last_success_date
        self.channel.save(update_fields=['last_success_date'])

        self.channel.record_failure()

        self.channel.refresh_from_db()
        self.assertEqual(self.channel.failure_count, 1)
        self.assertEqual(self.channel.last_success_date, last_success_date)
