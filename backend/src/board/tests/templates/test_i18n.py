from django.conf import settings
from django.test import TestCase, override_settings
from django.urls import reverse


class LocaleIntegrationTestCase(TestCase):
    def assert_page_locale(self, response, locale):
        content = response.content.decode()
        self.assertRegex(
            content,
            rf'<html\b[^>]*\blang=["\']?{locale}["\']?[\s>]',
        )
        self.assertRegex(
            content,
            rf'locale\s*:\s*[`"\']{locale}[`"\']',
        )

    def test_search_page_uses_korean_consistently_by_default(self):
        response = self.client.get(reverse('search'), {'q': 'Python'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Language'], 'ko')
        self.assert_page_locale(response, 'ko')
        self.assertContains(response, '검색: Python -')

    def test_search_page_uses_english_consistently_when_negotiated(self):
        response = self.client.get(
            reverse('search'),
            {'q': '리액트 & React'},
            HTTP_ACCEPT_LANGUAGE='en-US,en;q=0.9',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Language'], 'en')
        self.assert_page_locale(response, 'en')
        self.assertContains(response, 'Search: 리액트 & React -')
        self.assertContains(response, 'Log in')
        self.assertContains(response, 'Sign up')
        self.assertContains(response, 'Switch to dark mode')
        self.assertNotContains(response, '로그인')

    def test_shared_navigation_stays_korean_for_korean_requests(self):
        response = self.client.get(reverse('search'), HTTP_ACCEPT_LANGUAGE='ko-KR')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '로그인')
        self.assertContains(response, '회원가입')
        self.assertContains(response, '다크 모드로 전환')

    def test_language_endpoint_persists_the_selected_locale(self):
        response = self.client.post(
            reverse('set_language'),
            {'language': 'en', 'next': reverse('search')},
        )

        self.assertRedirects(response, reverse('search'), fetch_redirect_response=False)
        self.assertEqual(response.cookies[settings.LANGUAGE_COOKIE_NAME].value, 'en')

        page = self.client.get(reverse('search'))
        self.assertEqual(page['Content-Language'], 'en')
        self.assert_page_locale(page, 'en')

    def test_language_endpoint_does_not_redirect_to_an_external_origin(self):
        response = self.client.post(
            reverse('set_language'),
            {'language': 'en', 'next': 'https://example.com/phishing'},
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], '/')

    @override_settings(LANGUAGES=[('ko', 'Korean')])
    def test_unsupported_english_request_falls_back_to_korean(self):
        response = self.client.get(
            reverse('search'),
            HTTP_ACCEPT_LANGUAGE='en',
        )

        self.assertEqual(response['Content-Language'], 'ko')
        self.assert_page_locale(response, 'ko')
