import json

from django.test import TestCase
from django.test.client import Client
from django.core.exceptions import ValidationError

from board.models import User, Profile, SiteBanner, SiteContentScope


class BannerModelTestCase(TestCase):
    """SiteBanner model validation tests"""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='test',
            password='test',
            email='test@test.com',
        )
        Profile.objects.create(user=cls.user)

    def test_horizontal_banner_invalid_position(self):
        """줄배너 잘못된 위치 검증 테스트"""
        banner = SiteBanner(
            scope=SiteContentScope.USER,
            user=self.user,
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
            scope=SiteContentScope.USER,
            user=self.user,
            title='Invalid Banner',
            content_html='<div>Test</div>',
            banner_type='sidebar',
            position='top',  # Invalid for sidebar
        )
        with self.assertRaises(ValidationError):
            banner.clean()


class BannerAPITestCase(TestCase):
    """Banner API endpoint tests"""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='test',
            password='test',
            email='test@test.com',
        )
        profile = Profile.objects.create(user=cls.user)
        # Set user as editor for banner API access
        profile.role = Profile.Role.EDITOR
        profile.save()

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        self.client.login(username='test', password='test')

    def _create_user_banner(self, **kwargs):
        defaults = dict(
            scope=SiteContentScope.USER,
            user=self.user,
            title='Test Banner',
            content_html='<div>Test</div>',
            banner_type='horizontal',
            position='top',
        )
        defaults.update(kwargs)
        return SiteBanner.objects.create(**defaults)

    def test_get_banners_not_login(self):
        """비로그인 상태에서 배너 목록 조회 시 에러 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        response = client.get('/v1/banners')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_banners_empty(self):
        """배너 목록 조회 - 빈 목록 테스트"""
        response = self.client.get('/v1/banners')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(len(content['body']['banners']), 0)

    def test_create_banner(self):
        """배너 생성 테스트"""
        data = {
            'title': 'Test Banner',
            'content_html': '<div>Test Content</div>',
            'banner_type': 'horizontal',
            'position': 'top',
            'is_active': True,
            'order': 0,
        }
        response = self.client.post(
            '/v1/banners',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Test Banner')

        # 배너가 DB에 생성되었는지 확인
        banner = SiteBanner.objects.get(title='Test Banner')
        self.assertEqual(banner.user, self.user)
        self.assertEqual(banner.scope, SiteContentScope.USER)

    def test_create_banner_with_invalid_type_position(self):
        """잘못된 타입-위치 조합으로 배너 생성 시 에러 테스트"""
        data = {
            'title': 'Invalid Banner',
            'content_html': '<div>Test</div>',
            'banner_type': 'horizontal',
            'position': 'left',  # Invalid
        }
        response = self.client.post(
            '/v1/banners',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

        # DB에 생성되지 않았는지 확인
        self.assertFalse(SiteBanner.objects.filter(title='Invalid Banner').exists())

    def test_create_banner_without_title(self):
        """제목 없이 배너 생성 시 에러 테스트"""
        data = {
            'content_html': '<div>Test</div>',
            'banner_type': 'horizontal',
            'position': 'top',
        }
        response = self.client.post(
            '/v1/banners',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_get_banner(self):
        """배너 조회 테스트"""
        banner = self._create_user_banner()

        response = self.client.get(f'/v1/banners/{banner.id}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Test Banner')

    def test_update_banner(self):
        """배너 수정 테스트"""
        banner = self._create_user_banner(title='Original Title', content_html='<div>Original</div>')

        data = {
            'title': 'Updated Title',
            'content_html': '<div>Updated</div>',
        }
        response = self.client.put(
            f'/v1/banners/{banner.id}',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Updated Title')

        # DB에서 확인
        banner.refresh_from_db()
        self.assertEqual(banner.title, 'Updated Title')

    def test_delete_banner(self):
        """배너 삭제 테스트"""
        banner = self._create_user_banner()

        response = self.client.delete(f'/v1/banners/{banner.id}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        # DB에서 삭제되었는지 확인
        self.assertFalse(SiteBanner.objects.filter(id=banner.id).exists())

    def test_update_banner_order(self):
        """배너 순서 변경 테스트"""
        banner1 = self._create_user_banner(title='Banner 1', content_html='<div>1</div>', order=0)
        banner2 = self._create_user_banner(title='Banner 2', content_html='<div>2</div>', order=1)

        data = {
            'order': [
                [banner2.id, 0],
                [banner1.id, 1],
            ]
        }
        response = self.client.put(
            '/v1/banners/order',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        # 순서가 변경되었는지 확인
        banner1.refresh_from_db()
        banner2.refresh_from_db()
        self.assertEqual(banner1.order, 1)
        self.assertEqual(banner2.order, 0)

    def test_get_banners_with_multiple_banners(self):
        """여러 배너 목록 조회 테스트"""
        self._create_user_banner(title='Banner 1', content_html='<div>1</div>')
        self._create_user_banner(title='Banner 2', content_html='<div>2</div>', banner_type='sidebar', position='left')

        response = self.client.get('/v1/banners')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(len(content['body']['banners']), 2)

    def test_user_cannot_access_other_user_banner(self):
        """다른 사용자의 배너 접근 불가 테스트"""
        other_user = User.objects.create_user(
            username='other',
            password='other',
            email='other@test.com',
        )
        other_profile = Profile.objects.create(user=other_user)
        other_profile.role = Profile.Role.EDITOR
        other_profile.save()

        other_banner = SiteBanner.objects.create(
            scope=SiteContentScope.USER,
            user=other_user,
            title='Other Banner',
            content_html='<div>Other</div>',
            banner_type='horizontal',
            position='top',
        )

        # 다른 사용자의 배너 조회 시도
        response = self.client.get(f'/v1/banners/{other_banner.id}')
        self.assertEqual(response.status_code, 404)

        # 다른 사용자의 배너는 여전히 존재해야 함
        self.assertTrue(SiteBanner.objects.filter(id=other_banner.id).exists())
