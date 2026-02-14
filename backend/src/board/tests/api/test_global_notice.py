import json

from django.test import TestCase
from django.test.client import Client

from board.models import User, Profile, GlobalNotice


class GlobalNoticeAPITestCase(TestCase):
    """GlobalNotice API endpoint tests"""

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

    def test_get_notices_not_login(self):
        """비로그인 상태에서 공지 목록 조회 시 에러 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        response = client.get('/v1/global-notices')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_notices_normal_user(self):
        """일반 유저가 공지 목록 조회 시 권한 거부 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')
        response = client.get('/v1/global-notices')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_get_notices_empty(self):
        """공지 목록 조회 - 빈 목록 테스트"""
        response = self.client.get('/v1/global-notices')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(len(content['body']['notices']), 0)

    def test_create_notice(self):
        """공지 생성 테스트"""
        data = {
            'title': 'Test Notice',
            'url': 'https://example.com',
        }
        response = self.client.post(
            '/v1/global-notices',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Test Notice')
        self.assertEqual(content['body']['url'], 'https://example.com')
        self.assertTrue(content['body']['isActive'])

    def test_create_notice_without_title(self):
        """제목 없이 공지 생성 시 에러 테스트"""
        data = {
            'url': 'https://example.com',
        }
        response = self.client.post(
            '/v1/global-notices',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_create_notice_without_url(self):
        """URL 없이 공지 생성 시 에러 테스트"""
        data = {
            'title': 'No URL Notice',
        }
        response = self.client.post(
            '/v1/global-notices',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_get_notice_detail(self):
        """공지 상세 조회 테스트"""
        notice = GlobalNotice.objects.create(
            title='Detail Notice',
            url='https://example.com/detail',
        )

        response = self.client.get(f'/v1/global-notices/{notice.id}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Detail Notice')

    def test_update_notice(self):
        """공지 수정 테스트"""
        notice = GlobalNotice.objects.create(
            title='Original Title',
            url='https://example.com/original',
        )

        data = {
            'title': 'Updated Title',
            'url': 'https://example.com/updated',
        }
        response = self.client.put(
            f'/v1/global-notices/{notice.id}',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Updated Title')

        notice.refresh_from_db()
        self.assertEqual(notice.title, 'Updated Title')

    def test_toggle_is_active(self):
        """공지 활성/비활성 토글 테스트"""
        notice = GlobalNotice.objects.create(
            title='Toggle Notice',
            url='https://example.com/toggle',
            is_active=True,
        )

        data = {'is_active': False}
        response = self.client.put(
            f'/v1/global-notices/{notice.id}',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertFalse(content['body']['isActive'])

        notice.refresh_from_db()
        self.assertFalse(notice.is_active)

    def test_delete_notice(self):
        """공지 삭제 테스트"""
        notice = GlobalNotice.objects.create(
            title='Delete Notice',
            url='https://example.com/delete',
        )

        response = self.client.delete(f'/v1/global-notices/{notice.id}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        self.assertFalse(GlobalNotice.objects.filter(id=notice.id).exists())

    def test_get_notices_with_multiple(self):
        """여러 공지 목록 조회 테스트"""
        GlobalNotice.objects.create(
            title='Notice 1',
            url='https://example.com/1',
        )
        GlobalNotice.objects.create(
            title='Notice 2',
            url='https://example.com/2',
        )

        response = self.client.get('/v1/global-notices')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(len(content['body']['notices']), 2)

    def test_normal_user_cannot_create(self):
        """일반 유저가 공지 생성 불가 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')

        data = {
            'title': 'Unauthorized Notice',
            'url': 'https://example.com',
        }
        response = client.post(
            '/v1/global-notices',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_normal_user_cannot_delete(self):
        """일반 유저가 공지 삭제 불가 테스트"""
        notice = GlobalNotice.objects.create(
            title='Protected Notice',
            url='https://example.com/protected',
        )

        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')

        response = client.delete(f'/v1/global-notices/{notice.id}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

        self.assertTrue(GlobalNotice.objects.filter(id=notice.id).exists())
