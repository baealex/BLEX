import json
import datetime

from unittest.mock import patch

from django.test import TestCase

from board.models import User, Post, PostContent, PostConfig, Profile


class PostListTestCase(TestCase):
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
        )

        number_of_posts = 100

        for post_num in range(number_of_posts):
            Post.objects.create(
                url=f'test-post-{post_num}',
                title=f'Test Post {post_num}',
                author=User.objects.get(username='test'),
            )

            PostContent.objects.create(
                posts=Post.objects.get(url=f'test-post-{post_num}'),
                text_md=f'# Test Post {post_num}',
                text_html=f'<h1>Test Post {post_num}</h1>'
            )

            PostConfig.objects.create(
                posts=Post.objects.get(url=f'test-post-{post_num}'),
                hide=False,
                advertise=False,
            )

    def test_get_popular_posts_list(self):
        response = self.client.get('/v1/posts/popular')
        self.assertEqual(response.status_code, 200)

    def test_popular_posts_list_pagination(self):
        response = self.client.get('/v1/posts/popular')
        self.assertEqual(
            len(json.loads(response.content)['body']['posts']), 24)

    def test_raise_not_found_when_over_last_page(self):
        response = self.client.get('/v1/posts/popular?page=9999')
        self.assertEqual(response.status_code, 404)

    def test_get_newest_posts_list(self):
        response = self.client.get('/v1/posts/newest')
        self.assertEqual(response.status_code, 200)

    def test_get_newest_posts_list_pagination(self):
        response = self.client.get('/v1/posts/newest')
        self.assertEqual(
            len(json.loads(response.content)['body']['posts']), 24)

    def test_no_access_liked_posts_to_not_logged_in_user(self):
        response = self.client.get('/v1/posts/liked')
        self.assertEqual(response.status_code, 404)

    def test_get_liked_posts_list(self):
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/posts/liked')
        self.assertEqual(response.status_code, 200)

    def test_get_feature_posts_list(self):
        params = {'username': '@test'}
        response = self.client.get('/v1/posts/feature', params)
        self.assertEqual(response.status_code, 200)

    def test_get_user_post_list(self):
        response = self.client.get('/v1/users/@test/posts')
        self.assertEqual(response.status_code, 200)

    def test_get_user_post_list_pagination(self):
        response = self.client.get('/v1/users/@test/posts')
        content = json.loads(response.content)
        self.assertEqual(len(content['body']['posts']), 10)


class PostTestCase(TestCase):
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
        )

        Post.objects.create(
            url=f'test-post',
            title=f'Test Post',
            author=User.objects.get(username='test'),
        )

        PostContent.objects.create(
            posts=Post.objects.get(url=f'test-post'),
            text_md=f'# Test Post',
            text_html=f'<h1>Test Post Content</h1>'
        )

        PostConfig.objects.create(
            posts=Post.objects.get(url=f'test-post'),
            hide=False,
            advertise=False,
        )

    def test_get_user_post_detail(self):
        params = {'mode': 'view'}
        response = self.client.get('/v1/users/@test/posts/test-post', params)
        self.assertEqual(response.status_code, 200)

    def test_no_access_other_user_post_edit_mode(self):
        params = {'mode': 'edit'}
        response = self.client.get('/v1/users/@test/posts/test-post', params)
        self.assertEqual(response.status_code, 404)

    def test_get_user_post_detail_edit_mode(self):
        self.client.login(username='test', password='test')

        params = {'mode': 'edit'}
        response = self.client.get('/v1/users/@test/posts/test-post', params)
        self.assertEqual(response.status_code, 200)

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_update_user_post(self, mock_service):
        self.client.login(username='test', password='test')

        post = Post.objects.get(url='test-post')
        response = self.client.post('/v1/users/@test/posts/test-post', {
            'title': f'{post.title} Updated',
            'text_md': post.content.text_md,
            'hide': post.config.hide,
            'advertise': post.config.advertise,
        })

        post.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(post.title, 'Test Post Updated')

    def test_get_user_post_detail_edit_mode_with_not_exist_post(self):
        self.client.login(username='test', password='test')

        params = {'mode': 'edit'}
        response = self.client.get(
            '/v1/users/@test/posts/not-exist-post', params)
        self.assertEqual(response.status_code, 404)

    def test_get_user_post_detail_edit_mode_with_not_exist_user(self):
        self.client.login(username='test', password='test')

        params = {'mode': 'edit'}
        response = self.client.get(
            '/v1/users/@not-exist-user/posts/test-post', params)
        self.assertEqual(response.status_code, 404)

    def test_get_user_post_detail_edit_mode_with_not_match_user(self):
        self.client.login(username='test', password='test')

        params = {'mode': 'edit'}
        response = self.client.get(
            '/v1/users/@not-test-user/posts/test-post', params)
        self.assertEqual(response.status_code, 404)

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_post_duplicate_url(self, mock_servic4e):
        self.client.login(username='test', password='test')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_md': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(len(content['body']['url']),
                         len('test-post-00000000'))

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_post_custom_url(self, mock_service):
        self.client.login(username='test', password='test')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_md': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
            'url': 'custom-url'
        })
        content = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['body']['url'], 'custom-url')

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_post(self, mock_service):
        self.client.login(username='test', password='test')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post 1',
            'text_md': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })
        content = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['body']['url'], 'test-post-1')

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_post_with_not_logged_in_user(self, return_value):
        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_md': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })

        self.assertEqual(response.status_code, 404)

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_post_empty_title(self, mock_service):
        self.client.login(username='test', password='test')

        response = self.client.post('/v1/posts', {
            'title': '',
            'text_md': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })
        self.assertEqual(response.json()['status'], 'ERROR')

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_post_empty_text(self, mock_service):
        self.client.login(username='test', password='test')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_md': '',
            'is_hide': False,
            'is_advertise': False,
        })
        self.assertEqual(response.json()['status'], 'ERROR')

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_post_reserved(self, mock_service):
        self.client.login(username='test', password='test')

        response = self.client.post('/v1/posts', {
            'title': 'Test Reserved Post',
            'text_md': '# Test Reserved Post',
            'is_hide': False,
            'is_advertise': False,
            'reserved_date': f"{(datetime.date.today() + datetime.timedelta(days=1)).strftime('%Y-%m-%d')}T12:00:00.000Z"
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['url'], 'test-reserved-post')

        params = {'mode': 'view'}
        response = self.client.get(
            '/v1/users/@test/posts/test-reserved-post', params)
        self.assertEqual(response.status_code, 200)

        response = self.client.get('/v1/posts/newest')
        content = json.loads(response.content)
        self.assertNotEqual(
            content['body']['posts'][0]['url'], 'test-reserved-post')

        self.client.logout()
        response = self.client.get(
            '/v1/users/@test/posts/test-reserved-post', params)
        self.assertEqual(response.status_code, 404)
    
    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_post_reserved_before(self, mock_service):
        self.client.login(username='test', password='test')

        response = self.client.post('/v1/posts', {
            'title': 'Test Reserved Post',
            'text_md': '# Test Reserved Post',
            'is_hide': False,
            'is_advertise': False,
            'reserved_date': f"{(datetime.date.today() - datetime.timedelta(days=1)).strftime('%Y-%m-%d')}T12:00:00.000Z"
        })
        self.assertEqual(response.json()['status'], 'ERROR')

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_post_auto_generate_description(self, mock_service):
        self.client.login(username='test', password='test')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_md': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })
        content = json.loads(response.content)
        post = Post.objects.get(url=content['body']['url'])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(post.meta_description, 'Mocked Text')

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_post_custom_description(self, mock_service):
        self.client.login(username='test', password='test')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_md': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
            'description': 'Custom Description'
        })
        content = json.loads(response.content)
        post = Post.objects.get(url=content['body']['url'])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(post.meta_description, 'Custom Description')
