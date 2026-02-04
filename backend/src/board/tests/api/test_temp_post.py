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
        """임시 포스트 목록 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/temp-posts')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(len(content['body']['temps']), 10)

    def test_no_access_temp_post_list_to_not_logged_in_user(self):
        """비로그인 사용자의 임시 포스트 목록 접근 차단 테스트"""
        response = self.client.get('/v1/temp-posts')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_temp_post_detail(self):
        """임시 포스트 상세 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/temp-posts/test-token-0')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['title'], 'Test Post 0')

    def test_no_access_temp_post_detail_to_not_logged_in_user(self):
        """비로그인 사용자의 임시 포스트 상세 접근 차단 테스트"""
        response = self.client.get('/v1/temp-posts/test-token-0')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_create_temp_post(self):
        """임시 포스트 생성 테스트"""
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

    def test_create_temp_post_updates_existing(self):
        """동일 내용 임시 포스트 생성 시 기존 포스트 업데이트"""
        self.client.login(username='test', password='test')

        # Create with specific content
        response = self.client.post('/v1/temp-posts', {
            'title': 'Original Title',
            'text_md': 'unique_content_for_test',
            'tag': 'test',
        })
        content = json.loads(response.content)
        first_token = content['body']['token']

        # Create again with same content but different title
        response = self.client.post('/v1/temp-posts', {
            'title': 'Updated Title',
            'text_md': 'unique_content_for_test',
            'tag': 'test',
        })
        content = json.loads(response.content)
        second_token = content['body']['token']

        # Should return same token (updated existing)
        self.assertEqual(first_token, second_token)

        # Verify title was updated
        temp = TempPosts.objects.get(token=first_token)
        self.assertEqual(temp.title, 'Updated Title')

    def test_create_temp_post_empty_title(self):
        """빈 제목으로 임시 포스트 생성 시 기본 제목 설정"""
        self.client.login(username='test', password='test')

        response = self.client.post('/v1/temp-posts', {
            'title': '',
            'text_md': 'content without title',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)

        temp = TempPosts.objects.get(token=content['body']['token'])
        self.assertEqual(temp.title, '제목 없음')

    def test_delete_temp_post(self):
        """임시 포스트 삭제 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.delete('/v1/temp-posts/test-token-0')
        self.assertEqual(response.status_code, 200)

        self.assertFalse(TempPosts.objects.filter(token='test-token-0').exists())

    def test_delete_temp_post_not_logged_in(self):
        """비로그인 상태에서 임시 포스트 삭제 시도"""
        response = self.client.delete('/v1/temp-posts/test-token-0')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

        # Should still exist
        self.assertTrue(TempPosts.objects.filter(token='test-token-0').exists())

    def test_delete_temp_post_other_user(self):
        """다른 사용자의 임시 포스트 삭제 시도"""
        # Create another user
        User.objects.create_user(
            username='other',
            password='other',
            email='other@test.com',
        )
        Profile.objects.create(
            user=User.objects.get(username='other'),
            role=Profile.Role.EDITOR
        )

        self.client.login(username='other', password='other')
        response = self.client.delete('/v1/temp-posts/test-token-0')
        # 다른 사용자의 임시 포스트는 get_object_or_404에서 author 필터로 인해 404 반환
        self.assertEqual(response.status_code, 404)

        # Should still exist
        self.assertTrue(TempPosts.objects.filter(token='test-token-0').exists())
