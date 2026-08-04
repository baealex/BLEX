import json
import tempfile
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.test.client import Client
from django.contrib.admin.models import LogEntry
from django.contrib.contenttypes.models import ContentType
from django.contrib.sessions.models import Session
from django.utils import timezone

from board.models import User, Profile, Post, PostConfig, PostContent, Tag
from board.services.utility_cleanup_service import UtilityCleanupService


class UtilityAPITestCase(TestCase):
    """Utility API endpoint tests"""

    @classmethod
    def setUpTestData(cls):
        cls.staff_user = User.objects.create_user(
            username='staffuser',
            password='test',
            email='staff@test.com',
            is_staff=True,
        )
        Profile.objects.create(user=cls.staff_user)

        cls.superuser = User.objects.create_superuser(
            username='utility-superuser',
            password='test',
            email='utility-superuser@example.com',
        )
        Profile.objects.create(user=cls.superuser)

        cls.other_superuser = User.objects.create_superuser(
            username='other-utility-superuser',
            password='test',
            email='other-utility-superuser@example.com',
        )
        Profile.objects.create(user=cls.other_superuser)

        cls.normal_user = User.objects.create_user(
            username='normaluser',
            password='test',
            email='normal@test.com',
        )
        Profile.objects.create(user=cls.normal_user)

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        self.client.login(username='utility-superuser', password='test')

    def preview_cleanup(self, endpoint: str, payload: dict | None = None) -> dict:
        response = self.client.post(
            endpoint,
            json.dumps({'dry_run': True, **(payload or {})}),
            content_type='application/json',
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIn('confirmationToken', content['body'])
        return content['body']

    # === Stats endpoint ===

    def test_stats_not_login(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        response = client.get('/v1/utilities/stats')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_stats_normal_user(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')
        response = client.get('/v1/utilities/stats')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_delegated_staff_cannot_access_utility_endpoints(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='staffuser', password='test')
        requests = (
            ('get', '/v1/utilities/stats', None),
            ('post', '/v1/utilities/clean-tags', {'dry_run': True}),
            ('post', '/v1/utilities/clean-sessions', {'dry_run': True}),
            ('post', '/v1/utilities/clean-logs', {'dry_run': True}),
            ('post', '/v1/utilities/clean-images', {'dry_run': True}),
        )

        for method, endpoint, payload in requests:
            with self.subTest(endpoint=endpoint):
                response = getattr(client, method)(
                    endpoint,
                    json.dumps(payload) if payload else None,
                    content_type='application/json' if payload else None,
                )
                content = json.loads(response.content)
                self.assertEqual(content['status'], 'ERROR')
                self.assertEqual(content['errorCode'], 'error:RJ')

    def test_stats_success(self):
        response = self.client.get('/v1/utilities/stats')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertIn('totalPosts', body)
        self.assertIn('totalComments', body)
        self.assertIn('totalUsers', body)
        self.assertIn('totalSessions', body)
        self.assertIn('logCount', body)

    def test_stats_combines_related_counts_into_three_queries(self):
        """DB 통계 전체와 두 로그 통계를 총 세 번의 조회로 계산한다."""
        with self.assertNumQueries(3):
            stats = UtilityCleanupService.get_stats()

        self.assertIn('public_posts', stats)
        self.assertIn('expired_sessions', stats)

    def test_stats_preserves_post_status_count_semantics(self):
        now = timezone.now()
        posts = [
            Post.objects.create(
                author=self.staff_user,
                url='public-stat',
                title='Public',
                published_date=now - timezone.timedelta(days=1),
            ),
            Post.objects.create(
                author=self.staff_user,
                url='hidden-stat',
                title='Hidden',
                published_date=now - timezone.timedelta(days=1),
            ),
            Post.objects.create(
                author=self.staff_user,
                url='scheduled-stat',
                title='Scheduled',
                published_date=now + timezone.timedelta(days=1),
            ),
            Post.objects.create(author=self.staff_user, url='draft-stat', title='Draft'),
            Post.objects.create(
                author=self.staff_user,
                url='deleted-stat',
                title='Deleted',
                published_date=now - timezone.timedelta(days=1),
                deleted_date=now,
            ),
        ]
        PostConfig.objects.bulk_create([
            PostConfig(post=post, hide=index == 1)
            for index, post in enumerate(posts)
        ])

        stats = UtilityCleanupService.get_stats()

        self.assertEqual(stats['total_posts'], 5)
        self.assertEqual(stats['public_posts'], 1)
        self.assertEqual(stats['published_posts'], 2)
        self.assertEqual(stats['scheduled_posts'], 1)
        self.assertEqual(stats['hidden_posts'], 1)
        self.assertEqual(stats['draft_posts'], 1)

    # === Clean tags endpoint ===

    def test_clean_tags_not_login(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        response = client.post(
            '/v1/utilities/clean-tags',
            json.dumps({'dry_run': True}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_clean_tags_normal_user(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')
        response = client.post(
            '/v1/utilities/clean-tags',
            json.dumps({'dry_run': True}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_clean_tags_dry_run(self):
        # 미사용 태그 생성
        Tag.objects.create(value='unused-tag-1')
        Tag.objects.create(value='unused-tag-2')

        response = self.client.post(
            '/v1/utilities/clean-tags',
            json.dumps({'dry_run': True}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertTrue(body['dryRun'])
        self.assertGreaterEqual(body['unusedTags'], 2)
        # dry_run이므로 태그가 남아있어야 함
        self.assertTrue(Tag.objects.filter(value='unused-tag-1').exists())

    def test_clean_tags_execute(self):
        Tag.objects.create(value='to-delete-tag')
        preview = self.preview_cleanup('/v1/utilities/clean-tags')

        response = self.client.post(
            '/v1/utilities/clean-tags',
            json.dumps({
                'dry_run': False,
                'confirmation_token': preview['confirmationToken'],
            }),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertFalse(body['dryRun'])
        self.assertGreaterEqual(body['cleanedCount'], 1)
        # 실행 후 태그가 삭제되어야 함
        self.assertFalse(Tag.objects.filter(value='to-delete-tag').exists())
        self.assertTrue(LogEntry.objects.filter(
            user=self.superuser,
            change_message='Executed unused tag cleanup',
        ).exists())

    def test_clean_tags_execute_requires_matching_preview(self):
        tag = Tag.objects.create(value='preview-required-tag')

        response = self.client.post(
            '/v1/utilities/clean-tags',
            json.dumps({'dry_run': False}),
            content_type='application/json',
        )

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
        self.assertTrue(Tag.objects.filter(pk=tag.pk).exists())

    def test_cleanup_endpoints_require_csrf_token_when_enforced(self):
        csrf_client = Client(
            enforce_csrf_checks=True,
            HTTP_USER_AGENT='Mozilla/5.0',
        )
        csrf_client.login(username='utility-superuser', password='test')

        response = csrf_client.post(
            '/v1/utilities/clean-tags',
            data=json.dumps({'dry_run': True}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)

    def test_clean_tags_confirmation_is_bound_to_issuer_session(self):
        tag = Tag.objects.create(value='session-bound-preview-tag')
        preview = self.preview_cleanup('/v1/utilities/clean-tags')
        other_client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        other_client.login(username='other-utility-superuser', password='test')

        response = other_client.post(
            '/v1/utilities/clean-tags',
            json.dumps({
                'dry_run': False,
                'confirmation_token': preview['confirmationToken'],
            }),
            content_type='application/json',
        )

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
        self.assertTrue(Tag.objects.filter(pk=tag.pk).exists())

    def test_clean_tags_confirmation_is_single_use(self):
        Tag.objects.create(value='first-single-use-tag')
        preview = self.preview_cleanup('/v1/utilities/clean-tags')
        execute_payload = {
            'dry_run': False,
            'confirmation_token': preview['confirmationToken'],
        }

        first_response = self.client.post(
            '/v1/utilities/clean-tags',
            json.dumps(execute_payload),
            content_type='application/json',
        )
        self.assertEqual(json.loads(first_response.content)['status'], 'DONE')

        second_tag = Tag.objects.create(value='second-single-use-tag')
        second_response = self.client.post(
            '/v1/utilities/clean-tags',
            json.dumps(execute_payload),
            content_type='application/json',
        )

        content = json.loads(second_response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
        self.assertTrue(Tag.objects.filter(pk=second_tag.pk).exists())

    def test_clean_tags_rolls_back_when_audit_record_fails(self):
        tag = Tag.objects.create(value='audit-rollback-tag')
        preview = self.preview_cleanup('/v1/utilities/clean-tags')

        with patch(
            'board.views.api.v1.utility.UtilityCleanupAuditService.record_execution',
            side_effect=RuntimeError('audit unavailable'),
        ):
            with self.assertRaisesRegex(RuntimeError, 'audit unavailable'):
                self.client.post(
                    '/v1/utilities/clean-tags',
                    json.dumps({
                        'dry_run': False,
                        'confirmation_token': preview['confirmationToken'],
                    }),
                    content_type='application/json',
                )

        self.assertTrue(Tag.objects.filter(pk=tag.pk).exists())

    # === Clean sessions endpoint ===

    def test_clean_sessions_not_login(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        response = client.post(
            '/v1/utilities/clean-sessions',
            json.dumps({'dry_run': True}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_clean_sessions_normal_user(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')
        response = client.post(
            '/v1/utilities/clean-sessions',
            json.dumps({'dry_run': True}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_clean_sessions_dry_run(self):
        # 만료된 세션 생성
        Session.objects.create(
            session_key='expired_session_1',
            session_data='data',
            expire_date=timezone.now() - timezone.timedelta(days=1)
        )

        response = self.client.post(
            '/v1/utilities/clean-sessions',
            json.dumps({'dry_run': True}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertTrue(body['dryRun'])
        self.assertGreaterEqual(body['expiredSessions'], 1)
        self.assertEqual(body['cleanedCount'], 0)
        # dry_run이므로 세션이 남아있어야 함
        self.assertTrue(Session.objects.filter(session_key='expired_session_1').exists())

    def test_clean_sessions_execute_expired(self):
        Session.objects.create(
            session_key='expired_session_2',
            session_data='data',
            expire_date=timezone.now() - timezone.timedelta(days=1)
        )
        preview = self.preview_cleanup(
            '/v1/utilities/clean-sessions',
            {'clean_all': False},
        )

        response = self.client.post(
            '/v1/utilities/clean-sessions',
            json.dumps({
                'dry_run': False,
                'clean_all': False,
                'confirmation_token': preview['confirmationToken'],
            }),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertFalse(body['dryRun'])
        self.assertGreaterEqual(body['cleanedCount'], 1)
        self.assertFalse(Session.objects.filter(session_key='expired_session_2').exists())

    def test_clean_sessions_execute_all(self):
        initial_count = Session.objects.count()

        Session.objects.create(
            session_key='active_session_1',
            session_data='data',
            expire_date=timezone.now() + timezone.timedelta(days=1)
        )
        preview = self.preview_cleanup(
            '/v1/utilities/clean-sessions',
            {'clean_all': True},
        )

        response = self.client.post(
            '/v1/utilities/clean-sessions',
            json.dumps({
                'dry_run': False,
                'clean_all': True,
                'confirmation_token': preview['confirmationToken'],
            }),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertFalse(body['dryRun'])
        self.assertTrue(body['cleanAll'])
        self.assertGreaterEqual(body['cleanedCount'], initial_count + 1)
        self.assertEqual(Session.objects.count(), 0)

    def test_clean_sessions_rejects_confirmation_for_different_scope(self):
        preview = self.preview_cleanup(
            '/v1/utilities/clean-sessions',
            {'clean_all': False},
        )

        response = self.client.post(
            '/v1/utilities/clean-sessions',
            json.dumps({
                'dry_run': False,
                'clean_all': True,
                'confirmation_token': preview['confirmationToken'],
            }),
            content_type='application/json',
        )

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    # === Clean logs endpoint ===

    def test_clean_logs_not_login(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        response = client.post(
            '/v1/utilities/clean-logs',
            json.dumps({'dry_run': True}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_clean_logs_normal_user(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')
        response = client.post(
            '/v1/utilities/clean-logs',
            json.dumps({'dry_run': True}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_clean_logs_dry_run(self):
        ct = ContentType.objects.get_for_model(User)
        LogEntry.objects.create(
            user=self.staff_user,
            content_type=ct,
            object_id='1',
            object_repr='test',
            action_flag=1,
        )

        response = self.client.post(
            '/v1/utilities/clean-logs',
            json.dumps({'dry_run': True}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertTrue(body['dryRun'])
        self.assertGreaterEqual(body['logCount'], 1)
        self.assertEqual(body['cleanedCount'], 0)
        # dry_run이므로 로그가 남아있어야 함
        self.assertGreaterEqual(LogEntry.objects.count(), 1)

    @override_settings(ADMIN_AUDIT_LOG_RETENTION_DAYS=365)
    def test_clean_logs_execute_preserves_recent_audit_logs_and_records_execution(self):
        ct = ContentType.objects.get_for_model(User)
        expired_log = LogEntry.objects.create(
            user=self.staff_user,
            content_type=ct,
            object_id='1',
            object_repr='expired',
            action_flag=1,
        )
        LogEntry.objects.filter(pk=expired_log.pk).update(
            action_time=timezone.now() - timezone.timedelta(days=366),
        )
        recent_log = LogEntry.objects.create(
            user=self.staff_user,
            content_type=ct,
            object_id='2',
            object_repr='recent',
            action_flag=1,
        )
        preview = self.preview_cleanup('/v1/utilities/clean-logs')

        response = self.client.post(
            '/v1/utilities/clean-logs',
            json.dumps({
                'dry_run': False,
                'confirmation_token': preview['confirmationToken'],
            }),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertFalse(body['dryRun'])
        self.assertEqual(body['cleanedCount'], 1)
        self.assertFalse(LogEntry.objects.filter(pk=expired_log.pk).exists())
        self.assertTrue(LogEntry.objects.filter(pk=recent_log.pk).exists())
        self.assertTrue(LogEntry.objects.filter(
            user=self.superuser,
            change_message='Executed expired log cleanup',
        ).exists())

    # === Clean images endpoint ===

    def test_clean_images_not_login(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        response = client.post(
            '/v1/utilities/clean-images',
            json.dumps({'dry_run': True}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_clean_images_normal_user(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')
        response = client.post(
            '/v1/utilities/clean-images',
            json.dumps({'dry_run': True}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_clean_images_dry_run(self):
        response = self.client.post(
            '/v1/utilities/clean-images',
            json.dumps({'dry_run': True, 'target': 'all', 'remove_duplicates': False}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertTrue(body['dryRun'])
        self.assertIn('totalUnused', body)
        self.assertIn('totalSizeMb', body)
        self.assertIn('totalSavedMb', body)
        self.assertIn('messages', body)
        self.assertFalse(body['hasErrors'])

    def test_clean_images_dry_run_with_duplicates(self):
        """중복 제거 dry run 시 duplicateFiles 포함 확인"""
        response = self.client.post(
            '/v1/utilities/clean-images',
            json.dumps({'dry_run': True, 'target': 'title', 'remove_duplicates': True}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertTrue(body['dryRun'])
        self.assertIn('totalDuplicates', body)
        self.assertIn('totalDuplicateSizeMb', body)

    def test_clean_images_execute_records_completed_audit_entry(self):
        with tempfile.TemporaryDirectory() as media_root, override_settings(
            MEDIA_ROOT=media_root,
        ):
            preview = self.preview_cleanup(
                '/v1/utilities/clean-images',
                {'target': 'all', 'remove_duplicates': False},
            )

            response = self.client.post(
                '/v1/utilities/clean-images',
                json.dumps({
                    'dry_run': False,
                    'target': 'all',
                    'remove_duplicates': False,
                    'confirmation_token': preview['confirmationToken'],
                }),
                content_type='application/json',
            )

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertTrue(LogEntry.objects.filter(
            user=self.superuser,
            change_message='Executed unused image cleanup',
        ).exists())

    def test_clean_images_does_not_run_when_audit_intent_fails(self):
        with tempfile.TemporaryDirectory() as media_root, override_settings(
            MEDIA_ROOT=media_root,
        ):
            preview = self.preview_cleanup('/v1/utilities/clean-images')

            with patch(
                'board.views.api.v1.utility.UtilityCleanupAuditService.record_intent',
                side_effect=RuntimeError('audit unavailable'),
            ), patch(
                'board.views.api.v1.utility.UtilityCleanupService.clean_images',
            ) as clean_images:
                with self.assertRaisesRegex(RuntimeError, 'audit unavailable'):
                    self.client.post(
                        '/v1/utilities/clean-images',
                        json.dumps({
                            'dry_run': False,
                            'confirmation_token': preview['confirmationToken'],
                        }),
                        content_type='application/json',
                    )

        clean_images.assert_not_called()

    def test_clean_images_invalid_target_uses_request_locale(self):
        for language, expected_message in (
            ('en', 'Select a valid cleanup target.'),
            ('ko', '유효한 정리 대상을 선택해주세요.'),
        ):
            with self.subTest(language=language):
                response = self.client.post(
                    '/v1/utilities/clean-images',
                    json.dumps({'dry_run': True, 'target': 'invalid'}),
                    content_type='application/json',
                    HTTP_ACCEPT_LANGUAGE=language,
                )
                content = json.loads(response.content)
                self.assertEqual(content['status'], 'ERROR')
                self.assertEqual(content['errorCode'], 'error:VA')
                self.assertEqual(content['errorMessage'], expected_message)

    def test_clean_images_specific_target(self):
        for target in ('content', 'title', 'avatar'):
            response = self.client.post(
                '/v1/utilities/clean-images',
                json.dumps({'dry_run': True, 'target': target}),
                content_type='application/json'
            )
            content = json.loads(response.content)
            self.assertEqual(content['status'], 'DONE')

    def test_clean_endpoints_empty_body_use_default_dry_run(self):
        expected_keys = {
            '/v1/utilities/clean-tags': 'dryRun',
            '/v1/utilities/clean-sessions': 'dryRun',
            '/v1/utilities/clean-logs': 'dryRun',
            '/v1/utilities/clean-images': 'dryRun',
        }

        for endpoint, dry_run_key in expected_keys.items():
            with self.subTest(endpoint=endpoint):
                response = self.client.post(
                    endpoint,
                    b'',
                    content_type='application/json'
                )
                content = json.loads(response.content)
                self.assertEqual(content['status'], 'DONE')
                self.assertTrue(content['body'][dry_run_key])

    def test_clean_endpoints_invalid_json_return_validate_error(self):
        endpoints = (
            '/v1/utilities/clean-tags',
            '/v1/utilities/clean-sessions',
            '/v1/utilities/clean-logs',
            '/v1/utilities/clean-images',
        )

        for endpoint in endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.post(
                    endpoint,
                    '{invalid',
                    content_type='application/json'
                )
                content = json.loads(response.content)
                self.assertEqual(content['status'], 'ERROR')
                self.assertEqual(content['errorCode'], 'error:VA')

    # === Method checks ===

    def test_stats_rejects_post(self):
        response = self.client.post('/v1/utilities/stats')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_clean_tags_rejects_get(self):
        response = self.client.get('/v1/utilities/clean-tags')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
