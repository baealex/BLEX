from datetime import UTC, datetime

from django.conf import settings
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from board.models import Config, User


class PageLocaleAssertions:
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


class LocaleIntegrationTestCase(PageLocaleAssertions, TestCase):
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


@override_settings(LANGUAGE_CODE='ko', LANGUAGES=[('ko', 'Korean'), ('en', 'English')], TIME_ZONE='Asia/Seoul')
class RegionalPreferencesTestCase(PageLocaleAssertions, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='reader', date_joined=datetime(2026, 1, 2, 1, tzinfo=UTC))

    def save_preferences(self, language, time_zone):
        return self.client.put(
            '/v1/setting/regional-preferences',
            {'language': language, 'time_zone': time_zone},
            content_type='application/json',
        )

    def test_account_preferences_apply_to_pages_and_api_in_another_session(self):
        self.client.force_login(self.user)
        self.assertEqual(self.save_preferences('en', 'America/Los_Angeles').json()['status'], 'DONE')

        other_browser = Client(HTTP_ACCEPT_LANGUAGE='ko-KR')
        other_browser.cookies[settings.LANGUAGE_COOKIE_NAME] = 'ko'
        other_browser.force_login(self.user)
        page = other_browser.get(reverse('search'))
        self.assertEqual(page['Content-Language'], 'en')
        self.assert_page_locale(page, 'en')
        self.assertRegex(page.content.decode(), r'timeZone\s*:\s*["\x27`]America/Los_Angeles["\x27`]')
        self.assertIn('Cookie', page['Vary'])

        account = other_browser.get('/v1/setting/account')
        self.assertEqual(account['Content-Language'], 'en')
        self.assertEqual(account.json()['body']['createdDate'], '2026-01-01')
        preferences = account.json()['body']['regionalPreferences']
        self.assertEqual((preferences['language'], preferences['timeZone']), ('en', 'America/Los_Angeles'))
        self.assertIn('America/Los_Angeles', preferences['timeZones'])

        self.assertEqual(timezone.get_current_timezone_name(), 'Asia/Seoul')

    def test_existing_accounts_follow_browser_language_until_a_preference_is_saved(self):
        self.client.force_login(self.user)
        initial = self.client.get('/v1/setting/account', HTTP_ACCEPT_LANGUAGE='en-US')
        self.assertEqual(initial['Content-Language'], 'en')
        self.assertEqual(initial.json()['body']['createdDate'], '2026-01-02')

        self.assertEqual(self.save_preferences('', '').json()['status'], 'DONE')
        default_page = self.client.get('/v1/setting/account', HTTP_ACCEPT_LANGUAGE='en-US')
        self.assertEqual(default_page['Content-Language'], 'ko')

        self.assertEqual(self.save_preferences(None, '').json()['status'], 'DONE')
        config = Config.objects.get(user=self.user)
        self.assertEqual((config.language, config.time_zone), (None, ''))

    @override_settings(LANGUAGES=[('ko', 'Korean')])
    def test_validation_preserves_preferences_and_respects_available_languages(self):
        Config.objects.create(user=self.user, language='en', time_zone='Asia/Tokyo')
        self.client.force_login(self.user)
        invalid_language = self.save_preferences('en', 'UTC')
        invalid_zone = self.save_preferences('ko', 'Mars/Olympus')

        self.assertEqual(invalid_language['Content-Language'], 'ko')
        self.assertEqual(invalid_language.json()['messageKey'], 'settings.regional_preferences.invalid_language')
        self.assertEqual(invalid_zone.json()['messageKey'], 'settings.regional_preferences.invalid_time_zone')
        config = Config.objects.get(user=self.user)
        self.assertEqual((config.language, config.time_zone), ('en', 'Asia/Tokyo'))

    def test_regional_preferences_require_authentication(self):
        response = self.save_preferences('en', 'UTC')

        self.assertEqual(response.json()['errorCode'], 'error:NL')
        self.assertFalse(Config.objects.filter(user=self.user).exists())
