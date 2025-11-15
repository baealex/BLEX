import json

from django.test import TestCase

from board.models import User, Profile, TempPosts


class TempPostTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        User.objects.create_user(
            username='test',
            password='test',
            email='test@test.com',
            first_name='Test User',
        )

        Profile.objects.create(
            user=User.objects.get(username='test'),
            role=Profile.Role.EDITOR
        )

        number_of_temp_posts = 10

        for post_num in range(number_of_temp_posts):
            TempPosts.objects.create(
                author=User.objects.get(username='test'),
                token=f'test-token-{post_num}',
                title=f'Test Post {post_num}',
                text_md=f'# Test Post {post_num}',
                tag='test',
            )

    def test_get_temp_post_list(self):
        """임시 게시글 목록 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/temp-posts')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(len(content['body']['temps']), 10)

    def test_no_access_temp_post_list_to_not_logged_in_user(self):
        """비로그인 사용자의 임시 게시글 목록 접근 차단 테스트"""
        response = self.client.get('/v1/temp-posts')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_temp_post_detail(self):
        """임시 게시글 상세 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/temp-posts/test-token-0')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['title'], 'Test Post 0')

    def test_no_access_temp_post_detail_to_not_logged_in_user(self):
        """비로그인 사용자의 임시 게시글 상세 접근 차단 테스트"""
        response = self.client.get('/v1/temp-posts/test-token-0')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_create_temp_post(self):
        """임시 게시글 생성 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.post('/v1/temp-posts', {
            'title': 'Test Post',
            'text_md': '# Test Post',
            'tag': 'test',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(len(content['body']['token']), 25)
