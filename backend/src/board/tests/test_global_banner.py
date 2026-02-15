from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User

from board.models import (
    Profile, SiteBanner, SiteContentScope,
    BannerType, BannerPosition,
)
from board.services.banner_service import BannerService


class SiteBannerModelTestCase(TestCase):
    """SiteBanner model tests"""

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_superuser(
            username='admin',
            password='admin',
            email='admin@test.com',
        )

    def test_create_global_banner(self):
        """글로벌 배너 생성 테스트"""
        banner = SiteBanner.objects.create(
            scope=SiteContentScope.GLOBAL,
            user=self.admin,
            title='Test Global Banner',
            content_html='<div>Global Banner</div>',
            banner_type='horizontal',
            position='top',
        )
        self.assertEqual(banner.banner_type, 'horizontal')
        self.assertEqual(banner.position, 'top')
        self.assertTrue(banner.is_active)
        self.assertEqual(banner.user, self.admin)
        self.assertEqual(banner.scope, SiteContentScope.GLOBAL)

    def test_global_banner_no_sanitization(self):
        """글로벌 배너는 HTML sanitize하지 않음"""
        banner = SiteBanner.objects.create(
            scope=SiteContentScope.GLOBAL,
            user=self.admin,
            title='Banner with Script',
            content_html='<div>Content</div><script>alert("test")</script>',
            banner_type='horizontal',
            position='top',
        )
        # Script tag should be preserved (no sanitization at model level)
        self.assertIn('<script>', banner.content_html)

    def test_horizontal_banner_invalid_position(self):
        """줄배너 잘못된 위치 검증 테스트"""
        banner = SiteBanner(
            scope=SiteContentScope.GLOBAL,
            title='Invalid Banner',
            content_html='<div>Test</div>',
            banner_type='horizontal',
            position='left',  # Invalid for horizontal
        )
        with self.assertRaises(ValidationError):
            banner.clean()

    def test_sidebar_banner_invalid_position(self):
        """사이드배너 잘못된 위치 검증 테스트"""
        banner = SiteBanner(
            scope=SiteContentScope.GLOBAL,
            title='Invalid Banner',
            content_html='<div>Test</div>',
            banner_type='sidebar',
            position='top',  # Invalid for sidebar
        )
        with self.assertRaises(ValidationError):
            banner.clean()


class BannerServiceTestCase(TestCase):
    """BannerService 테스트"""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='testuser',
            password='test',
            email='test@test.com',
        )
        Profile.objects.create(user=cls.user)

    def _create_user_banner(self, **kwargs):
        defaults = dict(
            scope=SiteContentScope.USER,
            user=self.user,
            title='User Banner',
            content_html='<div>User Content</div>',
            banner_type='horizontal',
            position='top',
            is_active=True,
        )
        defaults.update(kwargs)
        return SiteBanner.objects.create(**defaults)

    def _create_global_banner(self, **kwargs):
        defaults = dict(
            scope=SiteContentScope.GLOBAL,
            title='Global Banner',
            content_html='<div>Global Content</div>',
            banner_type='horizontal',
            position='top',
            is_active=True,
        )
        defaults.update(kwargs)
        return SiteBanner.objects.create(**defaults)

    def test_get_combined_banners_empty(self):
        """배너가 없을 때 빈 리스트 반환"""
        result = BannerService.get_combined_banners_for_position(
            self.user,
            BannerType.HORIZONTAL,
            BannerPosition.TOP
        )
        self.assertEqual(len(result), 0)

    def test_get_combined_banners_only_user_banners(self):
        """사용자 배너만 있을 때"""
        self._create_user_banner()

        result = BannerService.get_combined_banners_for_position(
            self.user,
            BannerType.HORIZONTAL,
            BannerPosition.TOP
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].title, 'User Banner')

    def test_get_combined_banners_only_global_banners(self):
        """글로벌 배너만 있을 때"""
        self._create_global_banner()

        result = BannerService.get_combined_banners_for_position(
            self.user,
            BannerType.HORIZONTAL,
            BannerPosition.TOP
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].title, 'Global Banner')

    def test_get_combined_banners_both_types(self):
        """사용자 배너와 글로벌 배너가 모두 있을 때"""
        self._create_user_banner(order=1)
        self._create_global_banner(order=2)

        result = BannerService.get_combined_banners_for_position(
            self.user,
            BannerType.HORIZONTAL,
            BannerPosition.TOP
        )
        self.assertEqual(len(result), 2)
        # Should be sorted by order
        self.assertEqual(result[0].title, 'User Banner')
        self.assertEqual(result[1].title, 'Global Banner')

    def test_get_combined_banners_ordering(self):
        """배너 순서 정렬 테스트 (order 우선, 같으면 created_date 역순)"""
        import time

        # Create banners with same order but different timestamps
        self._create_user_banner(title='Banner 1', order=1)
        time.sleep(0.01)  # Small delay to ensure different timestamps
        self._create_global_banner(title='Banner 2', order=1)

        result = BannerService.get_combined_banners_for_position(
            self.user,
            BannerType.HORIZONTAL,
            BannerPosition.TOP
        )
        self.assertEqual(len(result), 2)
        # Same order, so newer (Banner 2) should come first
        self.assertEqual(result[0].title, 'Banner 2')
        self.assertEqual(result[1].title, 'Banner 1')

    def test_get_combined_banners_filters_inactive(self):
        """비활성 배너는 제외됨"""
        self._create_user_banner(title='Active User Banner')
        self._create_user_banner(title='Inactive User Banner', is_active=False)
        self._create_global_banner(title='Inactive Global Banner', is_active=False)

        result = BannerService.get_combined_banners_for_position(
            self.user,
            BannerType.HORIZONTAL,
            BannerPosition.TOP
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].title, 'Active User Banner')

    def test_get_combined_banners_filters_by_position(self):
        """위치별로 필터링됨"""
        self._create_user_banner(title='Top Banner', position='top')
        self._create_user_banner(title='Bottom Banner', position='bottom')

        result = BannerService.get_combined_banners_for_position(
            self.user,
            BannerType.HORIZONTAL,
            BannerPosition.TOP
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].title, 'Top Banner')

    def test_get_all_banners_for_author_structure(self):
        """모든 배너를 가져올 때 올바른 구조 반환"""
        self._create_user_banner(title='Top Banner', position='top')
        self._create_user_banner(title='Left Banner', banner_type='sidebar', position='left')

        result = BannerService.get_all_banners_for_author(self.user)

        # Should have all 4 position keys
        self.assertIn('top', result)
        self.assertIn('bottom', result)
        self.assertIn('left', result)
        self.assertIn('right', result)

        # Check correct content
        self.assertEqual(len(result['top']), 1)
        self.assertEqual(result['top'][0].title, 'Top Banner')
        self.assertEqual(len(result['left']), 1)
        self.assertEqual(result['left'][0].title, 'Left Banner')
        self.assertEqual(len(result['bottom']), 0)
        self.assertEqual(len(result['right']), 0)

    def test_get_all_banners_includes_global_banners(self):
        """get_all_banners_for_author가 글로벌 배너도 포함함"""
        self._create_global_banner(title='Global Top Banner')

        result = BannerService.get_all_banners_for_author(self.user)

        self.assertEqual(len(result['top']), 1)
        self.assertEqual(result['top'][0].title, 'Global Top Banner')
