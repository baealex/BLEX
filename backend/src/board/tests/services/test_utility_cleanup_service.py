from django.contrib.admin.models import LogEntry
from django.contrib.contenttypes.models import ContentType
from django.contrib.sessions.models import Session
from django.test import TestCase, override_settings
from django.utils import timezone

from board.models import DeveloperRequestLog, Profile, Tag, User
from board.services.utility_cleanup_service import (
    InvalidImageCleanupTargetError,
    UtilityCleanupService,
    UtilityPermissionService,
)


class UtilityCleanupServiceTestCase(TestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(
            username='utility-staff',
            password='test',
            is_staff=True,
        )
        Profile.objects.create(user=self.staff_user)
        self.normal_user = User.objects.create_user(
            username='utility-normal',
            password='test',
        )
        Profile.objects.create(user=self.normal_user)

    def test_require_staff_rejects_non_staff_user(self):
        self.assertIsNotNone(UtilityPermissionService.require_staff(self.normal_user))

    def test_require_staff_allows_staff_user(self):
        self.assertIsNone(UtilityPermissionService.require_staff(self.staff_user))

    def test_clean_tags_dry_run_preserves_unused_tags(self):
        Tag.objects.create(value='service-unused-tag')

        payload = UtilityCleanupService.clean_tags({'dry_run': True})

        self.assertTrue(payload['dry_run'])
        self.assertGreaterEqual(payload['unused_tags'], 1)
        self.assertTrue(Tag.objects.filter(value='service-unused-tag').exists())

    def test_clean_sessions_dry_run_preserves_sessions(self):
        Session.objects.create(
            session_key='service_expired_session',
            session_data='data',
            expire_date=timezone.now() - timezone.timedelta(days=1),
        )

        payload = UtilityCleanupService.clean_sessions({'dry_run': True})

        self.assertTrue(payload['dry_run'])
        self.assertGreaterEqual(payload['expired_sessions'], 1)
        self.assertEqual(payload['cleaned_count'], 0)
        self.assertTrue(
            Session.objects.filter(session_key='service_expired_session').exists()
        )

    def test_clean_logs_execute_removes_logs(self):
        content_type = ContentType.objects.get_for_model(User)
        LogEntry.objects.create(
            user=self.staff_user,
            content_type=content_type,
            object_id='1',
            object_repr='test',
            action_flag=1,
        )

        payload = UtilityCleanupService.clean_logs({'dry_run': False})

        self.assertFalse(payload['dry_run'])
        self.assertGreaterEqual(payload['cleaned_count'], 1)
        self.assertEqual(LogEntry.objects.count(), 0)

    @override_settings(DEVELOPER_API_LOG_RETENTION_DAYS=30)
    def test_clean_logs_execute_removes_expired_developer_request_logs(self):
        old_log = DeveloperRequestLog.objects.create(
            user=self.staff_user,
            method='GET',
            path='/api/developer/v1/posts',
            status_code=200,
            created_date=timezone.now() - timezone.timedelta(days=31),
        )
        recent_log = DeveloperRequestLog.objects.create(
            user=self.staff_user,
            method='GET',
            path='/api/developer/v1/me',
            status_code=200,
            created_date=timezone.now() - timezone.timedelta(days=1),
        )

        payload = UtilityCleanupService.clean_logs({'dry_run': False})

        self.assertFalse(payload['dry_run'])
        self.assertEqual(payload['developer_api_log_retention_days'], 30)
        self.assertEqual(payload['expired_developer_request_log_count'], 1)
        self.assertEqual(payload['cleaned_developer_request_log_count'], 1)
        self.assertFalse(DeveloperRequestLog.objects.filter(id=old_log.id).exists())
        self.assertTrue(DeveloperRequestLog.objects.filter(id=recent_log.id).exists())

    def test_clean_images_rejects_invalid_target(self):
        with self.assertRaises(InvalidImageCleanupTargetError):
            UtilityCleanupService.clean_images({
                'dry_run': True,
                'target': 'invalid',
            })

    def test_build_image_result_preserves_dry_run_contract(self):
        payload = UtilityCleanupService.build_image_result(
            total_unused=1,
            total_size=1024,
            total_duplicates=0,
            total_duplicate_size=0,
            messages=[],
            dry_run=True,
            unused_files=[{'path': 'a.png'}],
            duplicate_files=[],
        )

        self.assertTrue(payload['dry_run'])
        self.assertEqual(payload['total_unused'], 1)
        self.assertIn('unused_files', payload)
