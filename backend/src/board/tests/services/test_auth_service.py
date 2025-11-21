"""Tests for AuthService"""

from datetime import timedelta
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.utils import timezone

from board.models import Profile, Config, TwoFactorAuth, TelegramSync
from board.services.auth_service import AuthService, AuthValidationError
from board.modules.response import ErrorCode


class AuthServiceValidationTestCase(TestCase):
    """AuthService 유효성 검사 테스트"""

    def test_validate_username_valid(self):
        """유효한 사용자명 검증 테스트"""
        # Should not raise exception
        AuthService.validate_username('testuser')
        AuthService.validate_username('test1234')
        AuthService.validate_username('abcd')  # 4 chars minimum
        AuthService.validate_username('a' * 15)  # 15 chars maximum

    def test_validate_username_already_exists(self):
        """이미 존재하는 사용자명 검증 테스트"""
        User.objects.create_user(username='existing', password='test')

        with self.assertRaises(AuthValidationError) as context:
            AuthService.validate_username('existing')

        self.assertEqual(context.exception.code, ErrorCode.VALIDATE)
        self.assertIn('이미 사용중인', context.exception.message)

    def test_validate_username_invalid_format(self):
        """잘못된 형식의 사용자명 검증 테스트"""
        invalid_usernames = [
            'abc',  # Too short (< 4 chars)
            'a' * 16,  # Too long (> 15 chars)
            'Test',  # Contains uppercase
            'test-user',  # Contains hyphen
            'test_user',  # Contains underscore
            'test user',  # Contains space
            'test@user',  # Contains special char
        ]

        for username in invalid_usernames:
            with self.assertRaises(AuthValidationError) as context:
                AuthService.validate_username(username)
            self.assertEqual(context.exception.code, ErrorCode.VALIDATE)

    def test_validate_email_valid(self):
        """유효한 이메일 검증 테스트"""
        valid_emails = [
            'test@example.com',
            'user.name@example.co.kr',
            'test+123@example.com',
            'test_user@sub.example.com',
        ]

        for email in valid_emails:
            # Should not raise exception
            AuthService.validate_email(email)

    def test_validate_email_invalid(self):
        """잘못된 이메일 검증 테스트"""
        invalid_emails = [
            'notanemail',
            '@example.com',
            'test@',
            'test @example.com',  # Contains space
            'test@example',  # Missing TLD
        ]

        for email in invalid_emails:
            with self.assertRaises(AuthValidationError) as context:
                AuthService.validate_email(email)
            self.assertEqual(context.exception.code, ErrorCode.VALIDATE)


class AuthServiceUserManagementTestCase(TestCase):
    """AuthService 사용자 관리 테스트"""

    def test_generate_unique_username(self):
        """고유 사용자명 생성 테스트"""
        username = AuthService.generate_unique_username('testuser')
        self.assertEqual(username, 'testuser')

        # Create user with the same username
        User.objects.create_user(username='testuser', password='test')

        # Should generate testuser1
        username = AuthService.generate_unique_username('testuser')
        self.assertEqual(username, 'testuser1')

        # Create testuser1
        User.objects.create_user(username='testuser1', password='test')

        # Should generate testuser2
        username = AuthService.generate_unique_username('testuser')
        self.assertEqual(username, 'testuser2')

    def test_create_user_basic(self):
        """기본 사용자 생성 테스트"""
        user, profile, config = AuthService.create_user(
            username='newuser',
            name='New User',
            email='newuser@test.com',
            password='testpassword'
        )

        self.assertIsNotNone(user)
        self.assertEqual(user.username, 'newuser')
        self.assertEqual(user.first_name, 'New User')
        self.assertEqual(user.email, 'newuser@test.com')
        self.assertTrue(user.check_password('testpassword'))

        # Check profile was created
        self.assertIsNotNone(profile)
        self.assertEqual(profile.user, user)

        # Check config was created
        self.assertIsNotNone(config)
        self.assertEqual(config.user, user)

    def test_create_user_duplicate_username(self):
        """중복된 사용자명으로 사용자 생성 테스트 (자동으로 고유한 이름 생성)"""
        AuthService.create_user(
            username='duplicate',
            name='User 1',
            email='user1@test.com',
            password='test'
        )

        user2, _, _ = AuthService.create_user(
            username='duplicate',
            name='User 2',
            email='user2@test.com',
            password='test'
        )

        # Should automatically get unique username
        self.assertEqual(user2.username, 'duplicate1')

    def test_create_user_with_token(self):
        """토큰과 함께 사용자 생성 테스트 (OAuth)"""
        user, _, _ = AuthService.create_user(
            username='oauthuser',
            name='OAuth User',
            email='oauth@test.com',
            token='github:node123'
        )

        self.assertEqual(user.last_name, 'github:node123')

    def test_change_username(self):
        """사용자명 변경 테스트"""
        user = User.objects.create_user(
            username='oldname',
            password='test',
            email='test@test.com',
            first_name='Test User'
        )

        AuthService.change_username(user, 'newname')

        user.refresh_from_db()
        self.assertEqual(user.username, 'newname')

    def test_change_username_invalid(self):
        """잘못된 사용자명으로 변경 시도 테스트"""
        user = User.objects.create_user(
            username='testuser',
            password='test',
            email='test@test.com'
        )

        with self.assertRaises(AuthValidationError):
            AuthService.change_username(user, 'BAD')  # Uppercase

    def test_change_password(self):
        """비밀번호 변경 테스트"""
        user = User.objects.create_user(
            username='testuser',
            password='oldpassword',
            email='test@test.com'
        )

        AuthService.change_password(user, 'oldpassword', 'newpassword')

        user.refresh_from_db()
        self.assertTrue(user.check_password('newpassword'))
        self.assertFalse(user.check_password('oldpassword'))

    def test_change_password_wrong_old_password(self):
        """잘못된 기존 비밀번호로 변경 시도 테스트"""
        user = User.objects.create_user(
            username='testuser',
            password='correctpassword',
            email='test@test.com'
        )

        with self.assertRaises(AuthValidationError) as context:
            AuthService.change_password(user, 'wrongpassword', 'newpassword')

        self.assertEqual(context.exception.code, ErrorCode.VALIDATE)


class AuthServiceTwoFactorAuthTestCase(TestCase):
    """AuthService 2FA 관련 테스트"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='test2fa',
            password='test',
            email='test@test.com',
            first_name='Test User'
        )
        Profile.objects.create(user=self.user)
        Config.objects.create(user=self.user)
        TelegramSync.objects.create(user=self.user, tid='telegram123')

    @override_settings(DEBUG=True)
    def test_check_two_factor_auth_debug_mode(self):
        """DEBUG 모드에서 2FA 체크 테스트 (항상 False 반환)"""
        TwoFactorAuth.objects.create(user=self.user, recovery_key='a' * 45)

        result = AuthService.check_two_factor_auth(self.user)
        self.assertFalse(result)

    @override_settings(DEBUG=False)
    def test_check_two_factor_auth_enabled(self):
        """2FA가 활성화된 경우 체크 테스트"""
        TwoFactorAuth.objects.create(user=self.user, recovery_key='b' * 45)

        result = AuthService.check_two_factor_auth(self.user)
        self.assertTrue(result)

    @override_settings(DEBUG=False)
    def test_check_two_factor_auth_disabled(self):
        """2FA가 비활성화된 경우 체크 테스트"""
        result = AuthService.check_two_factor_auth(self.user)
        self.assertFalse(result)

    @patch('modules.telegram.TelegramBot.send_message')
    def test_send_2fa_token(self, mock_send):
        """2FA 토큰 전송 테스트"""
        TwoFactorAuth.objects.create(user=self.user, recovery_key='c' * 45)

        AuthService.send_2fa_token(self.user)

        # Note: send_2fa_token uses SubTaskProcessor, so we can't easily verify
        # the token was sent. This test mainly ensures no exceptions are raised.

    def test_verify_2fa_token_with_valid_otp(self):
        """유효한 OTP로 2FA 검증 테스트"""
        two_factor_auth = TwoFactorAuth.objects.create(user=self.user, recovery_key='d' * 45)
        two_factor_auth.create_token('123456')

        result = AuthService.verify_2fa_token(self.user, '123456')

        self.assertTrue(result)

        # Verify OTP was cleared
        two_factor_auth.refresh_from_db()
        self.assertEqual(two_factor_auth.otp, '')

    def test_verify_2fa_token_with_expired_otp(self):
        """만료된 OTP로 2FA 검증 테스트"""
        two_factor_auth = TwoFactorAuth.objects.create(user=self.user, recovery_key='e' * 45)
        two_factor_auth.otp = '123456'
        two_factor_auth.otp_exp_date = timezone.now() - timedelta(minutes=6)
        two_factor_auth.save()

        result = AuthService.verify_2fa_token(self.user, '123456')

        self.assertFalse(result)

    def test_verify_2fa_token_with_invalid_otp(self):
        """잘못된 OTP로 2FA 검증 테스트"""
        two_factor_auth = TwoFactorAuth.objects.create(user=self.user, recovery_key='f' * 45)
        two_factor_auth.create_token('123456')

        result = AuthService.verify_2fa_token(self.user, '999999')

        self.assertFalse(result)

    def test_verify_2fa_token_with_recovery_key(self):
        """복구 키로 2FA 검증 테스트"""
        recovery_key = 'g' * 45
        two_factor_auth = TwoFactorAuth.objects.create(user=self.user, recovery_key=recovery_key)
        two_factor_auth.create_token('123456')

        result = AuthService.verify_2fa_token(self.user, recovery_key)

        self.assertTrue(result)

        # Verify OTP was cleared
        two_factor_auth.refresh_from_db()
        self.assertEqual(two_factor_auth.otp, '')

    def test_verify_2fa_token_no_2fa_enabled(self):
        """2FA가 비활성화된 사용자의 토큰 검증 테스트"""
        result = AuthService.verify_2fa_token(self.user, '123456')

        self.assertFalse(result)


class AuthServiceGetUserLoginDataTestCase(TestCase):
    """AuthService.get_user_login_data 테스트"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='test',
            email='test@test.com',
            first_name='Test User'
        )
        self.profile = Profile.objects.create(user=self.user, role=Profile.Role.MEMBER)
        Config.objects.create(user=self.user)

    def test_get_user_login_data_basic(self):
        """기본 사용자 로그인 데이터 가져오기 테스트"""
        data = AuthService.get_user_login_data(self.user)

        self.assertEqual(data['username'], 'testuser')
        self.assertEqual(data['name'], 'Test User')
        self.assertEqual(data['email'], 'test@test.com')
        self.assertEqual(data['notify_count'], 0)
        self.assertFalse(data['has_connected_telegram'])
        self.assertFalse(data['has_connected_2fa'])
        self.assertFalse(data['has_editor_role'])

    def test_get_user_login_data_with_telegram(self):
        """텔레그램 연동된 사용자 로그인 데이터 테스트"""
        TelegramSync.objects.create(user=self.user, tid='telegram123')

        data = AuthService.get_user_login_data(self.user)

        self.assertTrue(data['has_connected_telegram'])

    def test_get_user_login_data_with_2fa(self):
        """2FA 활성화된 사용자 로그인 데이터 테스트"""
        TwoFactorAuth.objects.create(user=self.user, recovery_key='a' * 45)

        data = AuthService.get_user_login_data(self.user)

        self.assertTrue(data['has_connected_2fa'])

    def test_get_user_login_data_with_editor_role(self):
        """에디터 권한이 있는 사용자 로그인 데이터 테스트"""
        self.profile.role = Profile.Role.EDITOR
        self.profile.save()

        data = AuthService.get_user_login_data(self.user)

        self.assertTrue(data['has_editor_role'])


class TwoFactorAuthModelTestCase(TestCase):
    """TwoFactorAuth 모델 테스트"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='test',
            email='test@test.com'
        )
        self.two_factor_auth = TwoFactorAuth.objects.create(
            user=self.user,
            recovery_key='a' * 45
        )

    def test_create_token(self):
        """토큰 생성 테스트"""
        self.two_factor_auth.create_token('123456')

        self.assertEqual(self.two_factor_auth.otp, '123456')
        # Check that otp_exp_date was updated
        self.assertIsNotNone(self.two_factor_auth.otp_exp_date)

    def test_is_token_expire_not_expired(self):
        """토큰 만료 체크 테스트 (만료되지 않음)"""
        self.two_factor_auth.create_token('123456')

        result = self.two_factor_auth.is_token_expire()

        self.assertFalse(result)

    def test_is_token_expire_expired(self):
        """토큰 만료 체크 테스트 (만료됨)"""
        self.two_factor_auth.otp = '123456'
        self.two_factor_auth.otp_exp_date = timezone.now() - timedelta(minutes=6)
        self.two_factor_auth.save()

        result = self.two_factor_auth.is_token_expire()

        self.assertTrue(result)

    def test_has_been_a_day_false(self):
        """24시간 경과 체크 테스트 (경과하지 않음)"""
        self.two_factor_auth.created_date = timezone.now()
        self.two_factor_auth.save()

        result = self.two_factor_auth.has_been_a_day()

        self.assertFalse(result)

    def test_has_been_a_day_true(self):
        """24시간 경과 체크 테스트 (경과함)"""
        self.two_factor_auth.created_date = timezone.now() - timedelta(days=2)
        self.two_factor_auth.save()

        result = self.two_factor_auth.has_been_a_day()

        self.assertTrue(result)

    def test_verify_token_with_valid_otp(self):
        """유효한 OTP 검증 테스트"""
        self.two_factor_auth.create_token('123456')

        result = self.two_factor_auth.verify_token('123456')

        self.assertTrue(result)
        # OTP should be cleared
        self.assertEqual(self.two_factor_auth.otp, '')

    def test_verify_token_with_expired_otp(self):
        """만료된 OTP 검증 테스트"""
        self.two_factor_auth.otp = '123456'
        self.two_factor_auth.otp_exp_date = timezone.now() - timedelta(minutes=6)
        self.two_factor_auth.save()

        result = self.two_factor_auth.verify_token('123456')

        self.assertFalse(result)

    def test_verify_token_with_invalid_otp(self):
        """잘못된 OTP 검증 테스트"""
        self.two_factor_auth.create_token('123456')

        result = self.two_factor_auth.verify_token('999999')

        self.assertFalse(result)

    def test_verify_token_with_recovery_key(self):
        """복구 키 검증 테스트"""
        recovery_key = 'b' * 45
        self.two_factor_auth.recovery_key = recovery_key
        self.two_factor_auth.save()

        result = self.two_factor_auth.verify_token(recovery_key)

        self.assertTrue(result)
        # OTP should be cleared
        self.assertEqual(self.two_factor_auth.otp, '')

    def test_verify_token_with_invalid_recovery_key(self):
        """잘못된 복구 키 검증 테스트"""
        self.two_factor_auth.recovery_key = 'c' * 45
        self.two_factor_auth.save()

        result = self.two_factor_auth.verify_token('d' * 45)

        self.assertFalse(result)

    def test_verify_token_with_short_string(self):
        """짧은 문자열로 검증 시도 테스트"""
        result = self.two_factor_auth.verify_token('12345')  # 5 chars

        self.assertFalse(result)

    def test_verify_token_with_medium_length_string(self):
        """중간 길이 문자열로 검증 시도 테스트 (6-44 chars)"""
        result = self.two_factor_auth.verify_token('1234567')  # 7 chars

        self.assertFalse(result)
