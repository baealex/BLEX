import json

from django.test import TestCase
from django.test.client import Client
from django.contrib.admin.models import LogEntry
from django.contrib.contenttypes.models import ContentType
from django.contrib.sessions.models import Session
from django.utils import timezone

from board.models import User, Profile, Post, PostContent, Tag


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

        cls.normal_user = User.objects.create_user(
            username='normaluser',
            password='test',
            email='normal@test.com',
        )
        Profile.objects.create(user=cls.normal_user)

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        self.client.login(username='staffuser', password='test')

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

        response = self.client.post(
            '/v1/utilities/clean-tags',
            json.dumps({'dry_run': False}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertFalse(body['dryRun'])
        self.assertGreaterEqual(body['cleanedCount'], 1)
        # 실행 후 태그가 삭제되어야 함
        self.assertFalse(Tag.objects.filter(value='to-delete-tag').exists())

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

        response = self.client.post(
            '/v1/utilities/clean-sessions',
            json.dumps({'dry_run': False, 'clean_all': False}),
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

        response = self.client.post(
            '/v1/utilities/clean-sessions',
            json.dumps({'dry_run': False, 'clean_all': True}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertFalse(body['dryRun'])
        self.assertTrue(body['cleanAll'])
        self.assertGreaterEqual(body['cleanedCount'], initial_count + 1)
        self.assertEqual(Session.objects.count(), 0)

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

    def test_clean_logs_execute(self):
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
            json.dumps({'dry_run': False}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertFalse(body['dryRun'])
        self.assertGreaterEqual(body['cleanedCount'], 1)
        self.assertEqual(LogEntry.objects.count(), 0)

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

    def test_clean_images_invalid_target(self):
        response = self.client.post(
            '/v1/utilities/clean-images',
            json.dumps({'dry_run': True, 'target': 'invalid'}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_clean_images_specific_target(self):
        for target in ('content', 'title', 'avatar'):
            response = self.client.post(
                '/v1/utilities/clean-images',
                json.dumps({'dry_run': True, 'target': target}),
                content_type='application/json'
            )
            content = json.loads(response.content)
            self.assertEqual(content['status'], 'DONE')

    # === Method checks ===

    def test_stats_rejects_post(self):
        response = self.client.post('/v1/utilities/stats')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_clean_tags_rejects_get(self):
        response = self.client.get('/v1/utilities/clean-tags')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
