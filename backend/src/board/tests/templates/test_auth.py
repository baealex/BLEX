"""
인증 템플릿 테스트
URL: /login, /sign
"""
from django.test import TestCase, Client
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
            password='testpass123'
        )
        Profile.objects.create(user=self.user)
        Config.objects.create(user=self.user)

    def test_login_page_renders(self):
        """로그인 페이지가 정상적으로 렌더링되는지 테스트"""
        response = self.client.get(reverse('login'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/auth/login.html')

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

    def test_login_page_accepts_relative_url(self):
        """상대 URL은 허용"""
        response = self.client.get(reverse('login') + '?next=/setting/profile')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['next_url'], '/setting/profile')

    def test_login_page_accepts_url_with_query_params(self):
        """쿼리 파라미터가 있는 URL은 허용"""
        response = self.client.get(reverse('login') + '?next=/posts/search?q=test')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['next_url'], '/posts/search')


class SignupViewTestCase(TestCase):
    """회원가입 페이지 템플릿 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        Profile.objects.create(user=self.user)

    def test_signup_page_renders(self):
        """회원가입 페이지가 정상적으로 렌더링되는지 테스트"""
        response = self.client.get(reverse('signup'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/auth/signup.html')

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
