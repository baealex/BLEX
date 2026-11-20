import json
from unittest.mock import patch, MagicMock
from datetime import timedelta

from django.test import Client, TestCase, override_settings
from django.utils import timezone

from board.models import Config, IntegrationSetting, Profile, TelegramSync, User
from board.services.integration_setting_service import IntegrationSettingService
from board.services.telegram_webhook_service import TelegramWebhookService


WEBHOOK_HEADERS = {
    'HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN': TelegramWebhookService.create_secret('test_bot_token'),
}


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
        self.configure_telegram_bot()

    def configure_telegram_bot(self):
        setting = IntegrationSetting.get_instance()
        setting.telegram_enabled = True
        setting.telegram_bot_username = 'test_bot'
        setting.telegram_bot_token = IntegrationSettingService.encrypt_secret('test_bot_token')
        setting.save()

    # POST /v1/telegram/makeToken - Generate telegram sync token
    def test_make_token_creates_new_sync(self):
        """텔레그램 연동 토큰 생성 (새 연동)"""
        self.client.login(username='testuser', password='testpass')

        response = self.client.post('/v1/telegram/makeToken')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)

        self.assertIn('token', content['body'])
        self.assertEqual(len(content['body']['token']), 6)
        self.assertEqual(
            content['body']['link'],
            f"https://t.me/test_bot?start={content['body']['token']}",
        )
        self.assertTrue(content['body']['qrCode'].startswith('data:image/png;base64,'))

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
        self.assertEqual(sync.get_decrypted_tid(), '123456')

    def test_make_token_generates_unique_tokens(self):
        """여러 사용자의 토큰이 고유하게 생성됨"""
        # Create multiple users and generate tokens
        tokens = set()

        for i in range(5):
            user = User.objects.create_user(
                username=f'user{i}',
                password='testpass',
                email=f'user{i}@test.com',
            )
            Profile.objects.create(user=user, role=Profile.Role.EDITOR)
            Config.objects.create(user=user)

            self.client.login(username=f'user{i}', password='testpass')
            response = self.client.post('/v1/telegram/makeToken')
            content = json.loads(response.content)
            tokens.add(content['body']['token'])
            self.client.logout()

        # All tokens should be unique
        self.assertEqual(len(tokens), 5)

    def test_make_token_requires_login(self):
        """토큰 생성은 로그인 필요"""
        response = self.client.post('/v1/telegram/makeToken')
        # Should fail without login
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_integration_status_includes_bot_configuration(self):
        """사용자 텔레그램 화면에 필요한 봇 설정 상태 반환"""
        self.client.login(username='testuser', password='testpass')

        response = self.client.get('/v1/setting/integration-telegram')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertFalse(content['body']['isConnected'])
        self.assertTrue(content['body']['isConfigured'])
        self.assertEqual(content['body']['botUsername'], 'test_bot')

    def test_make_token_requires_telegram_bot_configuration(self):
        """텔레그램 봇 설정이 없으면 토큰을 만들지 않음"""
        setting = IntegrationSetting.get_instance()
        setting.telegram_enabled = False
        setting.telegram_bot_username = ''
        setting.telegram_bot_token = ''
        setting.save()
        self.client.login(username='testuser', password='testpass')

        response = self.client.post('/v1/telegram/makeToken')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NT')

    # POST /v1/telegram/webHook - Telegram webhook handler
    @override_settings(SITE_URL='https://test.com')
    @patch('board.views.api.v1.telegram.TelegramBot')
    @patch('modules.sub_task.SubTaskProcessor.process')
    def test_webhook_successful_sync(self, mock_subtask, mock_telegram):
        """웹훅을 통한 텔레그램 연동 성공"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        # Create a sync token (not expired)
        sync = TelegramSync.objects.create(
            user=self.user,
            auth_token='ABC123',
            auth_token_exp=timezone.now() + timedelta(minutes=5)
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
            content_type='application/json',
            **WEBHOOK_HEADERS,
        )

        self.assertEqual(response.status_code, 200)

        # Verify sync was updated - DB 상태 검증
        sync.refresh_from_db()
        self.assertEqual(sync.get_decrypted_tid(), '987654321')
        self.assertEqual(sync.auth_token, '')  # Token should be cleared
        mock_subtask.assert_called_once_with(
            mock_bot.send_message,
            987654321,
            '정상적으로 연동되었습니다.',
        )
        mock_bot.send_message.assert_not_called()

    @override_settings(SITE_URL='https://test.com')
    @patch('board.views.api.v1.telegram.TelegramBot')
    @patch('modules.sub_task.SubTaskProcessor.process')
    def test_webhook_expired_token(self, mock_subtask, mock_telegram):
        """만료된 토큰으로 연동 시도"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        sync = TelegramSync.objects.create(
            user=self.user,
            auth_token='EXPIRED',
            auth_token_exp=timezone.now() - timedelta(minutes=1),
        )

        webhook_data = {
            'message': {
                'from': {
                    'id': 987654321
                },
                'text': 'EXPIRED'
            }
        }

        response = self.client.post(
            '/v1/telegram/webHook',
            data=json.dumps(webhook_data),
            content_type='application/json',
            **WEBHOOK_HEADERS,
        )

        self.assertEqual(response.status_code, 200)

        # Verify token was cleared but tid was not set - DB 상태 검증
        sync.refresh_from_db()
        self.assertEqual(sync.auth_token, '')
        self.assertEqual(sync.tid, '')  # tid should remain empty when expired

    @override_settings(SITE_URL='https://test.com')
    @patch('board.views.api.v1.telegram.TelegramBot')
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
            content_type='application/json',
            **WEBHOOK_HEADERS,
        )

        # Should handle gracefully
        self.assertEqual(response.status_code, 200)

        # No TelegramSync should be created
        self.assertFalse(TelegramSync.objects.filter(tid='987654321').exists())

    @patch('board.views.api.v1.telegram.TelegramBot')
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
            content_type='application/json',
            **WEBHOOK_HEADERS,
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

        # Verify sync was deleted - DB 상태 검증
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

    def test_make_token_sets_expiration_time(self):
        """토큰 생성 시 만료 시간 설정"""
        self.client.login(username='testuser', password='testpass')

        before_time = timezone.now()
        response = self.client.post('/v1/telegram/makeToken')
        after_time = timezone.now()

        self.assertEqual(response.status_code, 200)

        sync = TelegramSync.objects.get(user=self.user)
        self.assertGreaterEqual(sync.auth_token_exp, before_time + timedelta(hours=24))
        self.assertLessEqual(sync.auth_token_exp, after_time + timedelta(hours=24))

    @override_settings(SITE_URL='https://example.com')
    @patch('board.views.api.v1.telegram.TelegramBot')
    @patch('modules.sub_task.SubTaskProcessor.process')
    def test_webhook_with_no_matching_token(self, mock_subtask, mock_telegram):
        """매칭되는 토큰이 없는 경우"""
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
            content_type='application/json',
            **WEBHOOK_HEADERS,
        )

        self.assertEqual(response.status_code, 200)

        # No sync should be created or modified
        self.assertEqual(TelegramSync.objects.count(), 0)

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

        # Should be deleted - DB 상태 검증
        self.assertFalse(TelegramSync.objects.filter(id=sync.id).exists())

    @patch('board.views.api.v1.telegram.TelegramBot')
    @patch('modules.sub_task.SubTaskProcessor.process')
    def test_webhook_links_account_from_deep_link_start_command(self, mock_subtask, mock_telegram):
        """딥링크로 들어와 시작을 누르면 "/start 코드"가 오고, 그대로 연동된다."""
        sync = TelegramSync.objects.create(
            user=self.user,
            auth_token='ABC123',
            auth_token_exp=timezone.now() + timedelta(minutes=5),
        )

        response = self.client.post(
            '/v1/telegram/webHook',
            data=json.dumps({'message': {'from': {'id': 987654321}, 'text': '/start ABC123'}}),
            content_type='application/json',
            **WEBHOOK_HEADERS,
        )

        self.assertEqual(response.status_code, 200)
        sync.refresh_from_db()
        self.assertEqual(sync.get_decrypted_tid(), '987654321')
        self.assertEqual(sync.auth_token, '')

    @patch('board.views.api.v1.telegram.TelegramBot')
    @patch('modules.sub_task.SubTaskProcessor.process')
    def test_webhook_bare_start_does_not_touch_connected_accounts(self, mock_subtask, mock_telegram):
        """코드 없는 /start가 이미 연동된(auth_token이 빈) 계정을 덮어쓰지 않는다."""
        sync = TelegramSync.objects.create(user=self.user, tid='111', auth_token='')

        response = self.client.post(
            '/v1/telegram/webHook',
            data=json.dumps({'message': {'from': {'id': 222}, 'text': '/start'}}),
            content_type='application/json',
            **WEBHOOK_HEADERS,
        )

        self.assertEqual(response.status_code, 200)
        sync.refresh_from_db()
        self.assertEqual(sync.get_decrypted_tid(), '111')

    @patch('board.views.api.v1.telegram.TelegramBot')
    @patch('modules.sub_task.SubTaskProcessor.process')
    def test_webhook_rejects_requests_without_telegram_secret(self, mock_subtask, mock_telegram):
        sync = TelegramSync.objects.create(
            user=self.user,
            auth_token='ABC123',
            auth_token_exp=timezone.now() + timedelta(minutes=5),
        )
        webhook_data = json.dumps({'message': {'from': {'id': 987654321}, 'text': 'ABC123'}})

        missing = self.client.post('/v1/telegram/webHook', data=webhook_data, content_type='application/json')
        wrong = self.client.post(
            '/v1/telegram/webHook',
            data=webhook_data,
            content_type='application/json',
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN='forged',
        )

        self.assertEqual(missing.status_code, 403)
        self.assertEqual(wrong.status_code, 403)
        sync.refresh_from_db()
        self.assertEqual(sync.tid, '')
        self.assertEqual(sync.auth_token, 'ABC123')
        mock_subtask.assert_not_called()

    @patch('board.views.api.v1.telegram.TelegramBot')
    @patch('modules.sub_task.SubTaskProcessor.process')
    def test_webhook_is_reachable_without_csrf_token(self, mock_subtask, mock_telegram):
        """텔레그램 서버는 CSRF 토큰을 보낼 수 없으므로 웹훅은 CSRF 검사 없이 받는다."""
        sync = TelegramSync.objects.create(
            user=self.user,
            auth_token='ABC123',
            auth_token_exp=timezone.now() + timedelta(minutes=5),
        )
        telegram_server = Client(enforce_csrf_checks=True, HTTP_USER_AGENT='BLEX_TEST')

        response = telegram_server.post(
            '/v1/telegram/webHook',
            data=json.dumps({'message': {'from': {'id': 987654321}, 'text': '/start ABC123'}}),
            content_type='application/json',
            **WEBHOOK_HEADERS,
        )

        self.assertEqual(response.status_code, 200)
        sync.refresh_from_db()
        self.assertEqual(sync.get_decrypted_tid(), '987654321')

    def test_account_actions_still_require_csrf_token(self):
        browser = Client(enforce_csrf_checks=True, HTTP_USER_AGENT='BLEX_TEST')
        browser.login(username='testuser', password='testpass')

        self.assertEqual(browser.post('/v1/telegram/makeToken').status_code, 403)
        self.assertEqual(browser.post('/v1/telegram/unsync').status_code, 403)
        self.assertFalse(TelegramSync.objects.filter(user=self.user).exists())

    @patch('board.views.api.v1.telegram.TelegramBot')
    @patch('modules.sub_task.SubTaskProcessor.process')
    def test_new_code_works_even_if_first_attempt_was_days_ago(self, mock_subtask, mock_telegram):
        """첫 시도가 오래전이어도 새로 발급한 코드는 만료되지 않는다."""
        stale_sync = TelegramSync.objects.create(user=self.user, auth_token='OLD123')
        TelegramSync.objects.filter(id=stale_sync.id).update(
            created_date=timezone.now() - timedelta(days=3),
        )
        self.client.login(username='testuser', password='testpass')
        token = json.loads(self.client.post('/v1/telegram/makeToken').content)['body']['token']

        response = self.client.post(
            '/v1/telegram/webHook',
            data=json.dumps({'message': {'from': {'id': 987654321}, 'text': f'/start {token}'}}),
            content_type='application/json',
            **WEBHOOK_HEADERS,
        )

        self.assertEqual(response.status_code, 200)
        stale_sync.refresh_from_db()
        self.assertEqual(stale_sync.get_decrypted_tid(), '987654321')

    @patch('board.views.api.v1.telegram.TelegramBot')
    @patch('modules.sub_task.SubTaskProcessor.process')
    def test_code_links_only_the_first_chat_that_sends_it(self, mock_subtask, mock_telegram):
        sync = TelegramSync.objects.create(
            user=self.user,
            auth_token='ABC123',
            auth_token_exp=timezone.now() + timedelta(minutes=5),
        )

        for sender_id in (111, 222):
            self.client.post(
                '/v1/telegram/webHook',
                data=json.dumps({'message': {'from': {'id': sender_id}, 'text': '/start ABC123'}}),
                content_type='application/json',
                **WEBHOOK_HEADERS,
            )

        sync.refresh_from_db()
        self.assertEqual(sync.get_decrypted_tid(), '111')
        self.assertEqual(mock_subtask.call_args_list[0].args[2], '정상적으로 연동되었습니다.')
        self.assertNotEqual(mock_subtask.call_args_list[1].args[2], '정상적으로 연동되었습니다.')
