from datetime import timedelta
from unittest.mock import patch

from django.contrib import admin
from django.contrib.admin import helpers
from django.contrib.admin.models import ADDITION, CHANGE, LogEntry
from django.contrib.auth.models import Permission, User
from django.contrib.messages.storage.fallback import FallbackStorage
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.template.response import TemplateResponse
from django.test import RequestFactory, TestCase
from django.urls import reverse
from django.utils import timezone

from board.admin.notify import BulkNotificationForm, NotifyAdmin, NotifyAdminForm
from board.models import Notify
from board.services.bulk_notification_delivery_service import (
    BulkNotificationDeliveryService,
)


class NotifyAdminTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_user = User.objects.create_superuser(
            username='notification-admin',
            email='notification-admin@example.com',
            password='test',
        )
        cls.user = User.objects.create_user(
            username='notification-recipient',
            password='test',
        )
        cls.inactive_user = User.objects.create_user(
            username='inactive-notification-recipient',
            password='test',
            is_active=False,
        )
        cls.staff_without_permission = User.objects.create_user(
            username='notification-staff',
            password='test',
            is_staff=True,
        )

    def setUp(self):
        self.admin_instance = NotifyAdmin(Notify, admin.site)

    def admin_request(
        self,
        method: str = 'get',
        data: dict[str, object] | None = None,
        *,
        user: User | None = None,
    ):
        factory_method = getattr(RequestFactory(), method)
        request = factory_method(
            '/admin/board/notify/',
            data=data or {},
        )
        request.user = user or self.admin_user
        request.session = {}
        request._messages = FallbackStorage(request)
        return request

    @staticmethod
    def action_selection(action: str, object_ids: list[int]) -> dict[str, object]:
        return {
            helpers.ACTION_CHECKBOX_NAME: [str(object_id) for object_id in object_ids],
            'action': action,
            'select_across': '0',
        }

    @staticmethod
    def message_text(request) -> str:
        return ' '.join(str(message) for message in request._messages)

    def create_notification(
        self,
        *,
        user: User | None = None,
        url: str = '/notification',
        content: str = 'Notification content',
        has_read: bool = False,
    ) -> Notify:
        recipient = user or self.user
        return Notify.objects.create(
            user=recipient,
            key=Notify.create_hash_key(recipient, url, content),
            url=url,
            content=content,
            has_read=has_read,
        )

    def test_form_allows_the_current_row_but_rejects_another_duplicate(self):
        notification = self.create_notification()
        form_data = {
            'user': self.user.pk,
            'url': notification.url,
            'content': notification.content,
            'has_read': '',
        }

        current_form = NotifyAdminForm(
            data=form_data,
            instance=notification,
        )
        duplicate_form = NotifyAdminForm(data=form_data)

        self.assertTrue(current_form.is_valid(), current_form.errors)
        self.assertFalse(duplicate_form.is_valid())
        self.assertIn(
            '이미 동일한 알림이 존재합니다.',
            duplicate_form.non_field_errors(),
        )

    def test_notification_forms_reject_executable_url_schemes(self):
        admin_form = NotifyAdminForm(data={
            'user': self.user.pk,
            'url': 'javascript:unsafe',
            'content': 'Unsafe destination',
            'has_read': '',
        })
        bulk_form = BulkNotificationForm(data={
            'url': 'data:text/html,unsafe',
            'content': 'Unsafe bulk destination',
        })
        malformed_form = BulkNotificationForm(data={
            'url': 'http://[invalid',
            'content': 'Malformed destination',
        })

        self.assertFalse(admin_form.is_valid())
        self.assertFalse(bulk_form.is_valid())
        self.assertFalse(malformed_form.is_valid())
        self.assertTrue(
            any(
                '상대 경로 또는 HTTP(S) URL' in error
                for error in admin_form.errors['url']
            ),
        )
        self.assertIn('올바른 알림 URL을 입력해주세요.', malformed_form.errors['url'])
        self.assertTrue(
            any(
                '상대 경로 또는 HTTP(S) URL' in error
                for error in bulk_form.errors['url']
            ),
        )

    def test_url_link_does_not_render_unsafe_legacy_destination(self):
        notification = self.create_notification(url='javascript:unsafe')

        rendered_link = str(self.admin_instance.url_link(notification))

        self.assertIn('안전하지 않은 URL', rendered_link)
        self.assertNotIn('href=', rendered_link)
        self.assertNotIn('javascript:unsafe', rendered_link)

    def test_notification_forms_reject_incomplete_http_urls(self):
        for url in ('http://', 'https://', '//'):
            with self.subTest(url=url):
                form = BulkNotificationForm(data={
                    'url': url,
                    'content': 'Incomplete destination',
                })

                self.assertFalse(form.is_valid())
                self.assertIn(
                    '올바른 알림 URL을 입력해주세요.',
                    form.errors['url'],
                )

    def test_admin_save_dispatches_committed_add_but_never_resends_edit(self):
        request = self.admin_request('post')
        notification = Notify(
            user=self.user,
            url='/admin-created',
            content='Created in Admin',
        )

        with patch.object(Notify, 'send_notify') as send_notify:
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                self.admin_instance.save_model(
                    request,
                    notification,
                    form=None,
                    change=False,
                )
                send_notify.assert_not_called()
            notification.content = 'Edited in Admin'
            self.admin_instance.save_model(
                request,
                notification,
                form=None,
                change=True,
            )

        self.assertEqual(len(callbacks), 1)
        send_notify.assert_called_once()
        notification.refresh_from_db()
        self.assertEqual(notification.content, 'Edited in Admin')

    def test_admin_save_hides_delivery_error_details(self):
        request = self.admin_request('post')
        notification = Notify(
            user=self.user,
            url='/admin-failure',
            content='Created before delivery failure',
        )

        with patch.object(
            Notify,
            'send_notify',
            side_effect=RuntimeError('telegram-token-secret'),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                self.admin_instance.save_model(
                    request,
                    notification,
                    form=None,
                    change=False,
                )

        self.assertTrue(Notify.objects.filter(pk=notification.pk).exists())
        messages = self.message_text(request)
        self.assertIn('외부 채널로 전송하지 못했습니다.', messages)
        self.assertNotIn('telegram-token-secret', messages)

    def test_admin_save_never_dispatches_rolled_back_notification(self):
        request = self.admin_request('post')
        notification = Notify(
            user=self.user,
            url='/admin-rolled-back',
            content='Must never leave the transaction',
        )

        with patch.object(Notify, 'send_notify') as send_notify:
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                with self.assertRaisesRegex(
                    RuntimeError,
                    'audit transaction failed',
                ):
                    with transaction.atomic():
                        self.admin_instance.save_model(
                            request,
                            notification,
                            form=None,
                            change=False,
                        )
                        raise RuntimeError('audit transaction failed')

        self.assertEqual(callbacks, [])
        send_notify.assert_not_called()
        self.assertFalse(
            Notify.objects.filter(url='/admin-rolled-back').exists(),
        )

    def test_read_action_updates_timestamp_and_writes_audit_log(self):
        notification = self.create_notification()
        previous_updated_date = timezone.now() - timedelta(days=1)
        Notify.objects.filter(pk=notification.pk).update(
            updated_date=previous_updated_date,
        )

        self.admin_instance.mark_as_read(
            self.admin_request('post'),
            Notify.objects.filter(pk=notification.pk),
        )

        notification.refresh_from_db()
        self.assertTrue(notification.has_read)
        self.assertGreater(notification.updated_date, previous_updated_date)
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(notification.pk),
                action_flag=CHANGE,
                change_message__contains='읽음 상태로 변경',
            ).exists(),
        )

    def test_read_action_rolls_back_when_audit_log_fails(self):
        notification = self.create_notification()

        with patch.object(
            self.admin_instance,
            'log_change',
            side_effect=RuntimeError('audit unavailable'),
        ):
            with self.assertRaisesRegex(RuntimeError, 'audit unavailable'):
                self.admin_instance.mark_as_read(
                    self.admin_request('post'),
                    Notify.objects.filter(pk=notification.pk),
                )

        notification.refresh_from_db()
        self.assertFalse(notification.has_read)

    def test_resend_requires_confirmation_and_isolates_failures(self):
        first = self.create_notification(content='First')
        second = self.create_notification(content='Second')
        selection = self.action_selection(
            'resend_notifications',
            [first.pk, second.pk],
        )
        queryset = Notify.objects.filter(pk__in=[first.pk, second.pk])

        confirmation = self.admin_instance.resend_notifications(
            self.admin_request('post', selection),
            queryset,
        )

        self.assertIsInstance(confirmation, TemplateResponse)
        confirmation.render()

        confirmed_request = self.admin_request(
            'post',
            {**selection, 'confirm': 'yes'},
        )
        with patch.object(
            Notify,
            'send_notify',
            side_effect=[None, RuntimeError('provider-secret')],
        ) as send_notify:
            self.admin_instance.resend_notifications(
                confirmed_request,
                queryset,
            )

        self.assertEqual(send_notify.call_count, 2)
        self.assertEqual(
            LogEntry.objects.filter(
                object_id__in=[str(first.pk), str(second.pk)],
                action_flag=CHANGE,
                change_message__contains='외부 알림 재발송 요청',
            ).count(),
            2,
        )
        messages = self.message_text(confirmed_request)
        self.assertIn('1개의 알림을 외부 채널로 재발송했습니다.', messages)
        self.assertIn('1개의 알림은 재발송하지 못했습니다.', messages)
        self.assertNotIn('provider-secret', messages)

    def test_resend_never_dispatches_when_audit_log_fails(self):
        notification = self.create_notification()
        request = self.admin_request(
            'post',
            {
                **self.action_selection(
                    'resend_notifications',
                    [notification.pk],
                ),
                'confirm': 'yes',
            },
        )

        with patch.object(
            self.admin_instance,
            'log_change',
            side_effect=RuntimeError('audit unavailable'),
        ):
            with patch.object(Notify, 'send_notify') as send_notify:
                self.admin_instance.resend_notifications(
                    request,
                    Notify.objects.filter(pk=notification.pk),
                )

        send_notify.assert_not_called()

    def test_bulk_send_confirms_active_targets_then_audits_and_enqueues(self):
        form_data = {
            'url': '/admin/bulk',
            'content': '<script>private bulk content</script>',
        }
        active_user_ids = list(
            User.objects.filter(is_active=True).values_list('pk', flat=True),
        )
        request = self.admin_request(
            'post',
            form_data,
        )

        with patch.object(
            BulkNotificationDeliveryService,
            'enqueue',
        ) as enqueue:
            confirmation = self.admin_instance.bulk_send_view(request)

        self.assertEqual(confirmation.status_code, 200)
        self.assertContains(
            confirmation,
            f'현재 활성 사용자 {len(active_user_ids)}명',
        )
        self.assertNotContains(
            confirmation,
            '<script>private bulk content</script>',
        )
        self.assertContains(
            confirmation,
            '&lt;script&gt;private bulk content&lt;/script&gt;',
            html=False,
        )
        enqueue.assert_not_called()
        self.assertFalse(LogEntry.objects.filter(action_flag=ADDITION).exists())

        confirmed_request = self.admin_request(
            'post',
            {**form_data, 'confirm': 'yes'},
        )
        with patch.object(
            BulkNotificationDeliveryService,
            'enqueue',
            return_value='background-task-1',
        ) as enqueue:
            response = self.admin_instance.bulk_send_view(confirmed_request)

        self.assertEqual(response.status_code, 302)
        audit_log = LogEntry.objects.get(action_flag=ADDITION)
        enqueue.assert_called_once_with(
            user_ids=active_user_ids,
            url='/admin/bulk',
            content='<script>private bulk content</script>',
            audit_log_id=audit_log.pk,
        )
        self.assertEqual(Notify.objects.count(), 0)
        self.assertIsNone(audit_log.object_id)
        self.assertIn(str(len(active_user_ids)), audit_log.object_repr)
        self.assertNotIn('/admin/bulk', audit_log.change_message)
        self.assertNotIn('private bulk content', audit_log.change_message)

    def test_bulk_send_marks_audit_log_when_enqueue_is_rejected(self):
        form_data = {
            'url': '/admin/bulk-private',
            'content': 'Private bulk content',
            'confirm': 'yes',
        }
        request = self.admin_request('post', form_data)

        with patch.object(
            BulkNotificationDeliveryService,
            'enqueue',
            return_value=None,
        ) as enqueue:
            response = self.admin_instance.bulk_send_view(request)

        self.assertEqual(response.status_code, 302)
        audit_log = LogEntry.objects.get(action_flag=ADDITION)
        self.assertIn('예약 실패', audit_log.change_message)
        self.assertNotIn('/admin/bulk-private', audit_log.change_message)
        self.assertNotIn('Private bulk content', audit_log.change_message)
        enqueue.assert_called_once_with(
            user_ids=list(
                User.objects.filter(is_active=True).values_list('pk', flat=True),
            ),
            url='/admin/bulk-private',
            content='Private bulk content',
            audit_log_id=audit_log.pk,
        )
        self.assertIn('알림 발송 작업을 예약하지 못했습니다.', self.message_text(request))

    def test_bulk_send_requires_add_permission(self):
        request = self.admin_request(
            user=self.staff_without_permission,
        )

        with self.assertRaises(PermissionDenied):
            self.admin_instance.bulk_send_view(request)

    def test_bulk_send_requires_superuser_even_with_add_permission(self):
        delegated_staff = User.objects.create_user(
            username='delegated-notification-admin',
            password='test',
            is_staff=True,
        )
        delegated_staff.user_permissions.add(
            Permission.objects.get(codename='add_notify'),
            Permission.objects.get(codename='view_notify'),
        )
        request = self.admin_request(user=delegated_staff)

        self.assertFalse(self.admin_instance.has_bulk_send_permission(request))
        with self.assertRaises(PermissionDenied):
            self.admin_instance.bulk_send_view(request)

        self.client.force_login(delegated_staff)
        changelist = self.client.get(reverse('admin:board_notify_changelist'))

        self.assertEqual(changelist.status_code, 200)
        self.assertNotContains(changelist, '전체 활성 사용자에게 알림 발송')

    def test_superuser_can_open_bulk_send_from_the_changelist(self):
        self.client.force_login(self.admin_user)

        changelist = self.client.get(reverse('admin:board_notify_changelist'))
        bulk_send = self.client.get(reverse('admin:board_notify_bulk_send'))

        self.assertEqual(changelist.status_code, 200)
        self.assertContains(changelist, '전체 활성 사용자에게 알림 발송')
        self.assertEqual(bulk_send.status_code, 200)

    def test_bulk_send_rejects_unsafe_url_before_confirmation(self):
        request = self.admin_request(
            'post',
            {
                'url': 'javascript:unsafe',
                'content': 'Unsafe bulk destination',
                'confirm': 'yes',
            },
        )

        with patch.object(
            BulkNotificationDeliveryService,
            'enqueue',
        ) as enqueue:
            response = self.admin_instance.bulk_send_view(request)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '상대 경로 또는 HTTP(S) URL')
        enqueue.assert_not_called()
        self.assertFalse(LogEntry.objects.filter(action_flag=ADDITION).exists())

    def test_bulk_send_does_not_enqueue_when_audit_log_fails(self):
        request = self.admin_request(
            'post',
            {
                'url': '/admin/bulk',
                'content': 'Audited content',
                'confirm': 'yes',
            },
        )

        with patch.object(
            LogEntry.objects,
            'create',
            side_effect=RuntimeError('audit unavailable'),
        ):
            with patch.object(
                BulkNotificationDeliveryService,
                'enqueue',
            ) as enqueue:
                with self.assertRaisesRegex(
                    RuntimeError,
                    'audit unavailable',
                ):
                    self.admin_instance.bulk_send_view(request)

        enqueue.assert_not_called()
