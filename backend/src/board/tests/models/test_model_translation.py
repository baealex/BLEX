from django.core.exceptions import ValidationError
from django.test import SimpleTestCase
from django.utils import translation

from board.models import (
    IntegrationSetting,
    LoginSetting,
    SiteSetting,
    SocialAuthProvider,
    StaticPage,
    WebhookSubscription,
)


class ModelTranslationTestCase(SimpleTestCase):
    def test_setting_metadata_follows_active_language(self):
        cases = (
            (
                'en',
                '🏢 [Site operations] Site settings',
                'Official site name.',
                'Enable Telegram bot integration.',
                'Page title.',
                'Consecutive webhook delivery failures',
            ),
            (
                'ko',
                '🏢 [사이트 운영] 사이트 설정',
                '사이트 공식 이름입니다.',
                '텔레그램 봇 연동을 사용합니다.',
                '페이지 제목입니다.',
                '연속으로 실패한 웹훅 전송 횟수입니다.',
            ),
        )

        for (
            language,
            model_name,
            site_help,
            telegram_help,
            page_help,
            webhook_help,
        ) in cases:
            with self.subTest(language=language), translation.override(language):
                self.assertEqual(str(SiteSetting._meta.verbose_name), model_name)
                self.assertEqual(
                    str(SiteSetting._meta.get_field('site_name').help_text),
                    site_help,
                )
                self.assertEqual(
                    str(IntegrationSetting._meta.get_field('telegram_enabled').help_text),
                    telegram_help,
                )
                self.assertEqual(
                    str(StaticPage._meta.get_field('title').help_text),
                    page_help,
                )
                self.assertEqual(
                    str(WebhookSubscription._meta.get_field('failure_count').help_text),
                    webhook_help,
                )

    def test_model_validation_message_follows_active_language(self):
        provider = SocialAuthProvider(key='unsupported')

        for language, expected_message in (
            ('en', 'This social login provider is not supported.'),
            ('ko', '지원하지 않는 소셜 로그인 제공자입니다.'),
        ):
            with self.subTest(language=language), translation.override(language):
                with self.assertRaises(ValidationError) as raised:
                    provider.clean()

                self.assertEqual(
                    raised.exception.message_dict['key'],
                    [expected_message],
                )

    def test_singleton_labels_follow_active_language(self):
        with translation.override('en'):
            self.assertEqual(str(LoginSetting()), 'Login settings')
            self.assertEqual(str(IntegrationSetting()), 'Integration settings')
            self.assertEqual(str(SiteSetting()), 'Site settings')
        with translation.override('ko'):
            self.assertEqual(str(LoginSetting()), '로그인 설정')
            self.assertEqual(str(IntegrationSetting()), '연동 설정')
            self.assertEqual(str(SiteSetting()), '사이트 기본 설정')
