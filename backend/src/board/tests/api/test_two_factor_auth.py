import json
import pyotp

from unittest.mock import patch
from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from board.models import User, Profile, Config, TwoFactorAuth


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
        Profile.objects.create(user=user, role=Profile.Role.READER)
        Config.objects.create(user=user)

    def tearDown(self):
        # Clear cache after each test to prevent rate limiting interference
        cache.clear()
        super().tearDown()

    def test_enable_2fa_success(self):
        """2FA 활성화 성공 테스트"""
        self.client.login(username='test2fa', password='test2fa')

        # Step 1: Initialize 2FA setup
        response = self.client.post('/v1/auth/security')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        # Check QR code and recovery key are returned
        self.assertIn('qrCode', content['body'])
        self.assertIn('recoveryKey', content['body'])
        self.assertTrue(content['body']['qrCode'].startswith('data:image/png;base64,'))
        self.assertEqual(len(content['body']['recoveryKey']), 45)

        # At this point, 2FA should NOT be saved to database yet
        user = User.objects.get(username='test2fa')
        self.assertFalse(hasattr(user, 'twofactorauth'))

        # Step 2: Verify with TOTP code
        # Get the secret from session and generate valid code
        session = self.client.session
        totp_secret = session['totp_setup']['secret']
        totp = pyotp.TOTP(totp_secret)
        valid_code = totp.now()

        response = self.client.post(
            '/v1/auth/security/verify',
            data=json.dumps({'code': valid_code}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        # NOW the TwoFactorAuth record should be created
        user = User.objects.get(username='test2fa')
        self.assertTrue(hasattr(user, 'twofactorauth'))
        self.assertEqual(len(user.twofactorauth.recovery_key), 45)
        self.assertIsNotNone(user.twofactorauth.totp_secret)
        self.assertGreater(len(user.twofactorauth.totp_secret), 0)

    def test_enable_2fa_invalid_verification_code(self):
        """잘못된 TOTP 코드로 2FA 설정 완료 시도 테스트"""
        self.client.login(username='test2fa', password='test2fa')

        # Initialize 2FA setup
        response = self.client.post('/v1/auth/security')
        self.assertEqual(response.status_code, 200)

        # Try to verify with invalid code
        response = self.client.post(
            '/v1/auth/security/verify',
            data=json.dumps({'code': '999999'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

        # 2FA should not be saved
        user = User.objects.get(username='test2fa')
        self.assertFalse(hasattr(user, 'twofactorauth'))

    def test_enable_2fa_already_enabled(self):
        """이미 2FA가 활성화된 상태에서 재활성화 시도 테스트"""
        user = User.objects.get(username='test2fa')
        TwoFactorAuth.objects.create(
            user=user,
            recovery_key='x' * 45,
            totp_secret=pyotp.random_base32()
        )

        self.client.login(username='test2fa', password='test2fa')

        response = self.client.post('/v1/auth/security')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:AC')

    @override_settings(DEBUG=False)
    def test_login_with_2fa_enabled(self):
        """2FA가 활성화된 사용자의 로그인 테스트"""
        user = User.objects.get(username='test2fa')
        TwoFactorAuth.objects.create(
            user=user,
            recovery_key='y' * 45,
            totp_secret=pyotp.random_base32()
        )

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
        TwoFactorAuth.objects.create(
            user=user,
            recovery_key='z' * 45,
            totp_secret=pyotp.random_base32()
        )

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

    def test_disable_2fa_too_soon(self):
        """2FA 활성화 후 24시간 이내 비활성화 시도 테스트"""
        user = User.objects.get(username='test2fa')
        # Create 2FA record with recent created_date
        two_factor_auth = TwoFactorAuth.objects.create(
            user=user,
            recovery_key='f' * 45,
            totp_secret=pyotp.random_base32()
        )
        two_factor_auth.created_date = timezone.now()
        two_factor_auth.save()

        self.client.login(username='test2fa', password='test2fa')

        response = self.client.delete('/v1/auth/security')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_disable_2fa_after_24_hours(self):
        """2FA 활성화 후 24시간 이후 비활성화 테스트"""
        user = User.objects.get(username='test2fa')
        # Create 2FA record with old created_date (more than 24 hours ago)
        two_factor_auth = TwoFactorAuth.objects.create(
            user=user,
            recovery_key='g' * 45,
            totp_secret=pyotp.random_base32()
        )
        two_factor_auth.created_date = timezone.now() - timedelta(days=2)
        two_factor_auth.save()

        self.client.login(username='test2fa', password='test2fa')

        response = self.client.delete('/v1/auth/security')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        # Verify TwoFactorAuth record was deleted
        user = User.objects.get(username='test2fa')
        self.assertFalse(hasattr(user, 'twofactorauth'))

    def test_disable_2fa_not_enabled(self):
        """2FA가 활성화되지 않은 상태에서 비활성화 시도 테스트"""
        self.client.login(username='test2fa', password='test2fa')

        response = self.client.delete('/v1/auth/security')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:AU')

    @override_settings(DEBUG=False)
    def test_login_with_valid_2fa_code(self):
        """2FA가 활성화된 사용자가 올바른 TOTP 코드로 로그인 성공 테스트"""
        user = User.objects.get(username='test2fa')
        totp_secret = pyotp.random_base32()
        TwoFactorAuth.objects.create(
            user=user,
            recovery_key='a' * 45,
            totp_secret=totp_secret
        )

        # Generate valid TOTP code
        totp = pyotp.TOTP(totp_secret)
        valid_code = totp.now()

        # First login - should return security requirement
        response = self.client.post('/v1/login', {
            'username': 'test2fa',
            'password': 'test2fa',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['security'], True)

        # User should not be logged in yet
        response = self.client.get('/v1/login')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

        # Second login with valid TOTP code - should succeed
        response = self.client.post('/v1/login', {
            'username': 'test2fa',
            'password': 'test2fa',
            'code': valid_code,
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test2fa')
        self.assertNotIn('security', content['body'])

        # Verify user is now logged in
        response = self.client.get('/v1/login')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test2fa')

    @override_settings(DEBUG=False)
    def test_login_with_invalid_2fa_code(self):
        """2FA가 활성화된 사용자가 잘못된 TOTP 코드로 로그인 실패 테스트"""
        user = User.objects.get(username='test2fa')
        totp_secret = pyotp.random_base32()
        TwoFactorAuth.objects.create(
            user=user,
            recovery_key='b' * 45,
            totp_secret=totp_secret
        )

        # First login - should return security requirement
        response = self.client.post('/v1/login', {
            'username': 'test2fa',
            'password': 'test2fa',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['security'], True)

        # Second login with invalid TOTP code - should fail
        response = self.client.post('/v1/login', {
            'username': 'test2fa',
            'password': 'test2fa',
            'code': '000000',  # Invalid code
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
        self.assertIn('2차 인증 코드가 올바르지 않습니다', content['errorMessage'])

        # Verify user is still not logged in
        response = self.client.get('/v1/login')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    @override_settings(DEBUG=False)
    def test_2fa_rate_limiting(self):
        """2FA 코드 5번 실패 시 rate limiting 테스트"""
        user = User.objects.get(username='test2fa')
        totp_secret = pyotp.random_base32()
        TwoFactorAuth.objects.create(
            user=user,
            recovery_key='c' * 45,
            totp_secret=totp_secret
        )

        # Fail 5 times with invalid password (not TOTP)
        # This will increment the rate limit counter
        for i in range(5):
            response = self.client.post('/v1/login', {
                'username': 'test2fa',
                'password': 'wrongpassword',
            })
            self.assertEqual(response.status_code, 200)
            content = json.loads(response.content)
            self.assertEqual(content['status'], 'ERROR')
            self.assertEqual(content['errorCode'], 'error:AT')

        # 6th attempt should be blocked by rate limiting even with correct password
        response = self.client.post('/v1/login', {
            'username': 'test2fa',
            'password': 'test2fa',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
        self.assertIn('너무 많은 실패', content['errorMessage'])
