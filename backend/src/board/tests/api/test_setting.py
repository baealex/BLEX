import json

from django.test import TestCase
from django.test.client import Client
from django.utils import timezone

from board.constants.config_meta import CONFIG_TYPE
from board.models import (
    User, Config, Profile, Notify, Post, PostContent, PostConfig
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
        self.assertEqual(len(content['body']['config']), 4)
        self.assertEqual(
            {item['name'] for item in content['body']['config']},
            {
                CONFIG_TYPE.NOTIFY_POSTS_LIKE.value,
                CONFIG_TYPE.NOTIFY_POSTS_COMMENT.value,
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value,
                CONFIG_TYPE.NOTIFY_MENTION.value,
            }
        )

    def test_get_setting_notify_config_reader(self):
        """독자(READER)는 기본 알림 설정 2개만 조회 테스트"""
        reader = User.objects.create_user(
            username='reader',
            password='test',
            email='reader@test.com',
            first_name='Reader User',
        )
        Config.objects.create(user=reader)
        Profile.objects.create(user=reader, role=Profile.Role.READER)

        self.client.login(username='reader', password='test')

        response = self.client.get('/v1/setting/notify-config')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)

        self.assertEqual(len(content['body']['config']), 2)
        self.assertEqual(
            {item['name'] for item in content['body']['config']},
            {
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value,
                CONFIG_TYPE.NOTIFY_MENTION.value,
            }
        )

    def test_update_notify_config_without_posts(self):
        """포스트가 없는 사용자의 알림 설정 업데이트 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/notify-config',
            json.dumps({
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value: 'true',
                CONFIG_TYPE.NOTIFY_MENTION.value: 'false',
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        user = User.objects.get(username='test')
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE), True)
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_MENTION), False)

    def test_update_notify_config_with_posts(self):
        """포스트가 있는 사용자의 알림 설정 업데이트 테스트"""
        user = User.objects.get(username='test')
        
        post = Post.objects.create(
            url='test-post',
            title='Test Post',
            author=user,
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=post,
            text_md='# Test',
            text_html='<h1>Test</h1>'
        )
        PostConfig.objects.create(
            post=post,
            hide=False,
        )

        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/notify-config',
            json.dumps({
                CONFIG_TYPE.NOTIFY_POSTS_LIKE.value: 'true',
                CONFIG_TYPE.NOTIFY_POSTS_COMMENT.value: 'true',
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value: 'false',
                CONFIG_TYPE.NOTIFY_MENTION.value: 'true',
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        user.refresh_from_db()
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_LIKE), True)
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_COMMENT), True)
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE), False)
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_MENTION), True)
    
    def test_get_setting_account(self):
        """계정 설정 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/account')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['username'], 'test')
        self.assertEqual(content['body']['name'], 'Test User')

    def test_update_username(self):
        """사용자 필명 변경 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/account',
            'username=newtest',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        user = User.objects.get(id=User.objects.get(username='newtest').id)
        self.assertEqual(user.username, 'newtest')

    def test_update_username_duplicate(self):
        """중복된 사용자 필명 변경 테스트"""
        User.objects.create_user(
            username='duplicate',
            password='test',
            email='duplicate@test.com',
            first_name='Duplicate User',
        )

        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/account',
            'username=duplicate',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorMessage'], '이미 사용중인 아이디입니다.')

    def test_upload_avatar(self):
        """프로필 이미지 업로드 테스트"""
        from io import BytesIO
        from PIL import Image

        self.client.login(username='test', password='test')

        image = Image.new('RGB', (100, 100), color='red')
        image_file = BytesIO()
        image.save(image_file, 'PNG')
        image_file.name = 'test.png'
        image_file.seek(0)

        response = self.client.post(
            '/v1/setting/avatar',
            {'avatar': image_file},
            format='multipart'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIn('url', content['body'])

    def test_upload_cover(self):
        """커버 이미지 업로드 테스트"""
        from io import BytesIO
        from PIL import Image

        self.client.login(username='test', password='test')

        image = Image.new('RGB', (1200, 514), color='blue')
        image_file = BytesIO()
        image.save(image_file, 'PNG')
        image_file.name = 'cover.png'
        image_file.seek(0)

        response = self.client.post(
            '/v1/setting/cover',
            {'cover': image_file},
            format='multipart'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIn('url', content['body'])

    def test_get_setting_profile(self):
        """프로필 설정 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/profile')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIn('avatar', content['body'])
        self.assertIn('cover', content['body'])
        self.assertIn('bio', content['body'])
        self.assertIn('homepage', content['body'])

    def test_update_profile(self):
        """프로필 설정 업데이트 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/profile',
            'bio=Test bio&homepage=https://example.com',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        profile = Profile.objects.get(user=User.objects.get(username='test'))
        self.assertEqual(profile.bio, 'Test bio')
        self.assertEqual(profile.homepage, 'https://example.com')

    def test_update_account_not_logged_in(self):
        """비로그인 상태에서 계정 수정 시도"""
        response = self.client.put(
            '/v1/setting/account',
            'username=hacked',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')
