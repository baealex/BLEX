from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User

from board.models import (
    SiteNotice, SiteBanner, SiteContentScope,
    BannerType, BannerPosition,
)


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
