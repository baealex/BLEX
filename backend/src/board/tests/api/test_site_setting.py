import json

from django.test import TestCase
from django.test.client import Client

from board.models import User, Profile, SiteSetting


class SiteSettingAPITestCase(TestCase):
    """SiteSetting API endpoint tests"""

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

    def test_get_settings_not_login(self):
        """비로그인 상태에서 사이트 설정 조회 시 에러 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        response = client.get('/v1/site-settings')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_settings_normal_user(self):
        """일반 유저가 사이트 설정 조회 시 권한 거부 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')
        response = client.get('/v1/site-settings')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_get_settings(self):
        """사이트 설정 조회 테스트 - 모든 필드 반환 확인"""
        response = self.client.get('/v1/site-settings')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        body = content['body']
        self.assertIn('headerScript', body)
        self.assertIn('footerScript', body)
        self.assertIn('welcomeNotificationMessage', body)
        self.assertIn('welcomeNotificationUrl', body)
        self.assertIn('accountDeletionRedirectUrl', body)
        self.assertIn('seoEnabled', body)
        self.assertTrue(body['seoEnabled'])
        self.assertIn('robotsTxtExtraRules', body)
        self.assertEqual(body['robotsTxtExtraRules'], '')
        self.assertIn('robotsTxtDefault', body)
        self.assertIn('User-agent: *', body['robotsTxtDefault'])
        self.assertIn('Disallow: /admin-settings/', body['robotsTxtDefault'])
        self.assertNotIn('# Custom rules', body['robotsTxtDefault'])
        self.assertIn('aeoEnabled', body)
        self.assertFalse(body['aeoEnabled'])
        self.assertIn('updatedDate', body)

    def test_update_single_field(self):
        """사이트 설정 개별 필드 업데이트 테스트"""
        data = {
            'header_script': '<script>console.log("header")</script>',
        }
        response = self.client.put(
            '/v1/site-settings',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['headerScript'], '<script>console.log("header")</script>')

        # DB에서 확인
        setting = SiteSetting.get_instance()
        self.assertEqual(setting.header_script, '<script>console.log("header")</script>')

    def test_update_multiple_fields(self):
        """사이트 설정 복수 필드 업데이트 테스트"""
        data = {
            'header_script': '<script>header</script>',
            'footer_script': '<script>footer</script>',
            'welcome_notification_message': '환영합니다, {name}님!',
            'welcome_notification_url': '/welcome',
            'account_deletion_redirect_url': 'https://forms.example.com/exit',
            'seo_enabled': False,
            'robots_txt_extra_rules': 'User-agent: ExampleBot\nDisallow: /private/',
            'aeo_enabled': True,
        }
        response = self.client.put(
            '/v1/site-settings',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['headerScript'], '<script>header</script>')
        self.assertEqual(content['body']['footerScript'], '<script>footer</script>')
        self.assertEqual(content['body']['welcomeNotificationMessage'], '환영합니다, {name}님!')
        self.assertEqual(content['body']['welcomeNotificationUrl'], '/welcome')
        self.assertEqual(content['body']['accountDeletionRedirectUrl'], 'https://forms.example.com/exit')
        self.assertFalse(content['body']['seoEnabled'])
        self.assertEqual(content['body']['robotsTxtExtraRules'], 'User-agent: ExampleBot\nDisallow: /private/')
        self.assertIn('robotsTxtDefault', content['body'])
        self.assertIn('# AI agent entry point: http://testserver/llms.txt', content['body']['robotsTxtDefault'])
        self.assertIn('Search indexing is disabled at runtime.', content['body']['robotsTxtDefault'])
        self.assertNotIn('# Custom rules', content['body']['robotsTxtDefault'])
        self.assertNotIn('User-agent: ExampleBot', content['body']['robotsTxtDefault'])
        self.assertTrue(content['body']['aeoEnabled'])

        setting = SiteSetting.get_instance()
        self.assertFalse(setting.seo_enabled)
        self.assertEqual(setting.robots_txt_extra_rules, 'User-agent: ExampleBot\nDisallow: /private/')
        self.assertTrue(setting.aeo_enabled)

    def test_singleton_behavior(self):
        """싱글톤 동작 확인 - 여러 번 저장해도 하나의 인스턴스"""
        data1 = {'header_script': 'first'}
        self.client.put(
            '/v1/site-settings',
            json.dumps(data1),
            content_type='application/json'
        )

        data2 = {'footer_script': 'second'}
        self.client.put(
            '/v1/site-settings',
            json.dumps(data2),
            content_type='application/json'
        )

        # 인스턴스가 하나만 존재해야 함
        self.assertEqual(SiteSetting.objects.count(), 1)

        # 두 번째 업데이트 후 첫 번째 값이 유지되어야 함
        setting = SiteSetting.get_instance()
        self.assertEqual(setting.header_script, 'first')
        self.assertEqual(setting.footer_script, 'second')

    def test_normal_user_cannot_update(self):
        """일반 유저가 사이트 설정 수정 불가 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')

        data = {'header_script': 'unauthorized'}
        response = client.put(
            '/v1/site-settings',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
