"""
OAuth Callback 템플릿 테스트
URL: /login/callback/github, /login/callback/google

이 테스트는 OAuth 콜백 처리와 2FA 통합을 검증합니다.
"""
from base64 import urlsafe_b64encode
from hashlib import sha256
from urllib.parse import parse_qs, urlencode, urlsplit

import pyotp
from unittest.mock import patch

from django.test import TestCase, Client, override_settings
from django.contrib.auth.models import User
from django.urls import reverse

from board.models import Profile, Config, TwoFactorAuth, UserLinkMeta, SocialAuth, SocialAuthProvider
from board.services.account_reauthentication_service import AccountReauthenticationService
from board.services.auth_service import OAuthService
from board.services.oauth_flow_service import OAuthFlowService
from modules import oauth


class OAuthCallbackTestCase(TestCase):
    """OAuth 콜백 처리 테스트"""

    @classmethod
    def setUpTestData(cls):
        admin = User.objects.create_superuser(
            username='setupadmin',
            email='setupadmin@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=admin, role=Profile.Role.EDITOR)
        Config.objects.create(user=admin)

        for key in ['google', 'github']:
            SocialAuthProvider.objects.update_or_create(
                key=key,
                defaults={
                    'is_enabled': True,
                    'client_id': f'{key}-client-id',
                    'client_secret': f'{key}-secret',
                }
            )

    def setUp(self):
        """테스트 데이터 설정"""
        self.client = Client()
        self.download_image_patcher = patch(
            'board.services.auth_service.download_image',
            return_value=None,
        )
        self.download_image_patcher.start()
        self.addCleanup(self.download_image_patcher.stop)

    def start_oauth(self, provider='github', next_url='/', *, reauthenticate=False):
        start_url = f'/login/start/{provider}?' + urlencode({'next': next_url})
        response = self.client.post(start_url) if reauthenticate else self.client.get(start_url)
        return parse_qs(urlsplit(response.url).query)

    def complete_oauth(self, provider='github', *, code='test_code', next_url='/'):
        params = self.start_oauth(provider, next_url)
        return self.client.get(f'/login/callback/{provider}', {'code': code, 'state': params['state'][0]})

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=False))
    def test_oauth_state_is_session_bound_and_used_once(self, mock_exchange):
        params = self.start_oauth()
        verifier = self.client.session[OAuthFlowService.SESSION_KEY]['github']['verifier']
        challenge = urlsafe_b64encode(sha256(verifier.encode()).digest()).decode().rstrip('=')
        self.assertEqual(params['code_challenge'], [challenge])
        self.assertEqual(params['code_challenge_method'], ['S256'])

        callback = {'code': 'test_code', 'state': params['state'][0]}
        Client().get('/login/callback/github', callback)
        self.client.get('/login/callback/github', {'code': 'test_code', 'state': 'wrong'})
        mock_exchange.assert_not_called()

        self.client.get('/login/callback/github', callback)
        self.client.get('/login/callback/github', callback)
        mock_exchange.assert_called_once_with('test_code', verifier, params['redirect_uri'][0])

    @override_settings(SITE_URL='https://primary.example.test', ALLOWED_HOSTS=['login.example.test'])
    @patch('modules.oauth.auth_github', return_value=oauth.State(success=False))
    def test_oauth_uses_the_same_allowed_origin_for_start_and_exchange(self, exchange):
        origin = {'secure': True, 'HTTP_HOST': 'login.example.test'}
        start = self.client.get('/login/start/github', **origin)
        params = parse_qs(urlsplit(start.url).query)
        callback_uri = 'https://login.example.test/login/callback/github'
        self.assertEqual(params['redirect_uri'], [callback_uri])

        self.client.get('/login/callback/github', {'code': 'test_code', 'state': params['state'][0]}, **origin)
        self.assertEqual(exchange.call_args.args[2], callback_uri)

    @patch('modules.oauth.auth_github')
    def test_social_reauthentication_requires_the_linked_account_and_second_factor(self, exchange):
        user = User.objects.create_user(username='social-only')
        Profile.objects.create(user=user)
        Config.objects.create(user=user)
        SocialAuth.objects.create(
            user=user, provider=SocialAuthProvider.objects.get(key='github'), uid='linked-user',
        )
        secret = pyotp.random_base32()
        TwoFactorAuth.objects.create(user=user, totp_secret=secret)
        self.client.force_login(user)

        next_url = '/settings/account'
        verification_url = '/reauthenticate?' + urlencode({'next': next_url})
        exchange.return_value = oauth.State(success=True, user={'node_id': 'another-user', 'login': 'other'})
        params = self.start_oauth(next_url=next_url, reauthenticate=True)
        rejected = self.client.get('/login/callback/github', {'code': 'test_code', 'state': params['state'][0]})
        self.assertRedirects(rejected, verification_url, fetch_redirect_response=False)
        self.assertNotIn(AccountReauthenticationService.PENDING_SOCIAL_KEY, self.client.session)
        self.assertFalse(User.objects.filter(username='other').exists())

        exchange.return_value = oauth.State(success=True, user={'node_id': 'linked-user', 'login': 'social-only'})
        params = self.start_oauth(next_url=next_url, reauthenticate=True)
        callback = self.client.get('/login/callback/github', {'code': 'test_code', 'state': params['state'][0]})
        self.assertRedirects(callback, verification_url, fetch_redirect_response=False)
        self.assertNotIn(AccountReauthenticationService.SESSION_KEY, self.client.session)
        verification = self.client.get(verification_url)
        self.assertTrue(verification.context['show_verification_form'])
        self.assertTrue(verification.context['has_two_factor'])

        verified = self.client.post(verification_url, {'code': pyotp.TOTP(secret).now()})
        self.assertRedirects(verified, next_url, fetch_redirect_response=False)
        self.assertIn(AccountReauthenticationService.SESSION_KEY, self.client.session)

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=True, user={
        'node_id': 'linked-user', 'login': 'linked-with-password',
    }))
    def test_linked_provider_can_reauthenticate_account_with_existing_password(self, exchange):
        user = User.objects.create_user(username='linked-with-password', password='previous-password')
        SocialAuth.objects.create(user=user, provider=SocialAuthProvider.objects.get(key='github'), uid='linked-user')
        self.client.force_login(user)
        page = self.client.get('/reauthenticate')
        self.assertTrue(page.context['has_password'])
        self.assertEqual([provider['key'] for provider in page.context['providers']], ['github'])

        params = self.start_oauth(reauthenticate=True, next_url='/settings/account')
        result = self.client.get('/login/callback/github', {'code': 'test_code', 'state': params['state'][0]})
        self.assertRedirects(result, '/settings/account', fetch_redirect_response=False)
        self.assertIn(AccountReauthenticationService.SESSION_KEY, self.client.session)
        exchange.assert_called_once()

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=True, user={
        'node_id': 'GITHUB_NODE_ID_123',
        'login': 'githubuser',
        'name': 'GitHub User',
        'avatar_url': 'https://avatars.githubusercontent.com/u/123456',
    }))
    def test_github_oauth_callback_new_user(self, mock_github):
        """GitHub OAuth 콜백으로 새 사용자 생성 테스트"""
        response = self.complete_oauth()

        # Should redirect to home page (no 2FA)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')

        # Verify user was created
        self.assertTrue(User.objects.filter(username='githubuser').exists())
        user = User.objects.get(username='githubuser')
        self.assertEqual(user.first_name, 'GitHub User')
        self.assertEqual(user.last_name, '')
        self.assertTrue(SocialAuth.objects.filter(user=user, provider__key='github', uid='GITHUB_NODE_ID_123').exists())

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
            first_name='Existing User'
        )
        Profile.objects.create(user=user)
        Config.objects.create(user=user)
        SocialAuth.objects.create(
            user=user,
            provider=SocialAuthProvider.objects.get(key='github'),
            uid='GITHUB_NODE_ID_456',
            extra_data='{}',
        )

        response = self.complete_oauth()

        # Should redirect to home page
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')

        # Verify user is logged in
        user_from_session = self.client.session.get('_auth_user_id')
        self.assertEqual(int(user_from_session), user.id)


    def test_disabled_google_provider_blocks_direct_callback(self):
        """관리자가 제공자를 끄면 콜백 URL 직접 호출도 로그인되지 않는다."""
        SocialAuthProvider.objects.update_or_create(
            key='google',
            defaults={
                'is_enabled': False,
                'client_id': '',
                'client_secret': '',
            }
        )

        response = self.client.get('/login/callback/google', {'code': 'test_code'})

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('login'))
        self.assertFalse(User.objects.filter(username='googleuser').exists())

    @patch('modules.oauth.auth_google', return_value=oauth.State(success=True, user={
        'id': 'GOOGLE_ID_789',
        'email': 'googleuser@gmail.com',
        'name': 'Google User',
        'picture': 'https://lh3.googleusercontent.com/a/default-user',
    }))
    def test_google_oauth_callback_new_user(self, mock_google):
        """Google OAuth 콜백으로 새 사용자 생성 테스트"""
        response = self.complete_oauth('google')

        # Should redirect to home page (no 2FA)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')

        # Verify user was created
        self.assertTrue(User.objects.filter(username='googleuser').exists())
        user = User.objects.get(username='googleuser')
        self.assertEqual(user.first_name, 'Google User')
        self.assertEqual(user.email, 'googleuser@gmail.com')
        self.assertEqual(user.last_name, '')
        self.assertTrue(SocialAuth.objects.filter(user=user, provider__key='google', uid='GOOGLE_ID_789').exists())

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
            first_name='User with 2FA'
        )
        Profile.objects.create(user=user)
        Config.objects.create(user=user)
        SocialAuth.objects.create(
            user=user,
            provider=SocialAuthProvider.objects.get(key='github'),
            uid='GITHUB_NODE_ID_2FA',
            extra_data='{}',
        )

        # Enable 2FA
        totp_secret = pyotp.random_base32()
        TwoFactorAuth.objects.create(
            user=user,
            recovery_key='x' * 45,
            totp_secret=totp_secret
        )

        response = self.complete_oauth()

        self.assertEqual(response.url, '/login')
        self.assertNotIn('_auth_user_id', self.client.session)
        pending = OAuthService.get_2fa_data(self.client.session)
        self.assertEqual(pending['user_id'], user.id)
        self.assertTrue(self.client.get('/login').context['show_2fa'])

        code = pyotp.TOTP(totp_secret).now()
        other_client = Client()
        cached_form = {'username': user.username, 'password': '', 'code': code}
        self.assertEqual(other_client.post('/v1/login', cached_form).json()['status'], 'ERROR')
        self.assertEqual(self.client.post('/v1/login', cached_form).json()['status'], 'DONE')
        self.assertIsNone(OAuthService.get_2fa_data(self.client.session))

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
            first_name='User with 2FA and Next'
        )
        Profile.objects.create(user=user)
        Config.objects.create(user=user)
        SocialAuth.objects.create(
            user=user,
            provider=SocialAuthProvider.objects.get(key='github'),
            uid='GITHUB_NODE_ID_2FA_NEXT',
            extra_data='{}',
        )

        # Enable 2FA
        totp_secret = pyotp.random_base32()
        TwoFactorAuth.objects.create(
            user=user,
            recovery_key='y' * 45,
            totp_secret=totp_secret
        )

        next_url = '/@testauthor/post?reply_to=42#post-comments'
        response = self.complete_oauth(next_url=next_url)

        self.assertEqual(response.url, '/login')
        self.assertEqual(self.client.get('/login').context['next_url'], next_url)

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=False, user={}))
    def test_github_oauth_callback_failure(self, mock_github):
        """GitHub OAuth 인증 실패 테스트"""
        response = self.complete_oauth(code='invalid_code')

        # Should redirect to login page with error message
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login', response.url)

        # Verify error message
        messages = list(response.wsgi_request._messages)
        self.assertEqual(len(messages), 1)
        self.assertIn('실패', str(messages[0]))

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
        next_url = '/@testauthor/post?reply_to=42#post-comments'
        response = self.complete_oauth(next_url=next_url)

        # Should redirect to the next URL
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, next_url)

        # Verify user is logged in
        user = User.objects.get(username='usernext')
        user_from_session = self.client.session.get('_auth_user_id')
        self.assertEqual(int(user_from_session), user.id)

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=False))
    def test_failed_oauth_preserves_next_url_for_retry(self, mock_github):
        next_url = '/@testauthor/post?reply_to=42#post-comments'

        response = self.complete_oauth(code='invalid_code', next_url=next_url)

        self.assertRedirects(response, reverse('login', query={'next': next_url}))
        self.assertEqual(self.client.get(response.url).context['next_url'], next_url)

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=True, user={
        'node_id': 'GITHUB_NODE_ID_EXTERNAL_NEXT',
        'login': 'userexternalnext',
        'name': 'User with External Next URL',
        'avatar_url': 'https://avatars.githubusercontent.com/u/external-next',
    }))
    def test_github_oauth_callback_rejects_external_next_url(self, mock_github):
        """OAuth 콜백은 외부 next URL로 리다이렉트하지 않는다."""
        response = self.complete_oauth(next_url='https://external.example/path')

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')
