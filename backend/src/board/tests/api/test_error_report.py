from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings

from board.models import User, Config, Profile


class ErrorReportAPITestCase(TestCase):
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

    @override_settings(
        TELEGRAM_ERROR_REPORT_ID='123456789',
        TELEGRAM_BOT_TOKEN='test_token'
    )
    @patch('board.views.api.v1.report.TelegramBot')
    def test_error_report_with_telegram_configured(self, mock_telegram):
        """텔레그램이 설정된 경우 에러 리포트 전송"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        data = {
            'user': 'testuser',
            'path': '/test/path',
            'content': 'Test error message'
        }

        response = self.client.post('/v1/report/error', data)
        self.assertEqual(response.status_code, 200)

        # Verify Telegram bot was called
        mock_telegram.assert_called_once_with('test_token')
        mock_bot.send_message.assert_called_once()

        # Verify message content
        call_args = mock_bot.send_message.call_args
        chat_id = call_args[0][0]
        message = call_args[0][1]

        self.assertEqual(chat_id, '123456789')
        self.assertIn('ERROR REPORT', message)
        self.assertIn('testuser', message)
        self.assertIn('/test/path', message)
        self.assertIn('Test error message', message)

    @override_settings(
        TELEGRAM_ERROR_REPORT_ID=None,
        TELEGRAM_BOT_TOKEN=None
    )
    def test_error_report_without_telegram_configured(self):
        """텔레그램이 설정되지 않은 경우에도 성공 응답"""
        data = {
            'user': 'testuser',
            'path': '/test/path',
            'content': 'Test error'
        }

        response = self.client.post('/v1/report/error', data)
        self.assertEqual(response.status_code, 200)

    @override_settings(
        TELEGRAM_ERROR_REPORT_ID='123456789',
        TELEGRAM_BOT_TOKEN='test_token'
    )
    @patch('board.views.api.v1.report.TelegramBot')
    def test_error_report_without_user(self, mock_telegram):
        """사용자 정보 없이 에러 리포트"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        data = {
            'path': '/test/path',
            'content': 'Anonymous error'
        }

        response = self.client.post('/v1/report/error', data)
        self.assertEqual(response.status_code, 200)

        # Verify message was sent without user info
        call_args = mock_bot.send_message.call_args
        message = call_args[0][1]
        self.assertIn('Anonymous error', message)

    @override_settings(
        TELEGRAM_ERROR_REPORT_ID='123456789',
        TELEGRAM_BOT_TOKEN='test_token'
    )
    @patch('board.views.api.v1.report.TelegramBot')
    def test_error_report_with_all_fields(self, mock_telegram):
        """모든 필드를 포함한 에러 리포트"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        data = {
            'user': 'testuser',
            'path': '/dashboard',
            'content': 'Detailed error message\nWith multiple lines'
        }

        response = self.client.post(
            '/v1/report/error',
            data,
            HTTP_X_FORWARDED_FOR='192.168.1.1'
        )
        self.assertEqual(response.status_code, 200)

        call_args = mock_bot.send_message.call_args
        message = call_args[0][1]

        # Verify all fields are in message
        self.assertIn('User: testuser', message)
        self.assertIn('Path: /dashboard', message)
        self.assertIn('Location: 192.168.1.1', message)
        self.assertIn('UserAgent: BLEX_TEST', message)
        self.assertIn('Detailed error message', message)

    @override_settings(
        TELEGRAM_ERROR_REPORT_ID='123456789',
        TELEGRAM_BOT_TOKEN='test_token'
    )
    @patch('board.views.api.v1.report.TelegramBot')
    def test_error_report_with_x_forwarded_for(self, mock_telegram):
        """X-Forwarded-For 헤더로부터 IP 추출"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        data = {
            'content': 'Test error'
        }

        # Multiple IPs in X-Forwarded-For
        response = self.client.post(
            '/v1/report/error',
            data,
            HTTP_X_FORWARDED_FOR='192.168.1.1, 10.0.0.1'
        )
        self.assertEqual(response.status_code, 200)

        call_args = mock_bot.send_message.call_args
        message = call_args[0][1]

        # Should use the first IP
        self.assertIn('Location: 192.168.1.1', message)

    @override_settings(
        TELEGRAM_ERROR_REPORT_ID='123456789',
        TELEGRAM_BOT_TOKEN='test_token'
    )
    @patch('board.views.api.v1.report.TelegramBot')
    def test_error_report_with_remote_addr(self, mock_telegram):
        """REMOTE_ADDR로부터 IP 추출"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        data = {
            'content': 'Test error'
        }

        response = self.client.post(
            '/v1/report/error',
            data,
            REMOTE_ADDR='10.0.0.5'
        )
        self.assertEqual(response.status_code, 200)

        call_args = mock_bot.send_message.call_args
        message = call_args[0][1]

        # Should include REMOTE_ADDR
        self.assertIn('Location: 10.0.0.5', message)

    @override_settings(
        TELEGRAM_ERROR_REPORT_ID='123456789',
        TELEGRAM_BOT_TOKEN='test_token'
    )
    @patch('board.views.api.v1.report.TelegramBot')
    def test_error_report_with_user_agent(self, mock_telegram):
        """User-Agent 헤더 포함"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        data = {
            'content': 'Test error'
        }

        custom_user_agent = 'Mozilla/5.0 (Custom Browser)'
        response = self.client.post(
            '/v1/report/error',
            data,
            HTTP_USER_AGENT=custom_user_agent
        )
        self.assertEqual(response.status_code, 200)

        call_args = mock_bot.send_message.call_args
        message = call_args[0][1]

        self.assertIn(f'UserAgent: {custom_user_agent}', message)

    @override_settings(
        TELEGRAM_ERROR_REPORT_ID='123456789',
        TELEGRAM_BOT_TOKEN='test_token'
    )
    @patch('board.views.api.v1.report.TelegramBot')
    def test_error_report_empty_content(self, mock_telegram):
        """빈 에러 내용으로 리포트"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        data = {
            'user': 'testuser',
            'content': ''
        }

        response = self.client.post('/v1/report/error', data)
        self.assertEqual(response.status_code, 200)

        # Should still send message
        mock_bot.send_message.assert_called_once()

    @override_settings(
        TELEGRAM_ERROR_REPORT_ID='123456789',
        TELEGRAM_BOT_TOKEN='test_token'
    )
    @patch('board.views.api.v1.report.TelegramBot')
    def test_error_report_long_content(self, mock_telegram):
        """긴 에러 메시지 리포트"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        long_content = 'Error: ' + 'x' * 5000
        data = {
            'content': long_content
        }

        response = self.client.post('/v1/report/error', data)
        self.assertEqual(response.status_code, 200)

        # Should still send message with long content
        call_args = mock_bot.send_message.call_args
        message = call_args[0][1]
        self.assertIn('Error:', message)

    @override_settings(
        TELEGRAM_ERROR_REPORT_ID='123456789',
        TELEGRAM_BOT_TOKEN='test_token'
    )
    @patch('board.views.api.v1.report.TelegramBot')
    def test_error_report_special_characters(self, mock_telegram):
        """특수 문자가 포함된 에러 리포트"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        data = {
            'user': 'test@user',
            'path': '/path/with/특수문자',
            'content': 'Error: <script>alert("xss")</script>'
        }

        response = self.client.post('/v1/report/error', data)
        self.assertEqual(response.status_code, 200)

        call_args = mock_bot.send_message.call_args
        message = call_args[0][1]

        # Special characters should be preserved
        self.assertIn('test@user', message)
        self.assertIn('특수문자', message)

    def test_error_report_invalid_method(self):
        """POST 이외의 메서드는 허용되지 않음"""
        response = self.client.get('/v1/report/error')
        self.assertEqual(response.status_code, 404)

        response = self.client.put('/v1/report/error', {})
        self.assertEqual(response.status_code, 404)

        response = self.client.delete('/v1/report/error')
        self.assertEqual(response.status_code, 404)

    @override_settings(
        TELEGRAM_ERROR_REPORT_ID='123456789',
        TELEGRAM_BOT_TOKEN='test_token'
    )
    @patch('board.views.api.v1.report.TelegramBot')
    def test_error_report_telegram_failure(self, mock_telegram):
        """텔레그램 전송 실패 시에도 성공 응답"""
        mock_bot = MagicMock()
        mock_bot.send_message.side_effect = Exception('Telegram API error')
        mock_telegram.return_value = mock_bot

        data = {
            'content': 'Test error'
        }

        # Should not raise exception even if Telegram fails
        response = self.client.post('/v1/report/error', data)
        self.assertEqual(response.status_code, 200)

    @override_settings(
        TELEGRAM_ERROR_REPORT_ID='123456789',
        TELEGRAM_BOT_TOKEN='test_token'
    )
    @patch('board.views.api.v1.report.TelegramBot')
    def test_error_report_message_format(self, mock_telegram):
        """에러 리포트 메시지 형식 확인"""
        mock_bot = MagicMock()
        mock_telegram.return_value = mock_bot

        data = {
            'user': 'testuser',
            'path': '/dashboard',
            'content': 'Error message'
        }

        response = self.client.post('/v1/report/error', data)
        self.assertEqual(response.status_code, 200)

        call_args = mock_bot.send_message.call_args
        message = call_args[0][1]

        # Verify message starts with [ERROR REPORT]
        self.assertTrue(message.startswith('[ERROR REPORT]'))

        # Verify proper formatting
        lines = message.split('\n')
        self.assertTrue(any('User:' in line for line in lines))
        self.assertTrue(any('Path:' in line for line in lines))
