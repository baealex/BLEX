import json

from unittest.mock import patch, MagicMock
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone

from board.models import User, UsernameChangeLog, Profile, Config, TwoFactorAuth, TelegramSync
from modules import oauth


class AuthTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        user = User.objects.create_user(
            username='test',
            password='test',
            email='test@test.com',
            first_name='Test User',
        )
        Profile.objects.create(user=user, role=Profile.Role.EDITOR)
        Config.objects.create(user=user)

    def test_login_not_logged_in_user(self):
        """로그인하지 않은 사용자 테스트"""
        response = self.client.get('/v1/login')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_login(self):
        """로그인 성공 테스트"""
        response = self.client.post('/v1/login', {
            'username': 'test',
            'password': 'test',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test')

        response = self.client.get('/v1/login')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test')

    def test_logout(self):
        """로그아웃 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/login')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        response = self.client.post('/v1/logout')
        self.assertEqual(response.status_code, 200)

        response = self.client.get('/v1/login')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    @override_settings(HCAPTCHA_SECRET_KEY=None)
    def test_create_account(self):
        """계정 생성 테스트"""
        response = self.client.post('/v1/sign', {
            'username': 'test2',
            'password': 'test2',
            'name': 'Test User 2',
            'email': 'test2@test.com'
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        response = self.client.post('/v1/login', {
            'username': 'test2',
            'password': 'test2',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test2')

    def test_delete_account(self):
        """계정 삭제 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.delete('/v1/sign')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        response = self.client.post('/v1/login', {
            'username': 'test',
            'password': 'test',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=True, user={
        'node_id': 'SECRET_TOKEN_VALUE',
        'login': 'test3',
        'name': 'Test User 3',
    }))
    def test_create_account_from_github(self, mock_servuce):
        """GitHub OAuth로 계정 생성 테스트"""
        response = self.client.post('/v1/sign/github', {
            'code': 'SECRET_TOKEN_VALUE',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test3')
        self.assertEqual(content['body']['isFirstLogin'], True)

        self.client.logout()

        response = self.client.post('/v1/sign/github', {
            'code': 'SECRET_TOKEN_VALUE',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test3')
        self.assertEqual(content['body']['isFirstLogin'], False)

    @patch('modules.oauth.auth_google', return_value=oauth.State(success=True, user={
        'id': 'SECRET_TOKEN_VALUE',
        'email': 'test3@google.com',
        'name': 'Test User 3',
    }))
    def test_create_account_from_google(self, mock_servuce):
        """Google OAuth로 계정 생성 테스트"""
        response = self.client.post('/v1/sign/google', {
            'code': 'SECRET_TOKEN_VALUE',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test3')
        self.assertEqual(content['body']['isFirstLogin'], True)

        self.client.logout()

        response = self.client.post('/v1/sign/google', {
            'code': 'SECRET_TOKEN_VALUE',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test3')
        self.assertEqual(content['body']['isFirstLogin'], False)

    def test_change_username(self):
        """유저네임 변경 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.patch('/v1/sign',
            'username=test2'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

    def test_change_username_when_have_post(self):
        """게시글이 있는 사용자의 유저네임 변경 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post 1',
            'text_html': '<h1>Test</h1>',
            'is_hide': False,
            'is_advertise': False,
        })

        response = self.client.patch('/v1/sign',
            'username=test2'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        # 과거의 유저네임 변경 기록이 남아있는지 확인
        user = User.objects.get(username='test2')
        log = UsernameChangeLog.objects.get(user=user)
        self.assertEqual(log.username, 'test')
        self.assertEqual(log.user.username, 'test2')

        # 6개월 이내에 재변경이 불가능한지 확인
        response = self.client.patch('/v1/sign',
            'username=test3'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')


class TwoFactorAuthTestCase(TestCase):
    """2FA (Two-Factor Authentication) 테스트"""

    @classmethod
    def setUpTestData(cls):
        # Create test user
        user = User.objects.create_user(
            username='test2fa',
            password='test2fa',
            email='test2fa@test.com',
            first_name='Test 2FA User',
        )
        Profile.objects.create(user=user, role=Profile.Role.MEMBER)
        Config.objects.create(user=user)

        # Create Telegram sync (required for 2FA)
        TelegramSync.objects.create(
            user=user,
            tid='encrypted_telegram_id_123'
        )

    def test_enable_2fa_without_telegram(self):
        """텔레그램 연동 없이 2FA 활성화 시도 테스트"""
        # Create user without Telegram
        user = User.objects.create_user(
            username='notelgram',
            password='notelgram',
            email='notelgram@test.com',
            first_name='No Telegram',
        )
        Profile.objects.create(user=user, role=Profile.Role.MEMBER)
        Config.objects.create(user=user)

        self.client.login(username='notelgram', password='notelgram')

        response = self.client.post('/v1/auth/security')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NT')

    def test_enable_2fa_success(self):
        """2FA 활성화 성공 테스트"""
        self.client.login(username='test2fa', password='test2fa')

        response = self.client.post('/v1/auth/security')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        # Check if TwoFactorAuth record was created
        user = User.objects.get(username='test2fa')
        self.assertTrue(hasattr(user, 'twofactorauth'))
        self.assertEqual(len(user.twofactorauth.recovery_key), 45)

    def test_enable_2fa_already_enabled(self):
        """이미 2FA가 활성화된 상태에서 재활성화 시도 테스트"""
        user = User.objects.get(username='test2fa')
        TwoFactorAuth.objects.create(user=user, recovery_key='x' * 45)

        self.client.login(username='test2fa', password='test2fa')

        response = self.client.post('/v1/auth/security')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:AC')

    @override_settings(DEBUG=False)
    @patch('modules.telegram.TelegramBot.send_message')
    def test_login_with_2fa_enabled(self, mock_telegram):
        """2FA가 활성화된 사용자의 로그인 테스트"""
        user = User.objects.get(username='test2fa')
        TwoFactorAuth.objects.create(user=user, recovery_key='y' * 45)

        response = self.client.post('/v1/login', {
            'username': 'test2fa',
            'password': 'test2fa',
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test2fa')
        self.assertEqual(content['body']['security'], True)

        # Verify that user is NOT logged in yet
        response = self.client.get('/v1/login')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    @override_settings(DEBUG=True)
    def test_login_with_2fa_debug_mode(self):
        """DEBUG 모드에서 2FA가 활성화된 사용자의 로그인 테스트 (2FA 건너뜀)"""
        user = User.objects.get(username='test2fa')
        TwoFactorAuth.objects.create(user=user, recovery_key='z' * 45)

        response = self.client.post('/v1/login', {
            'username': 'test2fa',
            'password': 'test2fa',
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertNotIn('security', content['body'])

        # Verify that user IS logged in (2FA skipped in DEBUG mode)
        response = self.client.get('/v1/login')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test2fa')

    def test_verify_2fa_with_valid_otp(self):
        """유효한 OTP로 2FA 인증 테스트"""
        user = User.objects.get(username='test2fa')
        two_factor_auth = TwoFactorAuth.objects.create(user=user, recovery_key='a' * 45)
        two_factor_auth.create_token('123456')

        response = self.client.post('/v1/auth/security/send', {
            'code': '123456',
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test2fa')

        # Verify OTP was cleared after successful verification
        two_factor_auth.refresh_from_db()
        self.assertEqual(two_factor_auth.otp, '')

        # Verify user is now logged in
        response = self.client.get('/v1/login')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test2fa')

    def test_verify_2fa_with_expired_otp(self):
        """만료된 OTP로 2FA 인증 테스트"""
        user = User.objects.get(username='test2fa')
        two_factor_auth = TwoFactorAuth.objects.create(user=user, recovery_key='b' * 45)
        two_factor_auth.otp = '123456'
        # Set OTP expiration to 6 minutes ago (OTP expires after 5 minutes)
        two_factor_auth.otp_exp_date = timezone.now() - timedelta(minutes=6)
        two_factor_auth.save()

        response = self.client.post('/v1/auth/security/send', {
            'code': '123456',
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:R')

    def test_verify_2fa_with_invalid_otp(self):
        """잘못된 OTP로 2FA 인증 테스트"""
        user = User.objects.get(username='test2fa')
        two_factor_auth = TwoFactorAuth.objects.create(user=user, recovery_key='c' * 45)
        two_factor_auth.create_token('123456')

        response = self.client.post('/v1/auth/security/send', {
            'code': '999999',  # Wrong OTP
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:R')

        # Verify user is NOT logged in
        response = self.client.get('/v1/login')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_verify_2fa_with_recovery_key(self):
        """복구 키로 2FA 인증 테스트"""
        user = User.objects.get(username='test2fa')
        recovery_key = 'd' * 45
        two_factor_auth = TwoFactorAuth.objects.create(user=user, recovery_key=recovery_key)
        two_factor_auth.create_token('123456')

        response = self.client.post('/v1/auth/security/send', {
            'code': recovery_key,
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test2fa')

        # Verify OTP was cleared after successful verification
        two_factor_auth.refresh_from_db()
        self.assertEqual(two_factor_auth.otp, '')

    def test_2fa_rate_limiting(self):
        """2FA 인증 실패 시 Rate Limiting 테스트"""
        user = User.objects.get(username='test2fa')
        two_factor_auth = TwoFactorAuth.objects.create(user=user, recovery_key='e' * 45)
        two_factor_auth.create_token('123456')

        # Try 5 failed attempts
        for i in range(5):
            response = self.client.post('/v1/auth/security/send', {
                'code': '000000',  # Wrong OTP
            })
            self.assertEqual(response.status_code, 200)

        # 6th attempt should be blocked
        response = self.client.post('/v1/auth/security/send', {
            'code': '123456',  # Even with correct OTP
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        # Should contain rate limiting message
        self.assertIn('차단', content['error'])

    def test_disable_2fa_too_soon(self):
        """2FA 활성화 후 24시간 이내 비활성화 시도 테스트"""
        user = User.objects.get(username='test2fa')
        # Create 2FA record with recent created_date
        two_factor_auth = TwoFactorAuth.objects.create(user=user, recovery_key='f' * 45)
        two_factor_auth.created_date = timezone.now()
        two_factor_auth.save()

        self.client.login(username='test2fa', password='test2fa')

        response = self.client.delete('/v1/auth/security')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:R')

    def test_disable_2fa_after_24_hours(self):
        """2FA 활성화 후 24시간 이후 비활성화 테스트"""
        user = User.objects.get(username='test2fa')
        # Create 2FA record with old created_date (more than 24 hours ago)
        two_factor_auth = TwoFactorAuth.objects.create(user=user, recovery_key='g' * 45)
        two_factor_auth.created_date = timezone.now() - timedelta(days=2)
        two_factor_auth.save()

        self.client.login(username='test2fa', password='test2fa')

        response = self.client.delete('/v1/auth/security')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        # Verify TwoFactorAuth record was deleted
        self.assertFalse(hasattr(user, 'twofactorauth'))

    def test_disable_2fa_not_enabled(self):
        """2FA가 활성화되지 않은 상태에서 비활성화 시도 테스트"""
        self.client.login(username='test2fa', password='test2fa')

        response = self.client.delete('/v1/auth/security')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:AD')
