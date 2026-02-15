import json

from django.test import TestCase
from django.test.client import Client

from board.models import User, Profile, SiteBanner, SiteContentScope


class GlobalBannerAPITestCase(TestCase):
    """GlobalBanner API endpoint tests"""

    @classmethod
    def setUpTestData(cls):
        cls.staff_user = User.objects.create_user(
            username='staffuser',
            password='test',
            email='staff@test.com',
            is_staff=True,
        )
        Profile.objects.create(user=cls.staff_user)

        cls.normal_user = User.objects.create_user(
            username='normaluser',
            password='test',
            email='normal@test.com',
        )
        Profile.objects.create(user=cls.normal_user)

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        self.client.login(username='staffuser', password='test')

    def _create_global_banner(self, **kwargs):
        defaults = dict(
            scope=SiteContentScope.GLOBAL,
            user=self.staff_user,
            title='Test Banner',
            content_html='<div>Test</div>',
            banner_type='horizontal',
            position='top',
        )
        defaults.update(kwargs)
        return SiteBanner.objects.create(**defaults)

    def test_get_banners_not_login(self):
        """비로그인 상태에서 글로벌 배너 목록 조회 시 에러 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        response = client.get('/v1/global-banners')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_banners_normal_user(self):
        """일반 유저가 글로벌 배너 목록 조회 시 권한 거부 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')
        response = client.get('/v1/global-banners')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_get_banners_empty(self):
        """글로벌 배너 목록 조회 - 빈 목록 테스트"""
        response = self.client.get('/v1/global-banners')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(len(content['body']['banners']), 0)

    def test_create_banner(self):
        """글로벌 배너 생성 테스트"""
        data = {
            'title': 'Test Banner',
            'content_html': '<div>Banner Content</div>',
            'banner_type': 'horizontal',
            'position': 'top',
        }
        response = self.client.post(
            '/v1/global-banners',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Test Banner')
        self.assertEqual(content['body']['createdBy'], 'staffuser')

        # DB에서 created_by(user) 확인
        banner = SiteBanner.objects.get(title='Test Banner')
        self.assertEqual(banner.user, self.staff_user)
        self.assertEqual(banner.scope, SiteContentScope.GLOBAL)

    def test_create_banner_without_title(self):
        """제목 없이 글로벌 배너 생성 시 에러 테스트"""
        data = {
            'content_html': '<div>Content</div>',
        }
        response = self.client.post(
            '/v1/global-banners',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_create_banner_without_content(self):
        """내용 없이 글로벌 배너 생성 시 에러 테스트"""
        data = {
            'title': 'No Content Banner',
        }
        response = self.client.post(
            '/v1/global-banners',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_create_banner_invalid_type_position(self):
        """줄배너+좌측 조합 시 에러 테스트"""
        data = {
            'title': 'Invalid Banner',
            'content_html': '<div>Content</div>',
            'banner_type': 'horizontal',
            'position': 'left',
        }
        response = self.client.post(
            '/v1/global-banners',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_create_banner_no_sanitization(self):
        """글로벌 배너는 HTML sanitize하지 않음 (script 태그 보존)"""
        data = {
            'title': 'Script Banner',
            'content_html': '<div>Content</div><script>alert("test")</script>',
            'banner_type': 'horizontal',
            'position': 'top',
        }
        response = self.client.post(
            '/v1/global-banners',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIn('<script>', content['body']['contentHtml'])

    def test_get_banner_detail(self):
        """글로벌 배너 상세 조회 테스트"""
        banner = self._create_global_banner(title='Detail Banner', content_html='<div>Detail</div>')

        response = self.client.get(f'/v1/global-banners/{banner.id}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Detail Banner')

    def test_update_banner(self):
        """글로벌 배너 수정 테스트"""
        banner = self._create_global_banner(title='Original Title', content_html='<div>Original</div>')

        data = {
            'title': 'Updated Title',
            'content_html': '<div>Updated</div>',
        }
        response = self.client.put(
            f'/v1/global-banners/{banner.id}',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Updated Title')

        banner.refresh_from_db()
        self.assertEqual(banner.title, 'Updated Title')

    def test_delete_banner(self):
        """글로벌 배너 삭제 테스트"""
        banner = self._create_global_banner(title='Delete Banner', content_html='<div>Delete</div>')

        response = self.client.delete(f'/v1/global-banners/{banner.id}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        self.assertFalse(SiteBanner.objects.filter(id=banner.id).exists())

    def test_update_banner_order(self):
        """글로벌 배너 순서 변경 테스트"""
        banner1 = self._create_global_banner(title='Banner 1', content_html='<div>1</div>', order=0)
        banner2 = self._create_global_banner(title='Banner 2', content_html='<div>2</div>', order=1)

        data = {
            'order': [[banner1.id, 1], [banner2.id, 0]]
        }
        response = self.client.put(
            '/v1/global-banners/order',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        banner1.refresh_from_db()
        banner2.refresh_from_db()
        self.assertEqual(banner1.order, 1)
        self.assertEqual(banner2.order, 0)

    def test_normal_user_cannot_create(self):
        """일반 유저가 글로벌 배너 생성 불가 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')

        data = {
            'title': 'Unauthorized Banner',
            'content_html': '<div>Content</div>',
        }
        response = client.post(
            '/v1/global-banners',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_normal_user_cannot_reorder(self):
        """일반 유저가 글로벌 배너 순서 변경 불가 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')

        data = {'order': [[1, 0]]}
        response = client.put(
            '/v1/global-banners/order',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
