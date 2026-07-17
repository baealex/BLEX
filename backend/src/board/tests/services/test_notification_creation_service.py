from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase

from board.models import Notify
from board.modules.notify import create_notify
from board.services.bulk_notification_delivery_service import (
    BulkNotificationDeliveryService,
)
from board.services.notification_creation_service import (
    NotificationCreationService,
)
from board.services.notification_url_service import NotificationUrlService


class NotificationCreationServiceTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='notification-owner',
            password='test',
        )

    def test_legacy_create_notify_creates_and_dispatches_only_once(self):
        with patch.object(Notify, 'send_notify') as send_notify:
            first_result = create_notify(
                self.user,
                '/notifications/once',
                'Only once',
            )
            second_result = create_notify(
                self.user,
                '/notifications/once',
                'Only once',
            )

        self.assertIsNone(first_result)
        self.assertIsNone(second_result)
        self.assertEqual(Notify.objects.count(), 1)
        send_notify.assert_called_once()

    def test_delivery_failure_keeps_the_created_notification(self):
        with patch.object(
            Notify,
            'send_notify',
            side_effect=RuntimeError('external-secret-value'),
        ):
            with self.assertRaisesRegex(
                RuntimeError,
                'external-secret-value',
            ):
                NotificationCreationService.create(
                    self.user,
                    '/notifications/failure',
                    'Persist before delivery',
                )

        self.assertTrue(
            Notify.objects.filter(
                user=self.user,
                url='/notifications/failure',
                content='Persist before delivery',
            ).exists(),
        )

    def test_create_rejects_executable_notification_url(self):
        with self.assertRaises(ValidationError):
            NotificationCreationService.create(
                self.user,
                'javascript:unsafe',
                'Unsafe destination',
            )

        self.assertFalse(
            Notify.objects.filter(content='Unsafe destination').exists(),
        )

    def test_create_rejects_incomplete_http_notification_urls(self):
        for url in (
            'http://',
            'https://',
            '//',
            r'\\javascript:unsafe',
            r'\\[invalid',
        ):
            with self.subTest(url=url):
                with self.assertRaises(ValidationError):
                    NotificationCreationService.create(
                        self.user,
                        url,
                        'Incomplete destination',
                    )

        self.assertFalse(
            Notify.objects.filter(content='Incomplete destination').exists(),
        )

    def test_url_validator_keeps_single_label_http_hosts(self):
        for url in (
            'http://blex/welcome',
            'https://intranet/path',
            '//internal-service/notice',
        ):
            with self.subTest(url=url):
                self.assertEqual(NotificationUrlService.validate(url), url)

    def test_bulk_delivery_isolates_duplicate_missing_and_failed_users(self):
        duplicate_user = User.objects.create_user(
            username='notification-duplicate',
        )
        failed_user = User.objects.create_user(
            username='notification-failure',
        )
        missing_user_id = failed_user.pk + 1000

        with patch.object(
            NotificationCreationService,
            'create',
            side_effect=[
                (object(), True),
                (object(), False),
                RuntimeError('sensitive-provider-error'),
            ],
        ) as create_notification:
            with self.assertLogs('board.notification', level='INFO') as logs:
                stats = BulkNotificationDeliveryService.deliver(
                    [
                        self.user.pk,
                        duplicate_user.pk,
                        failed_user.pk,
                        missing_user_id,
                    ],
                    '/bulk',
                    'Bulk content must not be logged',
                )

        self.assertEqual(create_notification.call_count, 3)
        self.assertEqual(stats.requested_count, 4)
        self.assertEqual(stats.success_count, 1)
        self.assertEqual(stats.duplicate_count, 1)
        self.assertEqual(stats.failure_count, 2)
        log_output = ' '.join(logs.output)
        self.assertNotIn('sensitive-provider-error', log_output)
        self.assertNotIn('Bulk content must not be logged', log_output)
        self.assertNotIn('/bulk', log_output)
