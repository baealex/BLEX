import json

from django.test import TestCase
from django.test.client import Client

from board.models import User, Profile, SiteNotice, SiteContentScope


class NoticeAPITestCase(TestCase):
    """User Notice API endpoint tests"""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='test',
            password='test',
            email='test@test.com',
        )
        profile = Profile.objects.create(user=cls.user)
        profile.role = Profile.Role.EDITOR
        profile.save()

        cls.normal_user = User.objects.create_user(
            username='normaluser',
            password='test',
            email='normal@test.com',
        )
        Profile.objects.create(user=cls.normal_user)

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        self.client.login(username='test', password='test')

    def _create_user_notice(self, **kwargs):
        defaults = dict(
            scope=SiteContentScope.USER,
            user=self.user,
            title='Test Notice',
            url='https://example.com',
        )
        defaults.update(kwargs)
        return SiteNotice.objects.create(**defaults)

    def test_get_notices_not_login(self):
        """비로그인 상태에서 공지 목록 조회 시 에러 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        response = client.get('/v1/notices')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_notices_normal_user(self):
        """일반 유저(비에디터)가 공지 조회 시 권한 거부 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')
        response = client.get('/v1/notices')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_get_notices_empty(self):
        """공지 목록 조회 - 빈 목록 테스트"""
        response = self.client.get('/v1/notices')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(len(content['body']['notices']), 0)

    def test_create_notice(self):
        """공지 생성 테스트"""
        data = {
            'title': 'My Notice',
            'url': 'https://example.com/notice',
        }
        response = self.client.post(
            '/v1/notices',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'My Notice')
        self.assertTrue(content['body']['isActive'])

        notice = SiteNotice.objects.get(title='My Notice')
        self.assertEqual(notice.user, self.user)
        self.assertEqual(notice.scope, SiteContentScope.USER)

    def test_create_notice_without_title(self):
        """제목 없이 공지 생성 시 에러 테스트"""
        data = {'url': 'https://example.com'}
        response = self.client.post(
            '/v1/notices',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_create_notice_without_url(self):
        """URL 없이 공지 생성 시 에러 테스트"""
        data = {'title': 'No URL Notice'}
        response = self.client.post(
            '/v1/notices',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_get_notice_detail(self):
        """공지 상세 조회 테스트"""
        notice = self._create_user_notice(title='Detail Notice', url='https://example.com/detail')

        response = self.client.get(f'/v1/notices/{notice.id}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Detail Notice')

    def test_update_notice(self):
        """공지 수정 테스트"""
        notice = self._create_user_notice(title='Original Title', url='https://example.com/original')

        data = {
            'title': 'Updated Title',
            'url': 'https://example.com/updated',
        }
        response = self.client.put(
            f'/v1/notices/{notice.id}',
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
        notice = self._create_user_notice(is_active=True)

        data = {'is_active': False}
        response = self.client.put(
            f'/v1/notices/{notice.id}',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertFalse(content['body']['isActive'])

        notice.refresh_from_db()
        self.assertFalse(notice.is_active)

    def test_delete_notice(self):
        """공지 삭제 테스트"""
        notice = self._create_user_notice()

        response = self.client.delete(f'/v1/notices/{notice.id}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        self.assertFalse(SiteNotice.objects.filter(id=notice.id).exists())

    def test_user_cannot_access_other_user_notice(self):
        """다른 사용자의 공지 접근 불가 테스트"""
        other_user = User.objects.create_user(
            username='other',
            password='other',
            email='other@test.com',
        )
        other_profile = Profile.objects.create(user=other_user)
        other_profile.role = Profile.Role.EDITOR
        other_profile.save()

        other_notice = SiteNotice.objects.create(
            scope=SiteContentScope.USER,
            user=other_user,
            title='Other Notice',
            url='https://example.com/other',
        )

        response = self.client.get(f'/v1/notices/{other_notice.id}')
        self.assertEqual(response.status_code, 404)

        self.assertTrue(SiteNotice.objects.filter(id=other_notice.id).exists())

    def test_get_notices_with_multiple(self):
        """여러 공지 목록 조회 테스트"""
        self._create_user_notice(title='Notice 1', url='https://example.com/1')
        self._create_user_notice(title='Notice 2', url='https://example.com/2')

        response = self.client.get('/v1/notices')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(len(content['body']['notices']), 2)
