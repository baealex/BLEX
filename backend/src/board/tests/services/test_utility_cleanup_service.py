from django.contrib.admin.models import LogEntry
from django.contrib.contenttypes.models import ContentType
from django.contrib.sessions.models import Session
from django.core import signing
from django.test import TestCase, override_settings
from django.utils import timezone

from board.models import DeveloperRequestLog, Profile, Tag, User
from board.services.utility_cleanup_service import (
    InvalidImageCleanupTargetError,
    UtilityCleanupService,
    UtilityPermissionService,
)
from board.services.utility_cleanup_confirmation_service import (
    InvalidUtilityCleanupConfirmationError,
    UtilityCleanupConfirmationService,
)


class UtilityCleanupServiceTestCase(TestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(
            username='utility-staff',
            password='test',
            is_staff=True,
        )
        Profile.objects.create(user=self.staff_user)
        self.superuser = User.objects.create_superuser(
            username='utility-superuser',
            password='test',
            email='utility-superuser@example.com',
        )
        Profile.objects.create(user=self.superuser)
        self.normal_user = User.objects.create_user(
            username='utility-normal',
            password='test',
        )
        Profile.objects.create(user=self.normal_user)

    def test_require_superuser_rejects_delegated_staff_user(self):
        self.assertIsNotNone(UtilityPermissionService.require_superuser(self.staff_user))

    def test_require_superuser_allows_superuser(self):
        self.assertIsNone(UtilityPermissionService.require_superuser(self.superuser))

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

    @override_settings(ADMIN_AUDIT_LOG_RETENTION_DAYS=365)
    def test_clean_logs_execute_removes_only_expired_audit_logs(self):
        content_type = ContentType.objects.get_for_model(User)
        expired_log = LogEntry.objects.create(
            user=self.staff_user,
            content_type=content_type,
            object_id='1',
            object_repr='expired',
            action_flag=1,
        )
        LogEntry.objects.filter(pk=expired_log.pk).update(
            action_time=timezone.now() - timezone.timedelta(days=366),
        )
        recent_log = LogEntry.objects.create(
            user=self.staff_user,
            content_type=content_type,
            object_id='2',
            object_repr='recent',
            action_flag=1,
        )

        payload = UtilityCleanupService.clean_logs({'dry_run': False})

        self.assertFalse(payload['dry_run'])
        self.assertEqual(payload['admin_audit_log_retention_days'], 365)
        self.assertEqual(payload['expired_log_count'], 1)
        self.assertEqual(payload['cleaned_count'], 1)
        self.assertFalse(LogEntry.objects.filter(pk=expired_log.pk).exists())
        self.assertTrue(LogEntry.objects.filter(pk=recent_log.pk).exists())

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

    @override_settings(DEVELOPER_API_LOG_RETENTION_DAYS=30)
    def test_clean_logs_does_not_allow_request_to_shorten_retention(self):
        old_log = DeveloperRequestLog.objects.create(
            user=self.staff_user,
            method='GET',
            path='/api/developer/v1/posts',
            status_code=200,
            created_date=timezone.now() - timezone.timedelta(days=2),
        )

        payload = UtilityCleanupService.clean_logs({
            'dry_run': False,
            'developer_api_log_retention_days': 1,
        })

        self.assertEqual(payload['developer_api_log_retention_days'], 30)
        self.assertTrue(DeveloperRequestLog.objects.filter(pk=old_log.pk).exists())

    def test_non_boolean_dry_run_never_executes_cleanup(self):
        Tag.objects.create(value='non-boolean-dry-run')

        payload = UtilityCleanupService.clean_tags({'dry_run': 'false'})

        self.assertTrue(payload['dry_run'])
        self.assertTrue(Tag.objects.filter(value='non-boolean-dry-run').exists())

    def test_cleanup_confirmation_does_not_embed_session_key(self):
        token = UtilityCleanupConfirmationService.issue(
            user_id=self.superuser.pk,
            session_key='sensitive-session-cookie-value',
            action=UtilityCleanupService.ACTION_CLEAN_TAGS,
            parameters={},
        )

        payload = signing.loads(
            token,
            salt=UtilityCleanupConfirmationService.SALT,
        )

        self.assertNotIn('session_key', payload)
        self.assertIn('session_fingerprint', payload)
        self.assertNotIn('sensitive-session-cookie-value', str(payload))

    def test_cleanup_confirmation_rejects_different_parameters(self):
        token = UtilityCleanupConfirmationService.issue(
            user_id=self.superuser.pk,
            session_key='session-key',
            action=UtilityCleanupService.ACTION_CLEAN_SESSIONS,
            parameters={'clean_all': False},
        )

        with self.assertRaises(InvalidUtilityCleanupConfirmationError):
            UtilityCleanupConfirmationService.require_valid(
                token=token,
                user_id=self.superuser.pk,
                session_key='session-key',
                action=UtilityCleanupService.ACTION_CLEAN_SESSIONS,
                parameters={'clean_all': True},
            )

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
