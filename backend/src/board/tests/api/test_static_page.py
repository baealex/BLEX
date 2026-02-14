import json

from django.test import TestCase
from django.test.client import Client

from board.models import User, Profile, StaticPage


class StaticPageAPITestCase(TestCase):
    """Static Page API endpoint tests"""

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

    def test_get_static_pages_not_login(self):
        """비로그인 상태에서 정적 페이지 목록 조회 시 에러 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        response = client.get('/v1/static-pages')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_static_pages_normal_user(self):
        """일반 유저가 정적 페이지 목록 조회 시 권한 거부 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')
        response = client.get('/v1/static-pages')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_get_static_pages_empty(self):
        """정적 페이지 목록 조회 - 빈 목록 테스트"""
        response = self.client.get('/v1/static-pages')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(len(content['body']['pages']), 0)

    def test_create_static_page(self):
        """정적 페이지 생성 테스트"""
        data = {
            'title': 'Test Page',
            'slug': 'test-page',
            'content': '<h1>Test</h1>',
            'meta_description': 'Test description',
            'is_published': True,
            'show_in_footer': False,
            'order': 0,
        }
        response = self.client.post(
            '/v1/static-pages',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Test Page')
        self.assertEqual(content['body']['slug'], 'test-page')

        # DB에 생성되었는지 확인
        page = StaticPage.objects.get(slug='test-page')
        self.assertEqual(page.author, self.staff_user)

    def test_create_static_page_without_title(self):
        """제목 없이 정적 페이지 생성 시 에러 테스트"""
        data = {
            'slug': 'no-title',
            'content': '<p>Content</p>',
        }
        response = self.client.post(
            '/v1/static-pages',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_create_static_page_without_slug(self):
        """슬러그 없이 정적 페이지 생성 시 에러 테스트"""
        data = {
            'title': 'No Slug Page',
            'content': '<p>Content</p>',
        }
        response = self.client.post(
            '/v1/static-pages',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_create_static_page_duplicate_slug(self):
        """중복 슬러그로 정적 페이지 생성 시 에러 테스트"""
        StaticPage.objects.create(
            title='Existing Page',
            slug='duplicate-slug',
            content='<p>Existing</p>',
            author=self.staff_user,
        )

        data = {
            'title': 'New Page',
            'slug': 'duplicate-slug',
            'content': '<p>New</p>',
        }
        response = self.client.post(
            '/v1/static-pages',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:AE')

    def test_get_static_page(self):
        """정적 페이지 상세 조회 테스트"""
        page = StaticPage.objects.create(
            title='Detail Page',
            slug='detail-page',
            content='<p>Detail</p>',
            author=self.staff_user,
        )

        response = self.client.get(f'/v1/static-pages/{page.id}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Detail Page')

    def test_update_static_page(self):
        """정적 페이지 수정 테스트"""
        page = StaticPage.objects.create(
            title='Original Title',
            slug='original-slug',
            content='<p>Original</p>',
            author=self.staff_user,
        )

        data = {
            'title': 'Updated Title',
            'content': '<p>Updated</p>',
        }
        response = self.client.put(
            f'/v1/static-pages/{page.id}',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Updated Title')

        # DB에서 확인
        page.refresh_from_db()
        self.assertEqual(page.title, 'Updated Title')

    def test_update_static_page_duplicate_slug(self):
        """수정 시 중복 슬러그 에러 테스트"""
        StaticPage.objects.create(
            title='Page A',
            slug='slug-a',
            content='<p>A</p>',
            author=self.staff_user,
        )
        page_b = StaticPage.objects.create(
            title='Page B',
            slug='slug-b',
            content='<p>B</p>',
            author=self.staff_user,
        )

        data = {'slug': 'slug-a'}
        response = self.client.put(
            f'/v1/static-pages/{page_b.id}',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:AE')

    def test_update_static_page_same_slug(self):
        """수정 시 자신의 슬러그는 중복 에러가 아닌 테스트"""
        page = StaticPage.objects.create(
            title='Same Slug Page',
            slug='same-slug',
            content='<p>Content</p>',
            author=self.staff_user,
        )

        data = {
            'title': 'Updated Title',
            'slug': 'same-slug',
        }
        response = self.client.put(
            f'/v1/static-pages/{page.id}',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Updated Title')

    def test_delete_static_page(self):
        """정적 페이지 삭제 테스트"""
        page = StaticPage.objects.create(
            title='Delete Page',
            slug='delete-page',
            content='<p>Delete</p>',
            author=self.staff_user,
        )

        response = self.client.delete(f'/v1/static-pages/{page.id}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        # DB에서 삭제되었는지 확인
        self.assertFalse(StaticPage.objects.filter(id=page.id).exists())

    def test_get_static_pages_with_multiple_pages(self):
        """여러 정적 페이지 목록 조회 테스트"""
        StaticPage.objects.create(
            title='Page 1',
            slug='page-1',
            content='<p>1</p>',
            author=self.staff_user,
        )
        StaticPage.objects.create(
            title='Page 2',
            slug='page-2',
            content='<p>2</p>',
            author=self.staff_user,
        )

        response = self.client.get('/v1/static-pages')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(len(content['body']['pages']), 2)

    def test_normal_user_cannot_create(self):
        """일반 유저가 정적 페이지 생성 불가 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')

        data = {
            'title': 'Unauthorized Page',
            'slug': 'unauthorized',
            'content': '<p>Content</p>',
        }
        response = client.post(
            '/v1/static-pages',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_normal_user_cannot_delete(self):
        """일반 유저가 정적 페이지 삭제 불가 테스트"""
        page = StaticPage.objects.create(
            title='Protected Page',
            slug='protected',
            content='<p>Content</p>',
            author=self.staff_user,
        )

        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')

        response = client.delete(f'/v1/static-pages/{page.id}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

        # 페이지가 여전히 존재해야 함
        self.assertTrue(StaticPage.objects.filter(id=page.id).exists())
