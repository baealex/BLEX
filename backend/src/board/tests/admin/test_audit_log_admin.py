from django.contrib import admin
from django.contrib.admin.models import CHANGE, LogEntry
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.test import RequestFactory, TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import resolve, reverse
from django.utils import translation

from board.services.utility_cleanup_audit_service import UtilityCleanupAuditService


class AuditLogAdminTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_user = User.objects.create_superuser(
            username='audit-log-admin',
            email='audit-log-admin@example.com',
            password='test',
        )
        cls.utility_entry = LogEntry.objects.create(
            user=cls.admin_user,
            content_type=ContentType.objects.get_for_model(LogEntry),
            object_repr=UtilityCleanupAuditService.OBJECT_REPR,
            action_flag=CHANGE,
            change_message='Executed unused image cleanup',
        )
        cls.admin_entry = LogEntry.objects.create(
            user=cls.admin_user,
            content_type=ContentType.objects.get_for_model(User),
            object_id=str(cls.admin_user.pk),
            object_repr=cls.admin_user.username,
            action_flag=CHANGE,
            change_message='Changed administrator account',
        )

    def changelist_request(self, params=None):
        path = reverse('admin:admin_logentry_changelist')
        request = RequestFactory().get(path, params or {})
        request.user = self.admin_user
        request.resolver_match = resolve(path)
        return request

    def test_utility_history_filter_shows_only_utility_executions(self):
        self.client.force_login(self.admin_user)

        response = self.client.get(
            reverse('admin:admin_logentry_changelist'),
            {'record_type': 'utility'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            list(
                response.context['cl'].queryset.values_list('pk', flat=True),
            ),
            [self.utility_entry.pk],
        )
        self.assertContains(response, '유틸리티 실행')
        self.assertContains(response, '시스템 유틸리티')
        self.assertContains(response, '사용하지 않는 이미지 정리 실행')

    def test_audit_log_search_includes_action_details(self):
        self.client.force_login(self.admin_user)

        response = self.client.get(
            reverse('admin:admin_logentry_changelist'),
            {'q': 'unused image cleanup'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            list(
                response.context['cl'].queryset.values_list('pk', flat=True),
            ),
            [self.utility_entry.pk],
        )

    def test_action_details_use_preview_without_loading_full_message(self):
        model_admin = admin.site._registry[LogEntry]
        entry = model_admin.get_queryset(
            self.changelist_request(),
        ).get(pk=self.utility_entry.pk)

        self.assertIn('change_message', entry.get_deferred_fields())
        with (
            translation.override('ko'),
            CaptureQueriesContext(connection) as queries,
        ):
            details = model_admin.action_details(entry)

        self.assertEqual(details, '사용하지 않는 이미지 정리 실행')
        self.assertEqual(len(queries), 0)
