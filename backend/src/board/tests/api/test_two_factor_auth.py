import base64
import json
import pyotp
import time

from unittest.mock import patch
from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from board.models import User, Profile, Config, TwoFactorAuth
from board.services.auth_service import AuthService
from board.services.two_factor_auth_secret_service import TwoFactorAuthSecretService


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

    @patch.object(AuthService, 'RECOVERY_KEY_ALPHABET', 'x')
    def test_auth_service_recovery_key_facade_keeps_configurable_alphabet(self):
        """기존 AuthService 상수를 바꾸는 호출자도 같은 결과를 얻는다."""
        self.assertEqual(AuthService.create_recovery_key(), 'x' * 45)

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
        qr_png = base64.b64decode(content['body']['qrCode'].split(',', 1)[1])
        self.assertTrue(qr_png.startswith(b'\x89PNG\r\n\x1a\n'))
        self.assertEqual(len(content['body']['recoveryKey']), 45)
        recovery_key = content['body']['recoveryKey']

        # At this point, 2FA should NOT be saved to database yet
        user = User.objects.get(username='test2fa')
        self.assertFalse(hasattr(user, 'twofactorauth'))

        # Step 2: Verify with TOTP code
        # Get the secret from session and generate valid code
        session = self.client.session
        setup_session = session['totp_setup']
        self.assertEqual(set(setup_session), {'secret', 'recovery_key', 'user_id'})
        self.assertEqual(setup_session['user_id'], user.id)
        self.assertEqual(setup_session['recovery_key'], recovery_key)
        totp_secret = setup_session['secret']
        totp = pyotp.TOTP(totp_secret)
        valid_code = totp.now()

        response = self.client.post(
            '/v1/auth/security/verify',
            data=json.dumps({'code': valid_code}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content, {
            'status': 'DONE',
            'body': {'message': '2차 인증이 활성화되었습니다.'},
        })
        self.assertNotIn('totp_setup', self.client.session)

        # NOW the TwoFactorAuth record should be created
        user = User.objects.get(username='test2fa')
        self.assertTrue(hasattr(user, 'twofactorauth'))
        self.assertEqual(len(user.twofactorauth.recovery_key), 64)
        self.assertNotEqual(user.twofactorauth.recovery_key, recovery_key)
        self.assertTrue(user.twofactorauth.verify_recovery_key(recovery_key))
        self.assertNotEqual(user.twofactorauth.totp_secret, totp_secret)
        self.assertEqual(
            TwoFactorAuthSecretService.decrypt_totp_secret(user.twofactorauth.totp_secret),
            totp_secret,
        )

    def test_enable_2fa_accepts_previous_totp_window(self):
        """setup 검증은 기존처럼 앞선 한 TOTP window를 허용한다."""
        self.client.login(username='test2fa', password='test2fa')
        self.client.post('/v1/auth/security')
        secret = self.client.session['totp_setup']['secret']
        previous_window_code = pyotp.TOTP(secret).at(time.time() - 30)

        response = self.client.post(
            '/v1/auth/security/verify',
            data=json.dumps({'code': previous_window_code}),
            content_type='application/json',
        )

        self.assertEqual(json.loads(response.content)['status'], 'DONE')
        self.assertTrue(TwoFactorAuth.objects.filter(user__username='test2fa').exists())

    def test_enable_2fa_expired_setup_session_keeps_error_contract(self):
        """setup session이 없으면 기존 만료 코드와 메시지를 반환한다."""
        self.client.login(username='test2fa', password='test2fa')

        response = self.client.post(
            '/v1/auth/security/verify',
            data=json.dumps({'code': '123456'}),
            content_type='application/json',
        )

        self.assertEqual(json.loads(response.content), {
            'status': 'ERROR',
            'errorCode': 'error:EP',
            'errorMessage': '2FA 설정 세션이 만료되었습니다. 다시 시도해주세요.',
        })

    def test_enable_2fa_rejects_setup_session_owned_by_another_user(self):
        """다른 user_id의 setup session은 기존 인증 오류로 거부한다."""
        self.client.login(username='test2fa', password='test2fa')
        session = self.client.session
        session['totp_setup'] = {
            'secret': pyotp.random_base32(),
            'recovery_key': 'r' * 45,
            'user_id': User.objects.get(username='test2fa').id + 1,
        }
        session.save()

        response = self.client.post(
            '/v1/auth/security/verify',
            data=json.dumps({'code': '123456'}),
            content_type='application/json',
        )

        self.assertEqual(json.loads(response.content), {
            'status': 'ERROR',
            'errorCode': 'error:AT',
            'errorMessage': '잘못된 세션입니다.',
        })
        self.assertIn('totp_setup', self.client.session)

    def test_enable_2fa_already_connected_verify_clears_setup_session(self):
        """verify 전에 이미 활성화됐다면 setup session을 지우고 기존 오류를 반환한다."""
        self.client.login(username='test2fa', password='test2fa')
        self.client.post('/v1/auth/security')
        user = User.objects.get(username='test2fa')
        TwoFactorAuth.objects.create(
            user=user,
            recovery_key='x' * 45,
            totp_secret=pyotp.random_base32(),
        )

        response = self.client.post(
            '/v1/auth/security/verify',
            data=json.dumps({'code': '123456'}),
            content_type='application/json',
        )

        self.assertEqual(json.loads(response.content), {
            'status': 'ERROR',
            'errorCode': 'error:AC',
            'errorMessage': '',
        })
        self.assertNotIn('totp_setup', self.client.session)

    @patch(
        'board.services.two_factor_setup_service.TwoFactorSetupService.generate_qr_code',
        side_effect=ValueError('QR unavailable'),
    )
    def test_enable_2fa_qr_failure_keeps_legacy_error_and_setup_session(self, mock_qr):
        """QR 생성 실패 응답과 QR 전 session 저장 순서를 보존한다."""
        self.client.login(username='test2fa', password='test2fa')

        response = self.client.post('/v1/auth/security')

        self.assertEqual(json.loads(response.content), {
            'status': 'ERROR',
            'errorCode': 'error:RJ',
            'errorMessage': '2FA 설정 초기화에 실패했습니다: QR unavailable',
        })
        self.assertIn('totp_setup', self.client.session)

    def test_enable_2fa_save_failure_rolls_back_partial_activation(self):
        """모델 저장 후 실패해도 2FA row가 남지 않고 setup session을 유지한다."""
        self.client.login(username='test2fa', password='test2fa')
        self.client.post('/v1/auth/security')
        setup_session = self.client.session['totp_setup']
        valid_code = pyotp.TOTP(setup_session['secret']).now()
        original_save = TwoFactorAuth.save

        def fail_after_save(instance, *args, **kwargs):
            original_save(instance, *args, **kwargs)
            raise RuntimeError('persistence failed')

        with patch(
            'board.services.two_factor_setup_service.TwoFactorAuth.save',
            new=fail_after_save,
        ):
            response = self.client.post(
                '/v1/auth/security/verify',
                data=json.dumps({'code': valid_code}),
                content_type='application/json',
            )

        self.assertEqual(json.loads(response.content), {
            'status': 'ERROR',
            'errorCode': 'error:RJ',
            'errorMessage': '2FA 활성화에 실패했습니다: persistence failed',
        })
        self.assertFalse(TwoFactorAuth.objects.filter(user__username='test2fa').exists())
        self.assertIn('totp_setup', self.client.session)

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
        self.assertEqual(content, {
            'status': 'ERROR',
            'errorCode': 'error:RJ',
            'errorMessage': '잘못된 인증 코드입니다.',
        })
        self.assertIn('totp_setup', self.client.session)

        # 2FA should not be saved
        user = User.objects.get(username='test2fa')
        self.assertFalse(hasattr(user, 'twofactorauth'))

    def test_enable_2fa_empty_verification_body_returns_invalid_parameter(self):
        """2FA 설정 완료 요청에서 인증 코드가 없으면 500 대신 API 에러를 반환"""
        self.client.login(username='test2fa', password='test2fa')
        self.client.post('/v1/auth/security')

        response = self.client.post(
            '/v1/auth/security/verify',
            data='',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:IP')

    def test_enable_2fa_non_object_json_body_returns_invalid_parameter(self):
        """2FA 설정 완료 요청에서 JSON 객체가 아니어도 500이 나지 않는다."""
        self.client.login(username='test2fa', password='test2fa')
        self.client.post('/v1/auth/security')

        response = self.client.post(
            '/v1/auth/security/verify',
            data='[]',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:IP')

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

    def test_get_2fa_security_does_not_return_stored_recovery_key(self):
        """2FA 조회 시 저장된 복구 키 원문이나 해시를 반환하지 않는다."""
        user = User.objects.get(username='test2fa')
        TwoFactorAuth.objects.create(
            user=user,
            recovery_key='x' * 45,
            totp_secret=pyotp.random_base32()
        )

        self.client.login(username='test2fa', password='test2fa')

        response = self.client.get('/v1/auth/security')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIn('qrCode', content['body'])
        self.assertNotIn('recoveryKey', content['body'])
        self.assertTrue(content['body']['hasRecoveryKey'])

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
        self.assertEqual(content, {
            'status': 'ERROR',
            'errorCode': 'error:RJ',
            'errorMessage': '24시간 동안 해제할 수 없습니다.',
        })

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
        self.assertEqual(content, {
            'status': 'ERROR',
            'errorCode': 'error:AU',
            'errorMessage': '',
        })

    @override_settings(DEBUG=False)
    def test_login_with_recovery_key(self):
        """2FA가 활성화된 사용자가 복구 키로 로그인 성공 테스트"""
        user = User.objects.get(username='test2fa')
        recovery_key = 'r' * 45
        TwoFactorAuth.objects.create(
            user=user,
            recovery_key=recovery_key,
            totp_secret=pyotp.random_base32()
        )

        response = self.client.post('/v1/login', {
            'username': 'test2fa',
            'password': 'test2fa',
            'code': recovery_key,
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test2fa')

        two_factor_auth = TwoFactorAuth.objects.get(user=user)
        self.assertEqual(len(two_factor_auth.recovery_key), 64)
        self.assertNotEqual(two_factor_auth.recovery_key, recovery_key)

    @override_settings(DEBUG=False)
    def test_login_with_legacy_plaintext_two_factor_values(self):
        """기존 평문 2FA secret과 복구 키도 계속 검증된다."""
        user = User.objects.get(username='test2fa')
        totp_secret = pyotp.random_base32()
        recovery_key = 'legacy-recovery-key-value-over-six-chars'
        two_factor_auth = TwoFactorAuth.objects.create(
            user=user,
            recovery_key='temporary-recovery-key',
            totp_secret=pyotp.random_base32()
        )
        TwoFactorAuth.objects.filter(id=two_factor_auth.id).update(
            recovery_key=recovery_key,
            totp_secret=totp_secret,
        )

        response = self.client.post('/v1/login', {
            'username': 'test2fa',
            'password': 'test2fa',
            'code': pyotp.TOTP(totp_secret).now(),
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        self.client.logout()

        response = self.client.post('/v1/login', {
            'username': 'test2fa',
            'password': 'test2fa',
            'code': recovery_key,
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

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
