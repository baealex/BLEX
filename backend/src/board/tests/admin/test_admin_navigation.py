from django.contrib import admin
from django.contrib.auth.models import User
from django.test import RequestFactory, TestCase
from django.urls import reverse

from board.models import (
    Comment,
    Config,
    EditHistory,
    EditRequest,
    EmailChange,
    Form,
    ImageCache,
    Notify,
    PinnedPost,
    Post,
    Profile,
    Series,
    SiteBanner,
    SiteNotice,
    SocialAuth,
    SocialAuthProvider,
    Tag,
    TelegramSync,
    TwoFactorAuth,
    UserConfigMeta,
    UserLinkMeta,
    UsernameChangeLog,
    WebhookSubscription,
)
from main.admin_site import BlexAdminSite


class AdminNavigationTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_user = User.objects.create_superuser(
            username='navigation-admin',
            email='navigation-admin@example.com',
            password='test',
        )

    def admin_request(self, path='/admin/'):
        request = RequestFactory().get(path)
        request.user = self.admin_user
        return request

    def test_admin_site_groups_every_registered_model_by_operator_task(self):
        self.assertIsInstance(admin.site, BlexAdminSite)

        app_list = admin.site.get_app_list(self.admin_request())

        self.assertEqual(
            [app['name'] for app in app_list],
            ['제품 설정', '콘텐츠', '사용자·권한', '알림·연동', '감사·운영'],
        )
        models_by_group = {
            app['name']: [model['object_name'] for model in app['models']]
            for app in app_list
        }
        self.assertEqual(
            models_by_group['콘텐츠'],
            [
                'Post',
                'Series',
                'Tag',
                'Comment',
                'PinnedPost',
                'EditRequest',
                'SiteNotice',
                'SiteBanner',
            ],
        )
        self.assertEqual(
            models_by_group['사용자·권한'],
            [
                'User',
                'Group',
                'Profile',
                'Config',
                'UserConfigMeta',
                'UserLinkMeta',
            ],
        )
        self.assertEqual(
            models_by_group['알림·연동'],
            [
                'Notify',
                'TelegramSync',
                'WebhookSubscription',
                'SocialAuth',
                'TwoFactorAuth',
            ],
        )
        self.assertEqual(
            models_by_group['감사·운영'],
            [
                'EditHistory',
                'LogEntry',
                'EmailChange',
                'UsernameChangeLog',
                'Form',
                'ImageCache',
                'Site',
            ],
        )
        grouped_registered_models = {
            object_name
            for group_name, object_names in models_by_group.items()
            if group_name != '제품 설정'
            for object_name in object_names
        }
        visible_registered_models = {
            model.__name__
            for model, model_admin in admin.site._registry.items()
            if model_admin.has_module_permission(self.admin_request())
        }
        self.assertSetEqual(
            grouped_registered_models,
            visible_registered_models,
        )

    def test_admin_index_links_to_canonical_product_settings(self):
        self.client.force_login(self.admin_user)

        response = self.client.get(reverse('admin:index'))

        self.assertEqual(response.status_code, 200)
        for group_name in (
            '제품 설정',
            '콘텐츠',
            '사용자·권한',
            '알림·연동',
            '감사·운영',
        ):
            self.assertContains(response, group_name)
        for settings_url in (
            '/admin-settings/site-settings',
            '/admin-settings/login',
            '/admin-settings/integrations',
            '/admin-settings/seo-aeo',
        ):
            self.assertContains(response, settings_url)

        board_index = self.client.get(
            reverse('admin:app_list', args=['board']),
        )
        self.assertEqual(board_index.status_code, 200)

    def test_secret_provider_legacy_urls_redirect_to_canonical_settings(self):
        provider, _ = SocialAuthProvider.objects.get_or_create(key='github')
        provider_admin = admin.site._registry[SocialAuthProvider]
        request = self.admin_request()

        self.assertFalse(provider_admin.has_module_permission(request))
        self.assertFalse(provider_admin.has_view_permission(request, provider))
        self.assertFalse(provider_admin.has_add_permission(request))
        self.assertFalse(provider_admin.has_change_permission(request, provider))
        self.assertFalse(provider_admin.has_delete_permission(request, provider))

        self.client.force_login(self.admin_user)
        legacy_urls = [
            reverse('admin:board_socialauthprovider_changelist'),
            reverse('admin:board_socialauthprovider_add'),
            reverse(
                'admin:board_socialauthprovider_change',
                args=[provider.pk],
            ),
            reverse(
                'admin:board_socialauthprovider_delete',
                args=[provider.pk],
            ),
            reverse(
                'admin:board_socialauthprovider_history',
                args=[provider.pk],
            ),
        ]
        for legacy_url in legacy_urls:
            with self.subTest(legacy_url=legacy_url):
                response = self.client.get(legacy_url)
                self.assertRedirects(
                    response,
                    '/admin-settings/login',
                    fetch_redirect_response=False,
                )

        index_response = self.client.get(reverse('admin:index'))
        self.assertNotContains(index_response, 'Social auth provider')

    def test_registered_board_models_have_korean_admin_names(self):
        expected_names = {
            Comment: '댓글',
            Config: '사용자 설정',
            EditHistory: '포스트 수정 이력',
            EditRequest: '포스트 수정 요청',
            EmailChange: '이메일 변경 요청',
            Form: '사용자 폼',
            ImageCache: '이미지 캐시',
            Notify: '알림',
            PinnedPost: '고정 포스트',
            Post: '포스트',
            Profile: '프로필',
            Series: '시리즈',
            SiteBanner: '사이트 배너',
            SiteNotice: '사이트 공지',
            SocialAuth: '소셜 로그인 연동',
            Tag: '태그',
            TelegramSync: '텔레그램 연동',
            TwoFactorAuth: '2단계 인증',
            UserConfigMeta: '사용자 기능 설정',
            UserLinkMeta: '사용자 링크',
            UsernameChangeLog: '사용자명 변경 이력',
            WebhookSubscription: '웹훅 구독',
        }

        for model, expected_name in expected_names.items():
            with self.subTest(model=model.__name__):
                self.assertEqual(
                    str(model._meta.verbose_name_plural),
                    expected_name,
                )
