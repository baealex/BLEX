import json

from unittest.mock import patch, MagicMock
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone

from board.models import (
    Config,
    LoginSetting,
    Profile,
    SocialAuth,
    SocialAuthProvider,
    TwoFactorAuth,
    User,
    UserLinkMeta,
    UsernameChangeLog,
)
from board.services.hcaptcha_service import HCaptchaService
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

        admin = User.objects.create_user(
            username='setupadmin',
            password='test',
            email='setupadmin@test.com',
            is_staff=True,
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

    def test_login_with_json_body(self):
        """JSON body 로그인 테스트"""
        response = self.client.post(
            '/v1/login',
            json.dumps({
                'username': 'test',
                'password': 'test',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test')

    def test_login_with_invalid_json_body_keeps_legacy_fallback(self):
        """invalid JSON body는 기존처럼 빈 dict fallback 후 인증 실패한다."""
        response = self.client.post(
            '/v1/login',
            '{"username":',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:AT')

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

    def test_signup_validation_localizes_message_without_changing_error_code(self):
        response = self.client.post(
            '/v1/sign',
            {
                'username': 'test',
                'password': 'test2',
                'name': 'Test User 2',
                'email': 'test2@test.com',
            },
            HTTP_ACCEPT_LANGUAGE='en',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')
        self.assertEqual(content['errorMessage'], 'This username is already in use.')

    def test_create_account_requires_hcaptcha_when_enabled(self):
        """hCaptcha가 켜져 있으면 회원가입에 검증 토큰이 필요하다."""
        setting = LoginSetting.get_instance()
        setting.hcaptcha_enabled = True
        setting.hcaptcha_site_key = 'site-key'
        setting.hcaptcha_secret_key = HCaptchaService.encrypt_secret('hcaptcha-secret')
        setting.save()

        response = self.client.post('/v1/sign', {
            'username': 'test2',
            'password': 'test2',
            'name': 'Test User 2',
            'email': 'test2@test.com',
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')
        self.assertFalse(User.objects.filter(username='test2').exists())

    @patch('board.services.hcaptcha_service.requests.post')
    def test_create_account_accepts_valid_hcaptcha_response(self, mock_post):
        """hCaptcha 검증 성공 시 회원가입을 허용한다."""
        setting = LoginSetting.get_instance()
        setting.hcaptcha_enabled = True
        setting.hcaptcha_site_key = 'site-key'
        setting.hcaptcha_secret_key = HCaptchaService.encrypt_secret('hcaptcha-secret')
        setting.save()
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': True}
        mock_post.return_value = mock_response

        response = self.client.post('/v1/sign', {
            'username': 'test2',
            'password': 'test2',
            'name': 'Test User 2',
            'email': 'test2@test.com',
            'h-captcha-response': 'valid-token',
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test2')
        mock_post.assert_called_once()
        self.assertEqual(mock_post.call_args.kwargs['data']['secret'], 'hcaptcha-secret')
        self.assertEqual(mock_post.call_args.kwargs['data']['response'], 'valid-token')

    @patch('board.services.hcaptcha_service.requests.post')
    def test_create_account_rejects_invalid_hcaptcha_response(self, mock_post):
        """hCaptcha 검증 실패 시 회원가입을 거부한다."""
        setting = LoginSetting.get_instance()
        setting.hcaptcha_enabled = True
        setting.hcaptcha_site_key = 'site-key'
        setting.hcaptcha_secret_key = HCaptchaService.encrypt_secret('hcaptcha-secret')
        setting.save()
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': False}
        mock_post.return_value = mock_response

        response = self.client.post('/v1/sign', {
            'username': 'test2',
            'password': 'test2',
            'name': 'Test User 2',
            'email': 'test2@test.com',
            'h-captcha-response': 'invalid-token',
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
        self.assertFalse(User.objects.filter(username='test2').exists())

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


    def test_disabled_social_provider_blocks_direct_signup_api(self):
        """관리자가 제공자를 끄면 v1/sign 직접 호출도 막는다."""
        SocialAuthProvider.objects.filter(key='github').update(is_enabled=False)

        response = self.client.post('/v1/sign/github', {
            'code': 'SECRET_TOKEN_VALUE',
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content, {
            'status': 'ERROR',
            'errorCode': 'error:RJ',
            'errorMessage': '소셜 로그인이 설정되지 않았습니다.',
        })

    def test_social_signup_keeps_missing_code_and_unsupported_provider_as_404(self):
        """지원하지 않는 provider와 code 누락은 기존처럼 404다."""
        missing_code_response = self.client.post('/v1/sign/github')
        unsupported_response = self.client.post('/v1/sign/facebook', {
            'code': 'SECRET_TOKEN_VALUE',
        })

        self.assertEqual(missing_code_response.status_code, 404)
        self.assertEqual(unsupported_response.status_code, 404)

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=False, user={}))
    def test_social_signup_keeps_external_auth_failure_response(self, mock_service):
        """외부 인증 실패의 상태·오류 코드·빈 메시지를 보존한다."""
        response = self.client.post('/v1/sign/github', {
            'code': 'INVALID_TOKEN_VALUE',
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.content), {
            'status': 'ERROR',
            'errorCode': 'error:RJ',
            'errorMessage': '',
        })
        mock_service.assert_called_once_with('INVALID_TOKEN_VALUE')

    @patch('modules.oauth.requests.post')
    def test_social_signup_rejects_enabled_but_unconfigured_provider(self, mock_post):
        """enabled 상태여도 credential이 없으면 기존 OAuth 실패 응답을 반환한다."""
        SocialAuthProvider.objects.filter(key='google').update(
            client_id='',
            client_secret='',
        )

        response = self.client.post('/v1/sign/google', {
            'code': 'SECRET_TOKEN_VALUE',
        })

        self.assertEqual(json.loads(response.content), {
            'status': 'ERROR',
            'errorCode': 'error:RJ',
            'errorMessage': '',
        })
        mock_post.assert_not_called()

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=True, user={
        'node_id': 'SECRET_TOKEN_VALUE',
        'login': 'test3',
        'name': 'Test User 3',
        'avatar_url': 'https://avatars.example.com/test3',
    }))
    def test_create_account_from_github(self, mock_servuce):
        """GitHub OAuth로 계정 생성 테스트"""
        with patch(
            'board.services.auth_service.download_image',
            return_value=None,
        ) as mock_download_image:
            response = self.client.post('/v1/sign/github', {
                'code': 'SECRET_TOKEN_VALUE',
            })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test3')
        self.assertEqual(content['body']['isFirstLogin'], True)
        user = User.objects.get(username='test3')
        self.assertEqual(user.first_name, 'Test User 3')
        self.assertEqual(user.email, '')
        self.assertEqual(user.last_name, '')
        social_auth = SocialAuth.objects.get(
            user=user,
            provider__key='github',
            uid='SECRET_TOKEN_VALUE',
        )
        self.assertEqual(json.loads(social_auth.extra_data), {
            'node_id': 'SECRET_TOKEN_VALUE',
            'login': 'test3',
            'name': 'Test User 3',
            'avatar_url': 'https://avatars.example.com/test3',
        })
        link = UserLinkMeta.objects.get(user=user, name='github')
        self.assertEqual(link.value, 'https://github.com/test3')
        mock_download_image.assert_called_once_with(
            'https://avatars.example.com/test3',
            stream=True,
        )

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
        'picture': 'https://images.example.com/test3',
    }))
    def test_create_account_from_google(self, mock_servuce):
        """Google OAuth로 계정 생성 테스트"""
        with patch(
            'board.services.auth_service.download_image',
            return_value=None,
        ) as mock_download_image:
            response = self.client.post('/v1/sign/google', {
                'code': 'SECRET_TOKEN_VALUE',
            })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test3')
        self.assertEqual(content['body']['isFirstLogin'], True)
        user = User.objects.get(username='test3')
        self.assertEqual(user.first_name, 'Test User 3')
        self.assertEqual(user.email, 'test3@google.com')
        self.assertEqual(user.last_name, '')
        social_auth = SocialAuth.objects.get(
            user=user,
            provider__key='google',
            uid='SECRET_TOKEN_VALUE',
        )
        self.assertEqual(json.loads(social_auth.extra_data), {
            'id': 'SECRET_TOKEN_VALUE',
            'email': 'test3@google.com',
            'name': 'Test User 3',
            'picture': 'https://images.example.com/test3',
        })
        self.assertFalse(UserLinkMeta.objects.filter(user=user).exists())
        mock_download_image.assert_called_once_with(
            'https://images.example.com/test3',
            stream=True,
        )

        self.client.logout()

        response = self.client.post('/v1/sign/google', {
            'code': 'SECRET_TOKEN_VALUE',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test3')
        self.assertEqual(content['body']['isFirstLogin'], False)

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=True, user={
        'node_id': 'EXISTING_2FA_UID',
        'login': 'ignored-provider-name',
        'name': 'Ignored Provider Name',
    }))
    def test_existing_social_account_keeps_oauth_2fa_login_response(self, mock_service):
        """기존 소셜 계정은 신규 생성 없이 기존 OAuth 2FA 응답을 유지한다."""
        user = User.objects.create_user(username='oauth2fa', email='oauth2fa@test.com')
        Profile.objects.create(user=user)
        Config.objects.create(user=user)
        SocialAuth.objects.create(
            user=user,
            provider=SocialAuthProvider.objects.get(key='github'),
            uid='EXISTING_2FA_UID',
            extra_data='{}',
        )
        TwoFactorAuth.objects.create(
            user=user,
            recovery_key='recovery-key',
            totp_secret='JBSWY3DPEHPK3PXP',
        )

        response = self.client.post('/v1/sign/github', {
            'code': 'EXISTING_TOKEN_VALUE',
        })

        self.assertEqual(json.loads(response.content), {
            'status': 'DONE',
            'body': {
                'username': 'oauth2fa',
                'security': True,
                'isOauth': True,
            },
        })
        self.assertNotIn('_auth_user_id', self.client.session)
        self.assertEqual(User.objects.filter(username='oauth2fa').count(), 1)
        mock_service.assert_called_once_with('EXISTING_TOKEN_VALUE')

    @override_settings(DEBUG_PROPAGATE_EXCEPTIONS=True)
    @patch(
        'board.services.social_signup_service.SocialAuth.objects.create',
        side_effect=RuntimeError('social auth persistence failed'),
    )
    @patch('modules.oauth.auth_google', return_value=oauth.State(success=True, user={
        'id': 'ROLLBACK_GOOGLE_UID',
        'email': 'rollback-google@example.com',
        'name': 'Rollback Google',
    }))
    def test_social_auth_failure_rolls_back_new_google_user(self, mock_oauth, mock_create):
        """SocialAuth 저장 실패 시 User·Profile·Config가 모두 롤백된다."""
        with self.assertRaisesMessage(RuntimeError, 'social auth persistence failed'):
            self.client.post('/v1/sign/google', {
                'code': 'ROLLBACK_TOKEN_VALUE',
            })

        self.assertFalse(User.objects.filter(username='rollback-google').exists())
        self.assertFalse(SocialAuth.objects.filter(uid='ROLLBACK_GOOGLE_UID').exists())
        self.assertFalse(Profile.objects.filter(user__username='rollback-google').exists())
        self.assertFalse(Config.objects.filter(user__username='rollback-google').exists())

    @override_settings(DEBUG_PROPAGATE_EXCEPTIONS=True)
    @patch(
        'board.services.social_signup_service.UserLinkMeta.objects.create',
        side_effect=RuntimeError('github link persistence failed'),
    )
    @patch('modules.oauth.auth_github', return_value=oauth.State(success=True, user={
        'node_id': 'ROLLBACK_GITHUB_UID',
        'login': 'rollbackgithub',
        'name': 'Rollback GitHub',
    }))
    def test_github_link_failure_rolls_back_user_and_social_auth(self, mock_oauth, mock_create):
        """GitHub link 저장 실패도 전체 신규 가입 transaction을 롤백한다."""
        with self.assertRaisesMessage(RuntimeError, 'github link persistence failed'):
            self.client.post('/v1/sign/github', {
                'code': 'ROLLBACK_TOKEN_VALUE',
            })

        self.assertFalse(User.objects.filter(username='rollbackgithub').exists())
        self.assertFalse(SocialAuth.objects.filter(uid='ROLLBACK_GITHUB_UID').exists())
        self.assertFalse(UserLinkMeta.objects.filter(value='https://github.com/rollbackgithub').exists())

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
        """포스트가 있는 사용자의 유저네임 변경 테스트"""
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
