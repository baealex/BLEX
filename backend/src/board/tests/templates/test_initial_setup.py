import json

from django.test import Client, TestCase, override_settings

from board.models import Config, Profile, User


@override_settings(DEBUG=True, INITIAL_SETUP_TOKEN='')
class InitialSetupViewTestCase(TestCase):
    setup_data = {
        'username': 'adminuser',
        'display_name': 'Admin User',
        'email': 'admin@example.com',
        'password': 'StrongPass123!',
        'password_check': 'StrongPass123!',
    }

    def _create_regular_user(self, username='readeruser') -> User:
        user = User.objects.create_user(
            username=username,
            email=f'{username}@example.com',
            password='StrongPass123!',
        )
        Profile.objects.create(user=user, role=Profile.Role.READER)
        Config.objects.create(user=user)
        return user

    def _create_staff_admin(self) -> User:
        admin = User.objects.create_user(
            username='staffadmin',
            email='staff@example.com',
            password='StrongPass123!',
            is_staff=True,
        )
        Profile.objects.create(user=admin, role=Profile.Role.EDITOR)
        Config.objects.create(user=admin)
        return admin

    def test_empty_install_entry_points_redirect_to_setup(self):
        """빈 설치 상태에서는 주요 진입점이 최초 설정으로 이동한다."""
        for path in ['/', '/login', '/sign']:
            response = self.client.get(path)

            self.assertEqual(response.status_code, 302)
            self.assertEqual(response['Location'], '/setup')

    def test_entry_points_redirect_to_setup_when_regular_user_exists_without_admin(self):
        """일반 사용자만 있으면 설치 완료로 보지 않고 최초 설정으로 이동한다."""
        self._create_regular_user()

        for path in ['/', '/login', '/sign']:
            response = self.client.get(path)

            self.assertEqual(response.status_code, 302)
            self.assertEqual(response['Location'], '/setup')

    def test_setup_page_renders_when_no_admin_exists(self):
        """관리자가 없으면 최초 설정 화면을 렌더링하고 인증 링크를 숨긴다."""
        response = self.client.get('/setup')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '초기 설정')
        self.assertContains(response, '관리자 계정 만들기')
        self.assertNotContains(response, 'href="/login"')
        self.assertNotContains(response, 'href="/sign"')

    def test_setup_creates_first_admin_account(self):
        """최초 설정 제출은 staff/superuser/editor 관리자를 생성하고 로그인시킨다."""
        response = self.client.post('/setup', self.setup_data)

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], '/admin-settings/site-settings')

        user = User.objects.get(username='adminuser')
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertEqual(user.first_name, 'Admin User')
        self.assertEqual(user.email, 'admin@example.com')
        self.assertEqual(user.profile.role, Profile.Role.EDITOR)
        self.assertTrue(hasattr(user, 'config'))
        self.assertEqual(int(self.client.session['_auth_user_id']), user.id)

    @override_settings(DEBUG=False, INITIAL_SETUP_TOKEN='setup-secret')
    def test_setup_requires_valid_token_when_configured(self):
        """운영 모드에서는 올바른 설치 토큰 없이는 관리자 생성이 차단된다."""
        response = self.client.post('/setup', self.setup_data)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '설치 토큰')
        self.assertFalse(User.objects.filter(username='adminuser').exists())

        data = {
            **self.setup_data,
            'setup_token': 'wrong-token',
        }
        response = self.client.post('/setup', data)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '설치 토큰이 올바르지 않습니다.')
        self.assertFalse(User.objects.filter(username='adminuser').exists())

    @override_settings(DEBUG=False, INITIAL_SETUP_TOKEN='setup-secret')
    def test_setup_accepts_valid_token_when_configured(self):
        """설치 토큰이 맞으면 운영 모드에서도 최초 관리자를 만들 수 있다."""
        response = self.client.post('/setup', {
            **self.setup_data,
            'setup_token': 'setup-secret',
        })

        self.assertEqual(response.status_code, 302)
        self.assertTrue(User.objects.filter(username='adminuser').exists())

    def test_setup_rejects_password_mismatch(self):
        """비밀번호 확인이 다르면 관리자 계정을 만들지 않는다."""
        response = self.client.post('/setup', {
            **self.setup_data,
            'password_check': 'DifferentPass123!',
        })

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '비밀번호가 서로 일치하지 않습니다.')
        self.assertFalse(User.objects.filter(username='adminuser').exists())

    def test_setup_rejects_weak_password(self):
        """약한 비밀번호는 Django 비밀번호 검증으로 거부한다."""
        response = self.client.post('/setup', {
            **self.setup_data,
            'password': '123',
            'password_check': '123',
        })

        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(username='adminuser').exists())

    def test_setup_is_blocked_when_admin_exists(self):
        """이미 superuser가 있으면 최초 설정 화면은 다시 열리지 않는다."""
        User.objects.create_superuser(
            username='existingadmin',
            email='existing@example.com',
            password='StrongPass123!',
        )
        client = Client(raise_request_exception=False)

        get_response = client.get('/setup')
        post_response = client.post('/setup', self.setup_data)

        self.assertEqual(get_response.status_code, 404)
        self.assertEqual(post_response.status_code, 404)

    def test_setup_is_blocked_when_staff_admin_exists(self):
        """staff 관리자만 있어도 BLEX 설치는 완료된 상태로 본다."""
        self._create_staff_admin()
        client = Client(raise_request_exception=False)

        response = client.get('/setup')

        self.assertEqual(response.status_code, 404)

    def test_setup_allows_admin_creation_when_regular_user_exists(self):
        """일반 사용자만 있는 이관 상태에서는 최초 관리자 생성을 허용한다."""
        self._create_regular_user()

        response = self.client.post('/setup', self.setup_data)

        self.assertEqual(response.status_code, 302)
        admin = User.objects.get(username='adminuser')
        self.assertTrue(admin.is_superuser)

    def test_regular_signup_api_is_blocked_when_no_admin_exists(self):
        """관리자가 없으면 일반 회원가입 API로 첫 계정을 우회 생성할 수 없다."""
        self._create_regular_user()

        response = self.client.post('/v1/sign', {
            'username': 'testuser',
            'password': 'StrongPass123!',
            'name': 'Test User',
            'email': 'test@example.com',
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
        self.assertFalse(User.objects.filter(username='testuser').exists())

    def test_social_signup_api_is_blocked_when_no_admin_exists(self):
        """관리자가 없으면 소셜 회원가입 API도 첫 계정 우회를 허용하지 않는다."""
        self._create_regular_user()

        for path in ['/v1/sign/github', '/v1/sign/google']:
            response = self.client.post(path, {'code': 'test_code'})

            self.assertEqual(response.status_code, 200)
            content = json.loads(response.content)
            self.assertEqual(content['status'], 'ERROR')
            self.assertEqual(content['errorCode'], 'error:RJ')

        self.assertEqual(User.objects.count(), 1)

    def test_oauth_callback_redirects_to_setup_when_no_admin_exists(self):
        """관리자가 없으면 OAuth callback도 사용자 생성 대신 setup으로 이동한다."""
        self._create_regular_user()

        response = self.client.get('/login/callback/github?code=test_code')

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], '/setup')
        self.assertFalse(User.objects.filter(username='githubuser').exists())
