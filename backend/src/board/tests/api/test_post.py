import json
import datetime

from unittest.mock import patch

from django.test import TestCase

from board.models import (
    User, Config, Post, PostContent, PostConfig, Profile
)


class PostTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        author = User.objects.create_user(
            username='author',
            password='author',
            email='author@author.com',
            first_name='Author User',
        )
        Profile.objects.create(user=author, role=Profile.Role.EDITOR)
        Config.objects.create(user=author)

        viewer = User.objects.create_user(
            username='viewer',
            password='viewer',
            email='viewer@author.com',
            first_name='Viewer User',
        )
        Profile.objects.create(user=viewer, role=Profile.Role.READER)
        Config.objects.create(user=viewer)

        number_of_posts = 100

        for post_num in range(number_of_posts):
            post = Post.objects.create(
                url=f'test-post-{post_num}',
                title=f'Test Post {post_num}',
                author=author,
            )
            PostContent.objects.create(
                post=post,
                text_md=f'# Test Post {post_num}',
                text_html=f'<h1>Test Post {post_num}</h1>'
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
                advertise=False,
            )
    
    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'

    def test_get_trending_posts_list(self):
        """인기 게시글 목록 조회 테스트"""
        response = self.client.get('/v1/posts/trending')
        self.assertEqual(response.status_code, 200)

    def test_get_newest_posts_list(self):
        """최신 게시글 목록 조회 테스트"""
        response = self.client.get('/v1/posts/newest')
        self.assertEqual(response.status_code, 200)

    def test_get_newest_posts_list_pagination(self):
        """최신 게시글 목록 페이지네이션 테스트"""
        response = self.client.get('/v1/posts/newest')
        self.assertEqual(
            len(json.loads(response.content)['body']['posts']), 24)

    def test_raise_not_found_when_over_last_page(self):
        """마지막 페이지 초과 시 404 에러 테스트"""
        response = self.client.get('/v1/posts/newest?page=9999')
        self.assertEqual(response.status_code, 404)

    def test_no_access_liked_posts_to_not_logged_in_user(self):
        """비로그인 사용자의 좋아요 게시글 목록 접근 차단 테스트"""
        response = self.client.get('/v1/posts/liked')
        self.assertEqual(response.status_code, 404)

    def test_get_liked_posts_list(self):
        """좋아요한 게시글 목록 조회 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.get('/v1/posts/liked')
        self.assertEqual(response.status_code, 200)

    def test_get_feature_posts_list(self):
        """특정 사용자의 추천 게시글 목록 조회 테스트"""
        params = {'username': '@author'}
        response = self.client.get('/v1/posts/feature', params)
        self.assertEqual(response.status_code, 200)

    def test_get_user_post_list(self):
        """사용자 게시글 목록 조회 테스트"""
        response = self.client.get('/v1/users/@author/posts')
        self.assertEqual(response.status_code, 200)

    def test_get_user_post_list_pagination(self):
        """사용자 게시글 목록 페이지네이션 테스트"""
        response = self.client.get('/v1/users/@author/posts')
        content = json.loads(response.content)
        self.assertEqual(len(content['body']['posts']), 10)

    def test_get_user_post_detail(self):
        """게시글 상세 조회 테스트"""
        params = {'mode': 'view'}
        response = self.client.get('/v1/users/@author/posts/test-post-1', params)
        self.assertEqual(response.status_code, 200)

    def test_no_access_other_user_post_edit_mode(self):
        """다른 사용자의 게시글 편집 모드 접근 차단 테스트"""
        params = {'mode': 'edit'}
        response = self.client.get('/v1/users/@author/posts/test-post-1', params)
        self.assertEqual(response.status_code, 404)

    def test_get_user_post_detail_edit_mode(self):
        """게시글 편집 모드 조회 테스트"""
        self.client.login(username='author', password='author')

        params = {'mode': 'edit'}
        response = self.client.get('/v1/users/@author/posts/test-post-1', params)
        self.assertEqual(response.status_code, 200)

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_update_user_post(self, mock_service):
        """게시글 수정 테스트"""
        self.client.login(username='author', password='author')

        post = Post.objects.get(url='test-post-1')
        response = self.client.post('/v1/users/@author/posts/test-post-1', {
            'title': f'{post.title} Updated',
            'text_html': post.content.text_html,
            'is_hide': post.config.hide,
            'is_advertise': post.config.advertise,
        })

        post.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(post.title, 'Test Post 1 Updated')

    def test_get_user_post_detail_edit_mode_with_not_exist_post(self):
        """존재하지 않는 게시글 편집 모드 접근 시 404 에러 테스트"""
        self.client.login(username='author', password='author')

        params = {'mode': 'edit'}
        response = self.client.get(
            '/v1/users/@author/posts/not-exist-post', params)
        self.assertEqual(response.status_code, 404)

    def test_get_user_post_detail_edit_mode_with_not_exist_user(self):
        """존재하지 않는 사용자의 게시글 편집 모드 접근 시 404 에러 테스트"""
        self.client.login(username='author', password='author')

        params = {'mode': 'edit'}
        response = self.client.get(
            '/v1/users/@not-exist-user/posts/test-post-1', params)
        self.assertEqual(response.status_code, 404)

    def test_get_user_post_detail_edit_mode_with_not_match_user(self):
        """작성자가 일치하지 않는 게시글 편집 모드 접근 시 404 에러 테스트"""
        self.client.login(username='author', password='author')

        params = {'mode': 'edit'}
        response = self.client.get(
            '/v1/users/@not-test-user/posts/test-post-1', params)
        self.assertEqual(response.status_code, 404)

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_post_duplicate_url(self, mock_service):
        """중복된 URL로 게시글 생성 시 자동 URL 생성 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post 1',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(len(content['body']['url']),
                         len('test-post-1-00000000'))

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_post_custom_url(self, mock_service):
        """커스텀 URL로 게시글 생성 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post 1',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
            'url': 'custom-url'
        })
        content = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['body']['url'], 'custom-url')

    def test_create_post(self):
        """게시글 생성 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post 1000',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })
        content = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['body']['url'], 'test-post-1000')

    def test_create_post_with_not_logged_in_user(self):
        """비로그인 사용자의 게시글 생성 차단 테스트"""
        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })

        self.assertEqual(response.status_code, 404)

    def test_create_post_empty_title(self):
        """빈 제목으로 게시글 생성 시 에러 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': '',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })
        self.assertEqual(response.json()['status'], 'ERROR')

    def test_create_post_empty_text(self):
        """빈 내용으로 게시글 생성 시 에러 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_html': '',
            'is_hide': False,
            'is_advertise': False,
        })
        self.assertEqual(response.json()['status'], 'ERROR')

    def test_create_post_reserved(self):
        """예약 게시글 생성 및 공개 제한 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Reserved Post',
            'text_html': '# Test Reserved Post',
            'is_hide': False,
            'is_advertise': False,
            'reserved_date': f"{(datetime.date.today() + datetime.timedelta(days=1)).strftime('%Y-%m-%d')}T12:00:00.000Z"
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['url'], 'test-reserved-post')

        params = {'mode': 'view'}
        response = self.client.get(
            '/v1/users/@author/posts/test-reserved-post', params)
        self.assertEqual(response.status_code, 200)

        response = self.client.get('/v1/posts/newest')
        content = json.loads(response.content)
        self.assertNotEqual(
            content['body']['posts'][0]['url'], 'test-reserved-post')

        self.client.logout()
        response = self.client.get(
            '/v1/users/@author/posts/test-reserved-post', params)
        self.assertEqual(response.status_code, 404)
    
    def test_create_post_reserved_before(self):
        """과거 날짜로 예약 게시글 생성 시 에러 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Reserved Post',
            'text_html': '# Test Reserved Post',
            'is_hide': False,
            'is_advertise': False,
            'reserved_date': f"{(datetime.date.today() - datetime.timedelta(days=1)).strftime('%Y-%m-%d')}T12:00:00.000Z"
        })
        self.assertEqual(response.json()['status'], 'ERROR')

    def test_create_post_custom_description(self):
        """커스텀 설명을 포함한 게시글 생성 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
            'description': 'Custom Description'
        })
        content = json.loads(response.content)
        post = Post.objects.get(url=content['body']['url'])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(post.meta_description, 'Custom Description')
    
    def test_create_post_without_invitation(self):
        """초대받지 않은 사용자의 게시글 생성 차단 테스트"""
        self.client.login(username='viewer', password='viewer')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
            'description': 'Custom Description'
        })
        content = json.loads(response.content)
        self.assertEqual(content['errorCode'], 'error:VA')
