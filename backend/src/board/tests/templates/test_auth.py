"""
인증 템플릿 테스트
URL: /login, /sign
"""
from django.test import TestCase, Client, override_settings
from django.contrib.auth.models import User
from django.urls import reverse

from board.models import Profile, Config


class LoginViewTestCase(TestCase):
    """로그인 페이지 템플릿 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=self.user)
        Config.objects.create(user=self.user)

        self.admin = User.objects.create_user(
            username='setupadmin',
            email='setupadmin@example.com',
            password='testpass123',
            is_staff=True,
        )
        Profile.objects.create(user=self.admin, role=Profile.Role.EDITOR)
        Config.objects.create(user=self.admin)

    def test_login_page_renders(self):
        """로그인 페이지가 정상적으로 렌더링되는지 테스트"""
        response = self.client.get(reverse('login'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/auth/login.html')
        self.assertContains(response, 'window.__blexIslandMonitor')
        self.assertContains(response, 'data-island-status')

    def test_login_page_renders_english_document_title(self):
        response = self.client.get(reverse('login'), HTTP_ACCEPT_LANGUAGE='en')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'lang=en')
        self.assertContains(response, '<title>Log in - ', html=False)

    def test_login_page_with_next_parameter(self):
        """로그인 페이지에 next 파라미터가 있을 때 context에 포함되는지 테스트"""
        response = self.client.get(reverse('login') + '?next=/setting/posts')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['next_url'], '/setting/posts')

    def test_login_page_without_next_parameter(self):
        """로그인 페이지에 next 파라미터가 없을 때 빈 문자열로 처리되는지 테스트"""
        response = self.client.get(reverse('login'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['next_url'], '')

    def test_old_social_login_url_explains_how_to_restart(self):
        response = self.client.get('/login', {'oauth_token': 'previous-login', 'next': '/settings/account'}, follow=True)

        self.assertEqual(response.redirect_chain, [(reverse('login', query={'next': '/settings/account'}), 302)])
        self.assertContains(response, '계속하려면 소셜 로그인을 다시 시작해 주세요.')
        self.assertFalse(response.context['show_2fa'])

    @override_settings(DEBUG=True)
    def test_development_admin_bookmark_uses_site_login_for_standalone_admin(self):
        admin = User.objects.create_superuser(username='standalone', password='testpass123')
        admin_url = reverse('admin:index')
        response = self.client.get(admin_url)
        self.assertRedirects(response, reverse('login', query={'next': admin_url}), fetch_redirect_response=False)

        response = self.client.post('/v1/login', {'username': admin.username, 'password': 'testpass123'})
        self.assertEqual(response.json()['status'], 'DONE')
        self.assertEqual(self.client.get(admin_url).status_code, 200)
        self.assertRedirects(self.client.get(reverse('admin:login')), admin_url, fetch_redirect_response=False)

    def test_login_page_redirects_authenticated_user(self):
        """이미 로그인된 사용자는 홈으로 리다이렉트"""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get(reverse('login'))
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, '/')

    def test_login_page_redirects_authenticated_user_to_next_url(self):
        """이미 로그인된 사용자는 next URL로 리다이렉트"""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get(reverse('login') + '?next=/setting/posts')
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, '/setting/posts', fetch_redirect_response=False)

    def test_login_page_rejects_external_redirect(self):
        """외부 도메인으로의 리다이렉트는 차단"""
        response = self.client.get(reverse('login') + '?next=https://evil.com/phishing')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['next_url'], '')

    def test_login_page_rejects_javascript_url(self):
        """javascript: URL은 차단"""
        response = self.client.get(reverse('login') + '?next=javascript:alert(1)')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['next_url'], '')

    def test_login_page_rejects_protocol_relative_path_variants(self):
        for next_url in ('///evil.example', '%5C%5Cevil.example'):
            response = self.client.get(reverse('login') + f'?next={next_url}')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.context['next_url'], '')

    def test_login_page_accepts_relative_url(self):
        """상대 URL은 허용"""
        response = self.client.get(reverse('login') + '?next=/setting/profile')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['next_url'], '/setting/profile')

    def test_login_page_preserves_query_and_fragment_in_next_url(self):
        next_url = '/@author/post?reply_to=42#post-comments'
        response = self.client.get(reverse('login'), {'next': next_url})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['next_url'], next_url)


class SignupViewTestCase(TestCase):
    """회원가입 페이지 템플릿 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=self.user)

        self.admin = User.objects.create_user(
            username='setupadmin',
            email='setupadmin@example.com',
            password='testpass123',
            is_staff=True,
        )
        Profile.objects.create(user=self.admin, role=Profile.Role.EDITOR)

    def test_signup_page_renders(self):
        """회원가입 페이지가 정상적으로 렌더링되는지 테스트"""
        response = self.client.get(reverse('signup'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/auth/signup.html')
        self.assertContains(response, 'window.__blexIslandMonitor')
        self.assertContains(response, 'data-island-status')

    def test_signup_page_renders_english_document_title(self):
        response = self.client.get(reverse('signup'), HTTP_ACCEPT_LANGUAGE='en')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'lang=en')
        self.assertContains(response, '<title>Sign up - ', html=False)

    def test_signup_page_with_next_parameter(self):
        """회원가입 페이지에 next 파라미터가 있을 때 context에 포함되는지 테스트"""
        response = self.client.get(reverse('signup') + '?next=/posts/trending')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['next_url'], '/posts/trending')

    def test_signup_page_without_next_parameter(self):
        """회원가입 페이지에 next 파라미터가 없을 때 빈 문자열로 처리되는지 테스트"""
        response = self.client.get(reverse('signup'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['next_url'], '')

    def test_signup_page_redirects_authenticated_user(self):
        """이미 로그인된 사용자는 홈으로 리다이렉트"""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get(reverse('signup'))
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, '/')

    def test_signup_page_redirects_authenticated_user_to_next_url(self):
        """이미 로그인된 사용자는 next URL로 리다이렉트"""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get(reverse('signup') + '?next=/setting/posts')
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, '/setting/posts', fetch_redirect_response=False)

    def test_signup_page_rejects_external_redirect(self):
        """외부 도메인으로의 리다이렉트는 차단"""
        response = self.client.get(reverse('signup') + '?next=https://evil.com/phishing')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['next_url'], '')

    def test_signup_page_rejects_javascript_url(self):
        """javascript: URL은 차단"""
        response = self.client.get(reverse('signup') + '?next=javascript:alert(1)')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['next_url'], '')

    def test_signup_page_accepts_relative_url(self):
        """상대 URL은 허용"""
        response = self.client.get(reverse('signup') + '?next=/setting/account')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['next_url'], '/setting/account')
