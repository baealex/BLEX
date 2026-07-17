from unittest.mock import patch

from django.contrib.admin.models import ADDITION, LogEntry
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
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

    def test_bulk_enqueue_returns_task_id_and_forwards_audit_log(self):
        with patch(
            'board.services.bulk_notification_delivery_service.'
            'SubTaskProcessor.submit',
            return_value='background-task-1',
        ) as submit:
            task_id = BulkNotificationDeliveryService.enqueue(
                [self.user.pk],
                '/bulk',
                'Bulk content',
                audit_log_id=123,
            )

        self.assertEqual(task_id, 'background-task-1')
        submit.assert_called_once_with(
            BulkNotificationDeliveryService.deliver,
            [self.user.pk],
            '/bulk',
            'Bulk content',
            audit_log_id=123,
        )

    def create_bulk_audit_log(self) -> LogEntry:
        return LogEntry.objects.create(
            user=self.user,
            content_type=ContentType.objects.get_for_model(Notify),
            object_id=None,
            object_repr='전체 알림 발송 (2명)',
            action_flag=ADDITION,
            change_message='Admin 전체 알림 발송 예약: 대상 2명',
        )

    def test_bulk_delivery_records_redacted_audit_outcome(self):
        duplicate_user = User.objects.create_user(
            username='notification-audit-duplicate',
        )
        audit_log = self.create_bulk_audit_log()

        with patch.object(
            NotificationCreationService,
            'create',
            side_effect=[(object(), True), (object(), False)],
        ):
            BulkNotificationDeliveryService.deliver(
                [self.user.pk, duplicate_user.pk],
                '/bulk-private',
                'Bulk private content',
                audit_log_id=audit_log.pk,
            )

        audit_log.refresh_from_db()
        self.assertIn('처리 완료', audit_log.change_message)
        self.assertIn('대상 2명', audit_log.change_message)
        self.assertIn('생성 1명', audit_log.change_message)
        self.assertIn('중복 1명', audit_log.change_message)
        self.assertIn('실패 0명', audit_log.change_message)
        self.assertNotIn('/bulk-private', audit_log.change_message)
        self.assertNotIn('Bulk private content', audit_log.change_message)

    def test_bulk_delivery_records_audit_failure_before_reraising(self):
        audit_log = self.create_bulk_audit_log()

        with patch.object(
            User.objects,
            'in_bulk',
            side_effect=RuntimeError('private provider failure'),
        ):
            with self.assertLogs('board.notification', level='ERROR') as logs:
                with self.assertRaisesRegex(RuntimeError, 'private provider failure'):
                    BulkNotificationDeliveryService.deliver(
                        [self.user.pk, self.user.pk + 1],
                        '/bulk-private',
                        'Bulk private content',
                        audit_log_id=audit_log.pk,
                    )

        audit_log.refresh_from_db()
        self.assertIn('처리 실패', audit_log.change_message)
        self.assertIn('대상 2명', audit_log.change_message)
        log_output = ' '.join(logs.output)
        self.assertNotIn('private provider failure', log_output)
        self.assertNotIn('/bulk-private', log_output)
        self.assertNotIn('Bulk private content', log_output)
