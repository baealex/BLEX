import json

from django.test import TestCase
from django.test.client import Client

from board.models import (
    User, Config, Profile, Notify
)


class SettingTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        User.objects.create_user(
            username='test',
            password='test',
            email='test@test.com',
            first_name='Test User',
        )

        Config.objects.create(
            user=User.objects.get(username='test'),
        )

        Profile.objects.create(
            user=User.objects.get(username='test'),
            role=Profile.Role.EDITOR
        )

        for i in range(2):
            Notify.objects.create(
                user=User.objects.get(username='test'),
                content=f'test notify {i}',
                url=f'/test-url-{i}',
                key=f'test-key-{i}',
            )

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')

    def test_get_setting_notify_not_login(self):
        """비로그인 상태에서 알림 설정 조회 시 에러 테스트"""
        response = self.client.get('/v1/setting/notify')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_setting_notify(self):
        """알림 설정 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/notify')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(len(content['body']['notify']), 2)
        self.assertEqual(content['body']['isTelegramSync'], False)
    
    def test_get_setting_notify_config(self):
        """알림 설정 구성 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/notify-config')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(type(content['body']['config']), list)
    
    def test_get_setting_account(self):
        """계정 설정 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/account')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['username'], 'test')
        self.assertEqual(content['body']['name'], 'Test User')
