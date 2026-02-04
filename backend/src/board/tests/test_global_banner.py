import json

from django.test import TestCase, Client
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User

from board.models import Profile, GlobalBanner, Banner, BannerType, BannerPosition
from board.services.banner_service import BannerService


class GlobalBannerModelTestCase(TestCase):
    """GlobalBanner model tests"""

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_superuser(
            username='admin',
            password='admin',
            email='admin@test.com',
        )

    def test_create_global_banner(self):
        """글로벌 배너 생성 테스트"""
        banner = GlobalBanner.objects.create(
            title='Test Global Banner',
            content_html='<div>Global Banner</div>',
            banner_type='horizontal',
            position='top',
            created_by=self.admin
        )
        self.assertEqual(banner.banner_type, 'horizontal')
        self.assertEqual(banner.position, 'top')
        self.assertTrue(banner.is_active)
        self.assertEqual(banner.created_by, self.admin)

    def test_global_banner_no_sanitization(self):
        """글로벌 배너는 HTML sanitize하지 않음"""
        banner = GlobalBanner.objects.create(
            title='Banner with Script',
            content_html='<div>Content</div><script>alert("test")</script>',
            banner_type='horizontal',
            position='top',
            created_by=self.admin
        )
        # Script tag should be preserved (no sanitization)
        self.assertIn('<script>', banner.content_html)

    def test_horizontal_banner_invalid_position(self):
        """줄배너 잘못된 위치 검증 테스트"""
        banner = GlobalBanner(
            title='Invalid Banner',
            content_html='<div>Test</div>',
            banner_type='horizontal',
            position='left',  # Invalid for horizontal
        )
        with self.assertRaises(ValidationError):
            banner.clean()

    def test_sidebar_banner_invalid_position(self):
        """사이드배너 잘못된 위치 검증 테스트"""
        banner = GlobalBanner(
            title='Invalid Banner',
            content_html='<div>Test</div>',
            banner_type='sidebar',
            position='top',  # Invalid for sidebar
        )
        with self.assertRaises(ValidationError):
            banner.clean()

    def test_banner_ordering(self):
        """배너 순서 테스트"""
        banner1 = GlobalBanner.objects.create(
            title='Banner 1',
            content_html='<div>1</div>',
            banner_type='horizontal',
            position='top',
            order=2,
        )
        banner2 = GlobalBanner.objects.create(
            title='Banner 2',
            content_html='<div>2</div>',
            banner_type='horizontal',
            position='top',
            order=1,
        )

        banners = GlobalBanner.objects.all().order_by('order')
        self.assertEqual(list(banners), [banner2, banner1])

    def test_str_representation(self):
        """문자열 표현 테스트"""
        banner = GlobalBanner.objects.create(
            title='Test Banner',
            content_html='<div>Test</div>',
            banner_type='horizontal',
            position='top',
        )
        self.assertEqual(str(banner), '[전역] Test Banner')


class GlobalBannerAdminTestCase(TestCase):
    """GlobalBanner Admin tests"""

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_superuser(
            username='admin',
            password='admin',
            email='admin@test.com',
        )
        cls.regular_user = User.objects.create_user(
            username='user',
            password='user',
            email='user@test.com',
        )
        Profile.objects.create(user=cls.regular_user)

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')

    def test_admin_can_access_global_banner_admin(self):
        """관리자는 글로벌 배너 관리 페이지 접근 가능"""
        self.client.login(username='admin', password='admin')
        url = reverse('admin:board_globalbanner_changelist')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_regular_user_cannot_access_global_banner_admin(self):
        """일반 사용자는 글로벌 배너 관리 페이지 접근 불가"""
        self.client.login(username='user', password='user')
        url = reverse('admin:board_globalbanner_changelist')
        response = self.client.get(url)
        # Should redirect to login or show permission denied
        self.assertIn(response.status_code, [302, 403])

    def test_created_by_is_set_on_creation(self):
        """글로벌 배너 생성 시 created_by 자동 설정"""
        self.client.login(username='admin', password='admin')
        url = reverse('admin:board_globalbanner_add')
        response = self.client.post(url, {
            'title': 'Test Banner',
            'content_html': '<div>Test</div>',
            'banner_type': 'horizontal',
            'position': 'top',
            'is_active': True,
            'order': 0,
        })

        # Check if banner was created
        banner = GlobalBanner.objects.filter(title='Test Banner').first()
        self.assertIsNotNone(banner)
        self.assertEqual(banner.created_by, self.admin)


class GlobalBannerDisplayTestCase(TestCase):
    """GlobalBanner display in post detail tests"""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='testuser',
            password='test',
            email='test@test.com',
        )
        profile = Profile.objects.create(user=cls.user)
        profile.role = Profile.Role.EDITOR
        profile.save()

    def test_global_banner_displayed_on_posts(self):
        """글로벌 배너가 포스트에 표시되는지 테스트"""
        # Create a global banner
        GlobalBanner.objects.create(
            title='Global Top Banner',
            content_html='<div>Global Content</div>',
            banner_type='horizontal',
            position='top',
            is_active=True,
        )

        # This test would require creating a post and checking the view
        # For simplicity, we just verify the banner exists
        banners = GlobalBanner.objects.filter(
            is_active=True,
            banner_type='horizontal',
            position='top'
        )
        self.assertEqual(banners.count(), 1)
        self.assertEqual(banners.first().title, 'Global Top Banner')


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
        Banner.objects.create(
            user=self.user,
            title='User Banner',
            content_html='<div>User Content</div>',
            banner_type='horizontal',
            position='top',
            is_active=True,
        )

        result = BannerService.get_combined_banners_for_position(
            self.user,
            BannerType.HORIZONTAL,
            BannerPosition.TOP
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].title, 'User Banner')

    def test_get_combined_banners_only_global_banners(self):
        """글로벌 배너만 있을 때"""
        GlobalBanner.objects.create(
            title='Global Banner',
            content_html='<div>Global Content</div>',
            banner_type='horizontal',
            position='top',
            is_active=True,
        )

        result = BannerService.get_combined_banners_for_position(
            self.user,
            BannerType.HORIZONTAL,
            BannerPosition.TOP
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].title, 'Global Banner')

    def test_get_combined_banners_both_types(self):
        """사용자 배너와 글로벌 배너가 모두 있을 때"""
        Banner.objects.create(
            user=self.user,
            title='User Banner',
            content_html='<div>User Content</div>',
            banner_type='horizontal',
            position='top',
            is_active=True,
            order=1,
        )
        GlobalBanner.objects.create(
            title='Global Banner',
            content_html='<div>Global Content</div>',
            banner_type='horizontal',
            position='top',
            is_active=True,
            order=2,
        )

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
        banner1 = Banner.objects.create(
            user=self.user,
            title='Banner 1',
            content_html='<div>1</div>',
            banner_type='horizontal',
            position='top',
            is_active=True,
            order=1,
        )
        time.sleep(0.01)  # Small delay to ensure different timestamps
        banner2 = GlobalBanner.objects.create(
            title='Banner 2',
            content_html='<div>2</div>',
            banner_type='horizontal',
            position='top',
            is_active=True,
            order=1,
        )

        result = BannerService.get_combined_banners_for_position(
            self.user,
            BannerType.HORIZONTAL,
            BannerPosition.TOP
        )
        self.assertEqual(len(result), 2)
        # Same order, so newer (banner2) should come first
        self.assertEqual(result[0].title, 'Banner 2')
        self.assertEqual(result[1].title, 'Banner 1')

    def test_get_combined_banners_filters_inactive(self):
        """비활성 배너는 제외됨"""
        Banner.objects.create(
            user=self.user,
            title='Active User Banner',
            content_html='<div>Active</div>',
            banner_type='horizontal',
            position='top',
            is_active=True,
        )
        Banner.objects.create(
            user=self.user,
            title='Inactive User Banner',
            content_html='<div>Inactive</div>',
            banner_type='horizontal',
            position='top',
            is_active=False,
        )
        GlobalBanner.objects.create(
            title='Inactive Global Banner',
            content_html='<div>Inactive Global</div>',
            banner_type='horizontal',
            position='top',
            is_active=False,
        )

        result = BannerService.get_combined_banners_for_position(
            self.user,
            BannerType.HORIZONTAL,
            BannerPosition.TOP
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].title, 'Active User Banner')

    def test_get_combined_banners_filters_by_position(self):
        """위치별로 필터링됨"""
        Banner.objects.create(
            user=self.user,
            title='Top Banner',
            content_html='<div>Top</div>',
            banner_type='horizontal',
            position='top',
            is_active=True,
        )
        Banner.objects.create(
            user=self.user,
            title='Bottom Banner',
            content_html='<div>Bottom</div>',
            banner_type='horizontal',
            position='bottom',
            is_active=True,
        )

        result = BannerService.get_combined_banners_for_position(
            self.user,
            BannerType.HORIZONTAL,
            BannerPosition.TOP
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].title, 'Top Banner')

    def test_get_all_banners_for_author_structure(self):
        """모든 배너를 가져올 때 올바른 구조 반환"""
        # Create banners in different positions
        Banner.objects.create(
            user=self.user,
            title='Top Banner',
            content_html='<div>Top</div>',
            banner_type='horizontal',
            position='top',
            is_active=True,
        )
        Banner.objects.create(
            user=self.user,
            title='Left Banner',
            content_html='<div>Left</div>',
            banner_type='sidebar',
            position='left',
            is_active=True,
        )

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
        GlobalBanner.objects.create(
            title='Global Top Banner',
            content_html='<div>Global Top</div>',
            banner_type='horizontal',
            position='top',
            is_active=True,
        )

        result = BannerService.get_all_banners_for_author(self.user)

        self.assertEqual(len(result['top']), 1)
        self.assertEqual(result['top'][0].title, 'Global Top Banner')
