import json
from unittest.mock import patch

from django.test import TestCase

from board.models import User, Config, Profile, UsernameChangeLog


class UserAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Create test users
        cls.user = User.objects.create_user(
            username='testuser',
            password='testpass',
            email='test@test.com',
        )
        cls.profile = Profile.objects.create(user=cls.user, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.user)

        cls.other_user = User.objects.create_user(
            username='otheruser',
            password='testpass',
            email='other@test.com',
        )
        Profile.objects.create(user=cls.other_user, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.other_user)

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'

    # PUT /v1/users/@<username> - Update user about
    @patch('board.services.user_service.parse_to_html', return_value='<p>Updated About</p>')
    def test_update_user_about(self, mock_service):
        """사용자 소개 업데이트 테스트"""
        self.client.login(username='testuser', password='testpass')

        data = 'about=true&about_md=Updated About Content'
        response = self.client.put(
            '/v1/users/@testuser',
            data=data,
            content_type='application/x-www-form-urlencoded'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

    @patch('board.services.user_service.parse_to_html', return_value='<p>Updated</p>')
    def test_update_own_about_only(self, mock_service):
        """본인의 소개만 업데이트 가능"""
        self.client.login(username='testuser', password='testpass')

        data = 'about=true&about_md=Trying to update someone else'
        response = self.client.put(
            '/v1/users/@otheruser',
            data=data,
            content_type='application/x-www-form-urlencoded'
        )

        content = json.loads(response.content)
        self.assertNotEqual(content['status'], 'DONE')

    def test_update_about_requires_login(self):
        """소개 업데이트는 로그인 필요"""
        data = 'about=true&about_md=Test'
        response = self.client.put(
            '/v1/users/@testuser',
            data=data,
            content_type='application/x-www-form-urlencoded'
        )

        # Should fail without login
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_update_about_with_empty_content(self):
        """빈 내용으로 소개 업데이트"""
        self.client.login(username='testuser', password='testpass')

        with patch('board.services.user_service.parse_to_html', return_value=''):
            data = 'about=true&about_md='
            response = self.client.put(
                '/v1/users/@testuser',
                data=data,
                content_type='application/x-www-form-urlencoded'
            )

            self.assertEqual(response.status_code, 200)

    def test_update_about_nonexistent_user(self):
        """존재하지 않는 사용자 업데이트 시도 시 404"""
        self.client.login(username='testuser', password='testpass')

        data = 'about=true&about_md=Test'
        response = self.client.put(
            '/v1/users/@nonexistent',
            data=data,
            content_type='application/x-www-form-urlencoded'
        )

        self.assertEqual(response.status_code, 404)

    # GET /v1/users/@<username>/check-redirect - Check username redirect
    def test_check_redirect_with_redirect(self):
        """사용자명 변경 시 리다이렉트 정보 확인"""
        # Create a username change history
        UsernameChangeLog.objects.create(
            user=self.user,
            username='oldusername'
        )

        response = self.client.get('/v1/users/@oldusername/check-redirect')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)

        self.assertIn('oldUsername', content['body'])
        self.assertIn('newUsername', content['body'])
        self.assertEqual(content['body']['oldUsername'], 'oldusername')
        self.assertEqual(content['body']['newUsername'], 'testuser')

    def test_check_redirect_without_redirect(self):
        """리다이렉트 정보가 없는 경우"""
        response = self.client.get('/v1/users/@testuser/check-redirect')
        # Should return 404 when no redirect exists
        self.assertEqual(response.status_code, 404)

    def test_check_redirect_empty_username(self):
        """빈 사용자명으로 리다이렉트 확인"""
        response = self.client.get('/v1/users/@/check-redirect')
        # Should handle empty username gracefully
        self.assertIn(response.status_code, [404, 400])

    def test_check_redirect_with_special_characters(self):
        """특수 문자가 포함된 사용자명"""
        response = self.client.get('/v1/users/@user@name/check-redirect')
        # Should handle special characters
        self.assertIn(response.status_code, [404, 400])

    def test_check_redirect_multiple_redirects(self):
        """여러 번 변경된 사용자명"""
        # Create multiple username changes
        UsernameChangeLog.objects.create(
            user=self.user,
            username='firstusername'
        )
        UsernameChangeLog.objects.create(
            user=self.user,
            username='secondusername'
        )

        # Check redirect from first username
        response = self.client.get('/v1/users/@firstusername/check-redirect')
        content = json.loads(response.content)

        # Should redirect to the most recent username
        self.assertIn('newUsername', content['body'])

    def test_check_redirect_response_structure(self):
        """리다이렉트 응답 구조 확인"""
        UsernameChangeLog.objects.create(
            user=self.user,
            username='oldname'
        )

        response = self.client.get('/v1/users/@oldname/check-redirect')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)

        self.assertIn('body', content)
        self.assertIn('oldUsername', content['body'])
        self.assertIn('newUsername', content['body'])
        self.assertIn('createdDate', content['body'])

    def test_invalid_methods_for_user_endpoint(self):
        """사용자 엔드포인트에서 허용되지 않는 메서드"""
        self.client.login(username='testuser', password='testpass')

        # GET should return 404
        response = self.client.get('/v1/users/@testuser')
        self.assertEqual(response.status_code, 404)

        # POST should return 404
        response = self.client.post('/v1/users/@testuser', {})
        self.assertEqual(response.status_code, 404)

        # DELETE should return 404
        response = self.client.delete('/v1/users/@testuser')
        self.assertEqual(response.status_code, 404)

    def test_invalid_methods_for_redirect_endpoint(self):
        """리다이렉트 엔드포인트에서 허용되지 않는 메서드"""
        # POST should return 404
        response = self.client.post('/v1/users/@testuser/check-redirect', {})
        self.assertEqual(response.status_code, 404)

        # PUT should return 404
        response = self.client.put('/v1/users/@testuser/check-redirect', {})
        self.assertEqual(response.status_code, 404)

        # DELETE should return 404
        response = self.client.delete('/v1/users/@testuser/check-redirect')
        self.assertEqual(response.status_code, 404)

    @patch('board.services.user_service.parse_to_html', return_value='<p>Markdown content</p>')
    def test_update_about_with_markdown(self, mock_service):
        """마크다운 형식의 소개 업데이트"""
        self.client.login(username='testuser', password='testpass')

        markdown_content = '# Hello\n\nThis is **bold** text.'
        data = f'about=true&about_md={markdown_content}'

        response = self.client.put(
            '/v1/users/@testuser',
            data=data,
            content_type='application/x-www-form-urlencoded'
        )

        self.assertEqual(response.status_code, 200)
        # Verify markdown parser was called
        mock_service.assert_called()

    def test_update_about_without_about_parameter(self):
        """about 파라미터 없이 업데이트 시도"""
        self.client.login(username='testuser', password='testpass')

        data = 'about_md=Test content'
        response = self.client.put(
            '/v1/users/@testuser',
            data=data,
            content_type='application/x-www-form-urlencoded'
        )

        # Should return 404 when about parameter is missing
        self.assertEqual(response.status_code, 404)

    def test_concurrent_about_updates(self):
        """동시 업데이트 처리"""
        self.client.login(username='testuser', password='testpass')

        with patch('board.services.user_service.parse_to_html', return_value='<p>First</p>'):
            data1 = 'about=true&about_md=First update'
            response1 = self.client.put(
                '/v1/users/@testuser',
                data=data1,
                content_type='application/x-www-form-urlencoded'
            )

        with patch('board.services.user_service.parse_to_html', return_value='<p>Second</p>'):
            data2 = 'about=true&about_md=Second update'
            response2 = self.client.put(
                '/v1/users/@testuser',
                data=data2,
                content_type='application/x-www-form-urlencoded'
            )

        # Both updates should succeed
        self.assertEqual(response1.status_code, 200)
        self.assertEqual(response2.status_code, 200)
