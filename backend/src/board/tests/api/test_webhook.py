"""
웹훅 채널 API 테스트
"""
import json
from unittest.mock import patch

from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.utils import timezone

from board.models import Profile, Post, PostConfig, PostContent, WebhookSubscription
from board.services import WebhookService


class WebhookAPITestCase(TestCase):
    """웹훅 채널 API 테스트"""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='testauthor',
            email='test@example.com',
            password='testpass123'
        )
        cls.profile = Profile.objects.create(user=cls.user)

        cls.other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        cls.other_profile = Profile.objects.create(user=cls.other_user)

    def setUp(self):
        self.client = Client()

    def test_get_channels_not_logged_in(self):
        """비로그인 시 채널 목록 조회 실패"""
        response = self.client.get('/v1/webhook/channels')

        data = response.json()
        self.assertEqual(data['status'], 'ERROR')
        self.assertIn('NL', data['errorCode'])

    def test_get_channels(self):
        """내 채널 목록 조회"""
        self.client.login(username='testauthor', password='testpass123')
        WebhookSubscription.objects.create(
            author=self.profile,
            webhook_url='https://discord.com/api/webhooks/123/abc',
            name='My Discord'
        )

        response = self.client.get('/v1/webhook/channels')

        data = response.json()
        self.assertEqual(data['status'], 'DONE')
        self.assertEqual(len(data['body']['channels']), 1)
        self.assertEqual(data['body']['channels'][0]['name'], 'My Discord')

    def test_add_channel(self):
        """채널 추가"""
        self.client.login(username='testauthor', password='testpass123')

        response = self.client.post(
            '/v1/webhook/channels',
            data=json.dumps({
                'webhook_url': 'https://discord.com/api/webhooks/456/def',
                'name': 'New Channel'
            }),
            content_type='application/json'
        )

        data = response.json()
        self.assertEqual(data['status'], 'DONE')
        self.assertTrue(
            WebhookSubscription.objects.filter(
                author=self.profile,
                webhook_url='https://discord.com/api/webhooks/456/def'
            ).exists()
        )

    def test_add_channel_invalid_url(self):
        """잘못된 URL로 채널 추가 시 실패"""
        self.client.login(username='testauthor', password='testpass123')

        response = self.client.post(
            '/v1/webhook/channels',
            data=json.dumps({'webhook_url': 'not-a-valid-url'}),
            content_type='application/json'
        )

        data = response.json()
        self.assertEqual(data['status'], 'ERROR')

    def test_add_channel_duplicate_reactivates(self):
        """비활성화된 동일 URL 채널 재추가 시 활성화"""
        self.client.login(username='testauthor', password='testpass123')
        channel = WebhookSubscription.objects.create(
            author=self.profile,
            webhook_url='https://discord.com/api/webhooks/789/ghi',
            is_active=False,
            failure_count=3
        )

        response = self.client.post(
            '/v1/webhook/channels',
            data=json.dumps({
                'webhook_url': 'https://discord.com/api/webhooks/789/ghi',
                'name': 'Reactivated'
            }),
            content_type='application/json'
        )

        data = response.json()
        self.assertEqual(data['status'], 'DONE')
        channel.refresh_from_db()
        self.assertTrue(channel.is_active)
        self.assertEqual(channel.failure_count, 0)

    def test_delete_channel(self):
        """채널 삭제"""
        self.client.login(username='testauthor', password='testpass123')
        channel = WebhookSubscription.objects.create(
            author=self.profile,
            webhook_url='https://discord.com/api/webhooks/del/ete'
        )

        response = self.client.delete(f'/v1/webhook/channels/{channel.id}')

        data = response.json()
        self.assertEqual(data['status'], 'DONE')
        self.assertFalse(WebhookSubscription.objects.filter(id=channel.id).exists())

    def test_delete_channel_other_user(self):
        """타인의 채널 삭제 시도 시 실패"""
        channel = WebhookSubscription.objects.create(
            author=self.other_profile,
            webhook_url='https://discord.com/api/webhooks/other/user'
        )

        self.client.login(username='testauthor', password='testpass123')
        response = self.client.delete(f'/v1/webhook/channels/{channel.id}')

        data = response.json()
        self.assertEqual(data['status'], 'ERROR')
        self.assertTrue(WebhookSubscription.objects.filter(id=channel.id).exists())

    def test_add_channel_not_logged_in(self):
        """비로그인 시 채널 추가 실패"""
        response = self.client.post(
            '/v1/webhook/channels',
            data=json.dumps({'webhook_url': 'https://discord.com/api/webhooks/no/auth'}),
            content_type='application/json'
        )

        data = response.json()
        self.assertEqual(data['status'], 'ERROR')
        self.assertIn('NL', data['errorCode'])

    def test_add_channel_missing_url(self):
        """URL 없이 채널 추가 시 실패"""
        self.client.login(username='testauthor', password='testpass123')

        response = self.client.post(
            '/v1/webhook/channels',
            data=json.dumps({'name': 'No URL Channel'}),
            content_type='application/json'
        )

        data = response.json()
        self.assertEqual(data['status'], 'ERROR')

    def test_delete_channel_not_logged_in(self):
        """비로그인 시 채널 삭제 실패"""
        channel = WebhookSubscription.objects.create(
            author=self.profile,
            webhook_url='https://discord.com/api/webhooks/no/auth/del'
        )

        response = self.client.delete(f'/v1/webhook/channels/{channel.id}')

        data = response.json()
        self.assertEqual(data['status'], 'ERROR')
        self.assertTrue(WebhookSubscription.objects.filter(id=channel.id).exists())

    def test_delete_channel_not_found(self):
        """존재하지 않는 채널 삭제 시 실패"""
        self.client.login(username='testauthor', password='testpass123')

        response = self.client.delete('/v1/webhook/channels/99999')

        data = response.json()
        self.assertEqual(data['status'], 'ERROR')

    @patch('board.services.webhook_service.WebhookService.test_webhook')
    def test_test_webhook(self, mock_test):
        """웹훅 테스트 메시지 전송"""
        mock_test.return_value = True
        self.client.login(username='testauthor', password='testpass123')

        response = self.client.post(
            '/v1/webhook/test',
            data=json.dumps({'webhook_url': 'https://discord.com/api/webhooks/test/url'}),
            content_type='application/json'
        )

        data = response.json()
        self.assertEqual(data['status'], 'DONE')
        self.assertTrue(data['body']['success'])

    @patch('board.services.webhook_service.WebhookService.test_webhook')
    def test_test_webhook_failure(self, mock_test):
        """웹훅 테스트 실패 시 실패 응답"""
        mock_test.return_value = False
        self.client.login(username='testauthor', password='testpass123')

        response = self.client.post(
            '/v1/webhook/test',
            data=json.dumps({'webhook_url': 'https://invalid.webhook/url'}),
            content_type='application/json'
        )

        data = response.json()
        self.assertEqual(data['status'], 'DONE')
        self.assertFalse(data['body']['success'])


class WebhookNotificationTestCase(TestCase):
    """포스트 발행 시 웹훅 알림 테스트"""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='author',
            email='author@example.com',
            password='testpass123'
        )
        cls.profile = Profile.objects.create(user=cls.user)
        cls.post = Post.objects.create(
            author=cls.user,
            title='Test Post',
            url='test-post',
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=cls.post,
            text_md='Test content',
            text_html='<p>Test content</p>'
        )

    @patch('board.services.webhook_service.SubTaskProcessor.process')
    def test_notify_channels_on_publish(self, mock_process):
        """글 발행 시 웹훅 알림 전송"""
        WebhookSubscription.objects.create(
            author=self.profile,
            webhook_url='https://discord.com/api/webhooks/notify/test'
        )
        post_config = PostConfig.objects.create(post=self.post, hide=False)

        WebhookService.notify_channels(self.post, post_config)

        mock_process.assert_called_once()

    @patch('board.services.webhook_service.SubTaskProcessor.process')
    def test_no_notify_hidden_post(self, mock_process):
        """숨긴 글은 웹훅 알림 전송 안함"""
        WebhookSubscription.objects.create(
            author=self.profile,
            webhook_url='https://discord.com/api/webhooks/hidden/test'
        )
        post_config = PostConfig.objects.create(post=self.post, hide=True)

        WebhookService.notify_channels(self.post, post_config)

        mock_process.assert_not_called()


class WebhookFailureTrackingTestCase(TestCase):
    """웹훅 실패 추적 및 자동 비활성화 테스트"""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='failtest',
            email='fail@example.com',
            password='testpass123'
        )
        cls.profile = Profile.objects.create(user=cls.user)

    def setUp(self):
        self.channel = WebhookSubscription.objects.create(
            author=self.profile,
            webhook_url=f'https://discord.com/api/webhooks/fail/{id(self)}'
        )

    @patch('board.services.webhook_service.WebhookService.send_webhook')
    def test_auto_deactivate_after_3_failures(self, mock_send):
        """3회 연속 실패 시 자동 비활성화"""
        mock_send.return_value = False

        for _ in range(3):
            WebhookService.send_webhook_with_tracking(
                channel=self.channel,
                content='Test',
                post_url='https://example.com'
            )

        self.channel.refresh_from_db()
        self.assertFalse(self.channel.is_active)
        self.assertEqual(self.channel.failure_count, 3)

    @patch('board.services.webhook_service.WebhookService.send_webhook')
    def test_success_resets_failure_count(self, mock_send):
        """성공 시 실패 횟수 초기화"""
        self.channel.failure_count = 2
        self.channel.save()
        mock_send.return_value = True

        WebhookService.send_webhook_with_tracking(
            channel=self.channel,
            content='Test',
            post_url='https://example.com'
        )

        self.channel.refresh_from_db()
        self.assertEqual(self.channel.failure_count, 0)
        self.assertIsNotNone(self.channel.last_success_date)
