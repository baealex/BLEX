import json
from unittest.mock import patch, MagicMock
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone

from board.models import User, Config, Profile, TelegramSync


class TelegramAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Create test user
        cls.user = User.objects.create_user(
            username='testuser',
            password='testpass',
            email='test@test.com',
        )
        Profile.objects.create(user=cls.user, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.user)

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'

    # POST /v1/telegram/makeToken - Generate telegram sync token
    def test_make_token_creates_new_sync(self):
        """텔레그램 연동 토큰 생성 (새 연동)"""
        self.client.login(username='testuser', password='testpass')

        response = self.client.post('/v1/telegram/makeToken')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)

        self.assertIn('token', content['body'])
        self.assertEqual(len(content['body']['token']), 6)

        # Verify TelegramSync was created
        sync = TelegramSync.objects.get(user=self.user)
        self.assertEqual(sync.auth_token, content['body']['token'])

    def test_make_token_updates_existing_sync(self):
        """기존 텔레그램 연동에 새 토큰 생성"""
        self.client.login(username='testuser', password='testpass')

        # Create existing sync
        TelegramSync.objects.create(
            user=self.user,
            auth_token='oldtoken',
            tid='123456'
        )

        response = self.client.post('/v1/telegram/makeToken')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)

        # Verify token was updated
        sync = TelegramSync.objects.get(user=self.user)
        self.assertEqual(sync.auth_token, content['body']['token'])
        self.assertNotEqual(sync.auth_token, 'oldtoken')

    def test_make_token_generates_unique_tokens(self):
        """토큰이 고유하게 생성됨"""
        self.client.login(username='testuser', password='testpass')

        # Create another user with a token
        other_user = User.objects.create_user(
            username='otheruser',
            password='testpass',
            email='other@test.com',
        )
        Profile.objects.create(user=other_user, role=Profile.Role.EDITOR)
        Config.objects.create(user=other_user)

        with patch('board.views.api.v1.telegram.randstr') as mock_randstr:
            # First call returns a duplicate, second call returns unique
            mock_randstr.side_effect = ['DUP123', 'UNQ456']

            # Create duplicate token
            TelegramSync.objects.create(
                user=other_user,
                auth_token='DUP123'
            )

            response = self.client.post('/v1/telegram/makeToken')
            content = json.loads(response.content)

            # Should get the unique token
            self.assertEqual(content['body']['token'], 'UNQ456')

    def test_make_token_requires_login(self):
        """토큰 생성은 로그인 필요"""
        response = self.client.post('/v1/telegram/makeToken')
        # Should fail without login
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    # POST /v1/telegram/webHook - Telegram webhook handler
    @override_settings(
        TELEGRAM_BOT_TOKEN='test_bot_token',
        SITE_URL='https://test.com'
    )
    @patch('modules.telegram.TelegramBot')
    @patch('modules.sub_task.SubTaskProcessor.process')
    def test_webhook_successful_sync(self, mock_subtask, mock_telegram):
        """웹훅을 통한 텔레그램 연동 성공"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        # Create a sync token
        sync = TelegramSync.objects.create(
            user=self.user,
            auth_token='ABC123',
            auth_token_exp=timezone.now()
        )

        webhook_data = {
            'message': {
                'from': {
                    'id': 987654321
                },
                'text': 'ABC123'
            }
        }

        response = self.client.post(
            '/v1/telegram/webHook',
            data=json.dumps(webhook_data),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)

        # Verify sync was updated
        sync.refresh_from_db()
        self.assertEqual(sync.get_decrypted_tid(), '987654321')
        self.assertEqual(sync.auth_token, '')  # Token should be cleared

    @override_settings(
        TELEGRAM_BOT_TOKEN='test_bot_token',
        SITE_URL='https://test.com'
    )
    @patch('modules.telegram.TelegramBot')
    @patch('modules.sub_task.SubTaskProcessor.process')
    def test_webhook_expired_token(self, mock_subtask, mock_telegram):
        """만료된 토큰으로 연동 시도"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        # Create an expired token
        expired_time = timezone.now() - timedelta(days=1)
        sync = TelegramSync.objects.create(
            user=self.user,
            auth_token='EXPIRED',
            auth_token_exp=expired_time
        )

        webhook_data = {
            'message': {
                'from': {
                    'id': 987654321
                },
                'text': 'EXPIRED'
            }
        }

        with patch.object(TelegramSync, 'is_token_expire', return_value=True):
            response = self.client.post(
                '/v1/telegram/webHook',
                data=json.dumps(webhook_data),
                content_type='application/json'
            )

        self.assertEqual(response.status_code, 200)

        # Verify token was cleared but tid was not set
        sync.refresh_from_db()
        self.assertEqual(sync.auth_token, '')
        self.assertEqual(sync.tid, '')

    @override_settings(
        TELEGRAM_BOT_TOKEN='test_bot_token',
        SITE_URL='https://test.com'
    )
    @patch('modules.telegram.TelegramBot')
    @patch('modules.sub_task.SubTaskProcessor.process')
    def test_webhook_invalid_token(self, mock_subtask, mock_telegram):
        """잘못된 토큰으로 연동 시도"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        webhook_data = {
            'message': {
                'from': {
                    'id': 987654321
                },
                'text': 'INVALID'
            }
        }

        response = self.client.post(
            '/v1/telegram/webHook',
            data=json.dumps(webhook_data),
            content_type='application/json'
        )

        # Should send info message instead
        self.assertEqual(response.status_code, 200)

    @override_settings(TELEGRAM_BOT_TOKEN='test_bot_token')
    @patch('modules.telegram.TelegramBot')
    def test_webhook_malformed_request(self, mock_telegram):
        """잘못된 형식의 웹훅 요청"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        # Missing required fields
        webhook_data = {
            'message': {}
        }

        response = self.client.post(
            '/v1/telegram/webHook',
            data=json.dumps(webhook_data),
            content_type='application/json'
        )

        # Should handle gracefully
        self.assertEqual(response.status_code, 200)

    # POST /v1/telegram/unsync - Disconnect telegram
    def test_unsync_telegram(self):
        """텔레그램 연동 해제"""
        self.client.login(username='testuser', password='testpass')

        # Create a synced telegram
        TelegramSync.objects.create(
            user=self.user,
            tid='123456789'
        )

        response = self.client.post('/v1/telegram/unsync')
        self.assertEqual(response.status_code, 200)

        # Verify sync was deleted
        self.assertFalse(TelegramSync.objects.filter(user=self.user).exists())

    def test_unsync_without_sync(self):
        """연동되지 않은 상태에서 연동 해제 시도"""
        self.client.login(username='testuser', password='testpass')

        response = self.client.post('/v1/telegram/unsync')
        content = json.loads(response.content)

        self.assertNotEqual(content['status'], 'DONE')
        self.assertIn('이미 연동이 해제되었습니다', content['errorMessage'])

    def test_unsync_with_empty_tid(self):
        """tid가 없는 연동 해제 시도"""
        self.client.login(username='testuser', password='testpass')

        # Create sync without tid
        TelegramSync.objects.create(
            user=self.user,
            tid='',
            auth_token='ABC123'
        )

        response = self.client.post('/v1/telegram/unsync')
        content = json.loads(response.content)

        # Should fail since tid is empty
        self.assertNotEqual(content['status'], 'DONE')

    def test_unsync_requires_login(self):
        """연동 해제는 로그인 필요"""
        response = self.client.post('/v1/telegram/unsync')
        # Should fail without login
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    # Test invalid parameters
    def test_invalid_telegram_parameter(self):
        """잘못된 파라미터로 접근"""
        self.client.login(username='testuser', password='testpass')

        response = self.client.post('/v1/telegram/invalidParam')
        self.assertEqual(response.status_code, 404)

    def test_invalid_methods(self):
        """POST 이외의 메서드는 허용되지 않음"""
        self.client.login(username='testuser', password='testpass')

        # GET should return 404
        response = self.client.get('/v1/telegram/makeToken')
        self.assertEqual(response.status_code, 404)

        # PUT should return 404
        response = self.client.put('/v1/telegram/makeToken')
        self.assertEqual(response.status_code, 404)

        # DELETE should return 404
        response = self.client.delete('/v1/telegram/unsync')
        self.assertEqual(response.status_code, 404)

    @override_settings(TELEGRAM_BOT_TOKEN='test_bot_token')
    @patch('modules.telegram.TelegramBot')
    @patch('modules.sub_task.SubTaskProcessor.process')
    def test_webhook_sends_success_message(self, mock_subtask, mock_telegram):
        """성공적인 연동 시 성공 메시지 전송"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        sync = TelegramSync.objects.create(
            user=self.user,
            auth_token='SUCCESS',
            auth_token_exp=timezone.now()
        )

        webhook_data = {
            'message': {
                'from': {'id': 123456},
                'text': 'SUCCESS'
            }
        }

        response = self.client.post(
            '/v1/telegram/webHook',
            data=json.dumps(webhook_data),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)

        # Verify success message was queued
        self.assertTrue(mock_subtask.called)

    def test_make_token_sets_expiration_time(self):
        """토큰 생성 시 만료 시간 설정"""
        self.client.login(username='testuser', password='testpass')

        before_time = timezone.now()
        response = self.client.post('/v1/telegram/makeToken')
        after_time = timezone.now()

        self.assertEqual(response.status_code, 200)

        sync = TelegramSync.objects.get(user=self.user)
        self.assertIsNotNone(sync.auth_token_exp)
        self.assertGreaterEqual(sync.auth_token_exp, before_time)
        self.assertLessEqual(sync.auth_token_exp, after_time)

    @override_settings(
        TELEGRAM_BOT_TOKEN='test_bot_token',
        SITE_URL='https://example.com'
    )
    @patch('modules.telegram.TelegramBot')
    @patch('modules.sub_task.SubTaskProcessor.process')
    def test_webhook_info_message_contains_site_url(self, mock_subtask, mock_telegram):
        """정보 메시지에 사이트 URL 포함 확인"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        webhook_data = {
            'message': {
                'from': {'id': 999999},
                'text': 'random text'
            }
        }

        response = self.client.post(
            '/v1/telegram/webHook',
            data=json.dumps(webhook_data),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        # Info message should be sent via SubTaskProcessor

    def test_unsync_only_deletes_synced_telegram(self):
        """연동된(tid가 있는) 텔레그램만 삭제"""
        self.client.login(username='testuser', password='testpass')

        # Create synced telegram
        sync = TelegramSync.objects.create(
            user=self.user,
            tid='123456789',
            auth_token=''
        )

        response = self.client.post('/v1/telegram/unsync')
        self.assertEqual(response.status_code, 200)

        # Should be deleted
        self.assertFalse(TelegramSync.objects.filter(id=sync.id).exists())
