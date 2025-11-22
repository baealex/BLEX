"""
OAuth Callback 템플릿 테스트
URL: /login/callback/github, /login/callback/google

이 테스트는 OAuth 콜백 처리와 2FA 통합을 검증합니다.
"""
import pyotp
from unittest.mock import patch

from django.test import TestCase, Client, override_settings
from django.contrib.auth.models import User
from django.urls import reverse

from board.models import Profile, Config, TwoFactorAuth, UserLinkMeta
from modules import oauth


class OAuthCallbackTestCase(TestCase):
    """OAuth 콜백 처리 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        self.client = Client()

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=True, user={
        'node_id': 'GITHUB_NODE_ID_123',
        'login': 'githubuser',
        'name': 'GitHub User',
        'avatar_url': 'https://avatars.githubusercontent.com/u/123456',
    }))
    def test_github_oauth_callback_new_user(self, mock_github):
        """GitHub OAuth 콜백으로 새 사용자 생성 테스트"""
        response = self.client.get('/login/callback/github?code=test_code')

        # Should redirect to home page (no 2FA)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')

        # Verify user was created
        self.assertTrue(User.objects.filter(username='githubuser').exists())
        user = User.objects.get(username='githubuser')
        self.assertEqual(user.first_name, 'GitHub User')
        self.assertEqual(user.last_name, 'github:GITHUB_NODE_ID_123')

        # Verify profile and config were created
        self.assertTrue(hasattr(user, 'profile'))
        self.assertTrue(hasattr(user, 'config'))

        # Verify GitHub link was created
        link = UserLinkMeta.objects.filter(user=user, name='github').first()
        self.assertIsNotNone(link)
        self.assertEqual(link.value, 'https://github.com/githubuser')

        # Verify user is logged in
        user_from_session = self.client.session.get('_auth_user_id')
        self.assertEqual(int(user_from_session), user.id)

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=True, user={
        'node_id': 'GITHUB_NODE_ID_456',
        'login': 'existinguser',
        'name': 'Existing User',
        'avatar_url': 'https://avatars.githubusercontent.com/u/456789',
    }))
    def test_github_oauth_callback_existing_user(self, mock_github):
        """GitHub OAuth 콜백으로 기존 사용자 로그인 테스트"""
        # Create existing user with GitHub token
        user = User.objects.create_user(
            username='existinguser',
            email='existing@example.com',
            password='testpass123',
            first_name='Existing User',
            last_name='github:GITHUB_NODE_ID_456'
        )
        Profile.objects.create(user=user)
        Config.objects.create(user=user)

        response = self.client.get('/login/callback/github?code=test_code')

        # Should redirect to home page
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')

        # Verify user is logged in
        user_from_session = self.client.session.get('_auth_user_id')
        self.assertEqual(int(user_from_session), user.id)

    @patch('modules.oauth.auth_google', return_value=oauth.State(success=True, user={
        'id': 'GOOGLE_ID_789',
        'email': 'googleuser@gmail.com',
        'name': 'Google User',
        'picture': 'https://lh3.googleusercontent.com/a/default-user',
    }))
    def test_google_oauth_callback_new_user(self, mock_google):
        """Google OAuth 콜백으로 새 사용자 생성 테스트"""
        response = self.client.get('/login/callback/google?code=test_code')

        # Should redirect to home page (no 2FA)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')

        # Verify user was created
        self.assertTrue(User.objects.filter(username='googleuser').exists())
        user = User.objects.get(username='googleuser')
        self.assertEqual(user.first_name, 'Google User')
        self.assertEqual(user.email, 'googleuser@gmail.com')
        self.assertEqual(user.last_name, 'google:GOOGLE_ID_789')

        # Verify user is logged in
        user_from_session = self.client.session.get('_auth_user_id')
        self.assertEqual(int(user_from_session), user.id)

    @override_settings(DEBUG=False)
    @patch('modules.oauth.auth_github', return_value=oauth.State(success=True, user={
        'node_id': 'GITHUB_NODE_ID_2FA',
        'login': 'user2fa',
        'name': 'User with 2FA',
        'avatar_url': 'https://avatars.githubusercontent.com/u/2fa',
    }))
    def test_github_oauth_callback_with_2fa_enabled(self, mock_github):
        """GitHub OAuth 콜백 시 2FA가 활성화된 사용자 테스트"""
        # Create user with 2FA enabled
        user = User.objects.create_user(
            username='user2fa',
            email='user2fa@example.com',
            password='testpass123',
            first_name='User with 2FA',
            last_name='github:GITHUB_NODE_ID_2FA'
        )
        Profile.objects.create(user=user)
        Config.objects.create(user=user)

        # Enable 2FA
        totp_secret = pyotp.random_base32()
        TwoFactorAuth.objects.create(
            user=user,
            recovery_key='x' * 45,
            totp_secret=totp_secret
        )

        response = self.client.get('/login/callback/github?code=test_code')

        # Should redirect to login page with oauth_token
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith('/login?oauth_token='))

        # Verify user is NOT logged in yet (pending 2FA)
        user_from_session = self.client.session.get('_auth_user_id')
        self.assertIsNone(user_from_session)

        # Extract oauth_token from redirect URL
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(response.url)
        query_params = parse_qs(parsed.query)
        oauth_token = query_params['oauth_token'][0]

        # Verify token exists in cache with correct user data
        from django.core.cache import cache
        from board.services.auth_service import OAuthService
        oauth_data = OAuthService.get_2fa_data(oauth_token)
        self.assertIsNotNone(oauth_data)
        self.assertEqual(oauth_data['user_id'], user.id)

        # Verify message contains TOTP instruction (not Telegram)
        messages = list(response.wsgi_request._messages)
        self.assertEqual(len(messages), 1)
        self.assertIn('인증 앱', str(messages[0]))
        self.assertNotIn('텔레그램', str(messages[0]))

    @override_settings(DEBUG=False)
    @patch('modules.oauth.auth_github', return_value=oauth.State(success=True, user={
        'node_id': 'GITHUB_NODE_ID_2FA_NEXT',
        'login': 'user2fanext',
        'name': 'User with 2FA and Next',
        'avatar_url': 'https://avatars.githubusercontent.com/u/2fanext',
    }))
    def test_github_oauth_callback_with_2fa_and_next_url(self, mock_github):
        """GitHub OAuth 콜백 시 2FA와 next URL 처리 테스트"""
        # Create user with 2FA enabled
        user = User.objects.create_user(
            username='user2fanext',
            email='user2fanext@example.com',
            password='testpass123',
            first_name='User with 2FA and Next',
            last_name='github:GITHUB_NODE_ID_2FA_NEXT'
        )
        Profile.objects.create(user=user)
        Config.objects.create(user=user)

        # Enable 2FA
        totp_secret = pyotp.random_base32()
        TwoFactorAuth.objects.create(
            user=user,
            recovery_key='y' * 45,
            totp_secret=totp_secret
        )

        response = self.client.get('/login/callback/github?code=test_code&next=/setting/posts')

        # Should redirect to login page with oauth_token and next parameter
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith('/login?oauth_token='))
        self.assertIn('next=/setting/posts', response.url)

        # Extract oauth_token from redirect URL
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(response.url)
        query_params = parse_qs(parsed.query)
        oauth_token = query_params['oauth_token'][0]

        # Verify next URL is stored in cache (not session)
        from board.services.auth_service import OAuthService
        oauth_data = OAuthService.get_2fa_data(oauth_token)
        self.assertIsNotNone(oauth_data)
        self.assertEqual(oauth_data['next_url'], '/setting/posts')

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=False, user={}))
    def test_github_oauth_callback_failure(self, mock_github):
        """GitHub OAuth 인증 실패 테스트"""
        response = self.client.get('/login/callback/github?code=invalid_code')

        # Should redirect to login page with error message
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login', response.url)

        # Verify error message
        messages = list(response.wsgi_request._messages)
        self.assertEqual(len(messages), 1)
        self.assertIn('GitHub', str(messages[0]))

    def test_oauth_callback_missing_code(self):
        """OAuth 콜백에 code 파라미터가 없을 때 테스트"""
        response = self.client.get('/login/callback/github')

        # Should redirect to login page with error
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login', response.url)

        messages = list(response.wsgi_request._messages)
        self.assertEqual(len(messages), 1)
        self.assertIn('실패', str(messages[0]))

    def test_oauth_callback_unsupported_provider(self):
        """지원하지 않는 OAuth provider 테스트"""
        response = self.client.get('/login/callback/facebook?code=test_code')

        # Should return 404
        self.assertEqual(response.status_code, 404)

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=True, user={
        'node_id': 'GITHUB_NODE_ID_NEXT',
        'login': 'usernext',
        'name': 'User with Next URL',
        'avatar_url': 'https://avatars.githubusercontent.com/u/next',
    }))
    def test_github_oauth_callback_with_next_url(self, mock_github):
        """GitHub OAuth 콜백 시 next URL로 리다이렉트 테스트"""
        response = self.client.get('/login/callback/github?code=test_code&next=/setting/profile')

        # Should redirect to the next URL
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/setting/profile')

        # Verify user is logged in
        user = User.objects.get(username='usernext')
        user_from_session = self.client.session.get('_auth_user_id')
        self.assertEqual(int(user_from_session), user.id)
