from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import translation

from board.models import (
    SiteNotice, SiteBanner, SiteContentScope,
    BannerType, BannerPosition,
)
from board.services.site_content_api_service import SiteContentApiService


class SiteNoticeModelTestCase(TestCase):
    """SiteNotice model tests"""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='test',
            password='test',
            email='test@test.com',
        )

    def test_create_user_notice(self):
        """유저 공지 생성 테스트"""
        notice = SiteNotice.objects.create(
            scope=SiteContentScope.USER,
            user=self.user,
            title='Test Notice',
            url='https://example.com',
        )
        self.assertEqual(notice.scope, 'user')
        self.assertEqual(notice.user, self.user)
        self.assertTrue(notice.is_active)

    def test_create_global_notice(self):
        """글로벌 공지 생성 테스트"""
        notice = SiteNotice.objects.create(
            scope=SiteContentScope.GLOBAL,
            title='Global Notice',
            url='https://example.com/global',
        )
        self.assertEqual(notice.scope, 'global')
        self.assertIsNone(notice.user)

    def test_str_representation(self):
        """문자열 표현 테스트"""
        notice = SiteNotice(
            scope=SiteContentScope.GLOBAL,
            title='Hello',
        )
        self.assertEqual(str(notice), '[global] Hello')

    def test_ordering(self):
        """기본 정렬 테스트 (order ASC, created_date DESC)"""
        import time
        SiteNotice.objects.create(
            scope=SiteContentScope.USER,
            user=self.user,
            title='Order 1',
            order=1,
        )
        time.sleep(0.01)
        SiteNotice.objects.create(
            scope=SiteContentScope.USER,
            user=self.user,
            title='Order 0',
            order=0,
        )

        items = list(SiteNotice.objects.all())
        self.assertEqual(items[0].title, 'Order 0')
        self.assertEqual(items[1].title, 'Order 1')


class SiteBannerModelTestCase(TestCase):
    """SiteBanner model tests"""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='test',
            password='test',
            email='test@test.com',
        )

    def test_choices_use_locale_without_changing_stored_values(self):
        self.assertEqual(SiteContentScope.USER.value, 'user')
        self.assertEqual(BannerType.HORIZONTAL.value, 'horizontal')
        self.assertEqual(BannerPosition.LEFT.value, 'left')

        with translation.override('en'):
            self.assertEqual(SiteContentScope.USER.label, 'User')
            self.assertEqual(
                BannerType.HORIZONTAL.label,
                'Full-width banner (horizontal)',
            )
            self.assertEqual(BannerPosition.LEFT.label, 'Left')

        with translation.override('ko'):
            self.assertEqual(SiteContentScope.USER.label, '사용자')
            self.assertEqual(BannerType.HORIZONTAL.label, '줄배너 (가로 전체)')
            self.assertEqual(BannerPosition.LEFT.label, '좌측')

    def test_create_user_banner(self):
        """유저 배너 생성 테스트"""
        banner = SiteBanner.objects.create(
            scope=SiteContentScope.USER,
            user=self.user,
            title='User Banner',
            content_html='<div>Content</div>',
            banner_type=BannerType.HORIZONTAL,
            position=BannerPosition.TOP,
        )
        self.assertEqual(banner.scope, 'user')

    def test_create_global_banner(self):
        """글로벌 배너 생성 테스트"""
        banner = SiteBanner.objects.create(
            scope=SiteContentScope.GLOBAL,
            user=self.user,
            title='Global Banner',
            content_html='<div>Content</div>',
            banner_type=BannerType.SIDEBAR,
            position=BannerPosition.LEFT,
        )
        self.assertEqual(banner.scope, 'global')

    def test_banner_horizontal_top_valid(self):
        """줄배너 + 상단 = 유효"""
        banner = SiteBanner(
            scope=SiteContentScope.USER,
            banner_type=BannerType.HORIZONTAL,
            position=BannerPosition.TOP,
        )
        banner.clean()  # Should not raise

    def test_banner_horizontal_bottom_valid(self):
        """줄배너 + 하단 = 유효"""
        banner = SiteBanner(
            scope=SiteContentScope.USER,
            banner_type=BannerType.HORIZONTAL,
            position=BannerPosition.BOTTOM,
        )
        banner.clean()  # Should not raise

    def test_banner_horizontal_left_invalid(self):
        """줄배너 + 좌측 = 무효"""
        banner = SiteBanner(
            scope=SiteContentScope.USER,
            banner_type=BannerType.HORIZONTAL,
            position=BannerPosition.LEFT,
        )
        with self.assertRaises(ValidationError):
            banner.clean()

    def test_banner_sidebar_left_valid(self):
        """사이드배너 + 좌측 = 유효"""
        banner = SiteBanner(
            scope=SiteContentScope.USER,
            banner_type=BannerType.SIDEBAR,
            position=BannerPosition.LEFT,
        )
        banner.clean()  # Should not raise

    def test_banner_sidebar_top_invalid(self):
        """사이드배너 + 상단 = 무효"""
        banner = SiteBanner(
            scope=SiteContentScope.USER,
            banner_type=BannerType.SIDEBAR,
            position=BannerPosition.TOP,
        )
        with self.assertRaises(ValidationError):
            banner.clean()

    def test_str_representation(self):
        """문자열 표현 테스트"""
        banner = SiteBanner(
            scope=SiteContentScope.GLOBAL,
            title='Hello',
        )
        self.assertEqual(str(banner), '[global] Hello')

    def test_ordering(self):
        """기본 정렬 테스트 (order ASC, created_date DESC)"""
        import time
        SiteBanner.objects.create(
            scope=SiteContentScope.USER,
            user=self.user,
            title='Order 1',
            order=1,
        )
        time.sleep(0.01)
        SiteBanner.objects.create(
            scope=SiteContentScope.USER,
            user=self.user,
            title='Order 0',
            order=0,
        )

        items = list(SiteBanner.objects.all())
        self.assertEqual(items[0].title, 'Order 0')
        self.assertEqual(items[1].title, 'Order 1')


class SiteContentListSerializationPerformanceTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='content-owner',
            password='secret-password',
        )
        SiteNotice.objects.bulk_create([
            SiteNotice(
                scope=SiteContentScope.USER,
                user=cls.user,
                title=f'Notice {index}',
                url=f'https://example.com/{index}',
            )
            for index in range(20)
        ])
        SiteBanner.objects.bulk_create([
            SiteBanner(
                scope=SiteContentScope.GLOBAL,
                user=cls.user,
                title=f'Banner {index}',
                content_html=f'<p>{index}</p>',
            )
            for index in range(20)
        ])

    def test_notice_list_serialization_uses_one_lean_query(self):
        queryset = SiteNotice.objects.filter(user=self.user).order_by('-created_date')

        with CaptureQueriesContext(connection) as queries:
            result = SiteContentApiService.serialize_notice_list(queryset)

        self.assertEqual(len(queries), 1)
        self.assertEqual(len(result), 20)
        selected_columns = queries[0]['sql'].lower().split(' from ')[0]
        self.assertNotIn('user_id', selected_columns)
        self.assertNotIn('scope', selected_columns)

    def test_global_banner_list_serialization_uses_one_lean_query(self):
        queryset = SiteBanner.objects.filter(scope=SiteContentScope.GLOBAL).order_by(
            'order',
            '-created_date',
        )

        with CaptureQueriesContext(connection) as queries:
            result = SiteContentApiService.serialize_banner_list(
                queryset,
                include_created_by=True,
            )

        self.assertEqual(len(queries), 1)
        self.assertEqual(len(result), 20)
        self.assertEqual(result[0]['created_by'], self.user.username)
        sql = queries[0]['sql'].lower()
        self.assertNotIn('password', sql)
        self.assertNotIn('last_login', sql)
