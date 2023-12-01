import json

from django.test import TestCase
from django.test.client import Client

from board.models import (
    User, Post, PostContent, PostConfig, Profile,
    SearchValue, Search
)


class SearchTestCase(TestCase):
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
                title=f'test post {post_num}' if post_num % 2 else f'no search post {post_num}',
                author=User.objects.get(username='test'),
            )

            PostContent.objects.create(
                post=Post.objects.get(url=f'test-post-{post_num}'),
                text_md='description',
                text_html='description'
            )

            PostConfig.objects.create(
                post=Post.objects.get(url=f'test-post-{post_num}'),
                hide=False,
                advertise=False,
            )

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')

    def test_get_search(self):
        response = self.client.get('/v1/search', {
            'q': 'test',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['totalSize'], 50)
        self.assertEqual(len(content['body']['results']), 30)

    def test_get_search_pagination(self):
        response = self.client.get('/v1/search', {
            'q': 'test',
            'page': 2,
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['totalSize'], 50)
        self.assertEqual(len(content['body']['results']), 20)

    def test_get_search_with_description(self):
        response = self.client.get('/v1/search', {
            'q': 'description',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['totalSize'], 100)
        self.assertEqual(len(content['body']['results']), 30)

    def test_create_search_value(self):
        response = self.client.get('/v1/search', {
            'q': 'test',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(SearchValue.objects.first().value, 'test')

    def test_create_search_history_from_not_logged_in_user(self):
        response = self.client.get('/v1/search', {
            'q': 'test',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(str(Search.objects.first().search_value), 'test')
        self.assertEqual(Search.objects.first().user, None)

    def test_create_search_history_from_logged_in_user(self):
        self.client.login(username='test', password='test')
        response = self.client.get('/v1/search', {
            'q': 'test',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(str(Search.objects.first().search_value), 'test')
        self.assertEqual(str(Search.objects.first().user), 'test')

    def test_get_search_history_list_from_not_logged_in_user(self):
        for i in range(15):
            self.client.get('/v1/search', {
                'q': f'test {i}',
            })

        response = self.client.get('/v1/search/history')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(len(content['body']['searches']), 0)

    def test_get_search_history_list_from_logged_in_user(self):
        self.client.login(username='test', password='test')
        for i in range(15):
            self.client.get('/v1/search', {
                'q': f'test {i}',
            })

        response = self.client.get('/v1/search/history')
        self.assertEqual(response.status_code, 200)

    def test_delete_search_history_from_not_logged_in_user(self):
        for i in range(15):
            self.client.get('/v1/search', {
                'q': f'test {i}',
            })

        search = Search.objects.first()
        response = self.client.delete(f'/v1/search/history/{search.id}')
        self.assertEqual(response.status_code, 404)

    def test_delete_search_history_from_logged_in_user(self):
        self.client.login(username='test', password='test')
        for i in range(15):
            self.client.get('/v1/search', {
                'q': f'test {i}',
            })

        search = Search.objects.first()
        response = self.client.delete(f'/v1/search/history/{search.id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Search.objects.filter(user=User.objects.get(username='test')).count(), 14)
