import json
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from board.models import Config, Post, PostConfig, PostContent, Profile, Tag, User


class SearchAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='author',
            password='author',
            email='author@test.com',
        )
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.author)

        cls.another_author = User.objects.create_user(
            username='another',
            password='another',
            email='another@test.com',
        )
        Profile.objects.create(user=cls.another_author, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.another_author)

        now = timezone.now()

        cls.create_post(
            author=cls.author,
            url='python-tutorial',
            title='Python Programming Tutorial',
            description='Learn Python from scratch',
            content='# Python Tutorial\nThis is a comprehensive Python guide.',
            tags=['python', 'programming'],
            published_date=now,
        )
        cls.create_post(
            author=cls.author,
            url='javascript-guide',
            title='JavaScript Complete Guide',
            description='Master JavaScript programming',
            content='# JavaScript Guide\nLearn JavaScript step by step.',
            tags=['javascript', 'programming'],
            published_date=now,
        )
        cls.create_post(
            author=cls.author,
            url='django-tips',
            title='Django Tips and Tricks',
            description='Useful Django tips for Python developers',
            content='# Django Tips\nOptimize your Django applications.',
            tags=['django', 'python'],
            published_date=now,
        )
        cls.create_post(
            author=cls.another_author,
            url='react-basics',
            title='React Basics',
            description='Introduction to React framework',
            content='# React Introduction\nBuild UI with React.',
            tags=['react', 'javascript'],
            published_date=now,
        )
        cls.create_post(
            author=cls.author,
            url='hidden-post',
            title='Hidden Post with Python',
            description='This should not appear in search',
            content='# Hidden Content',
            tags=['python'],
            published_date=now,
            hide=True,
        )
        cls.create_post(
            author=cls.author,
            url='draft-python-note',
            title='Draft Python Note',
            description='Draft post should never be returned',
            content='Draft content for python keyword.',
            tags=['python'],
            published_date=None,
        )
        cls.create_post(
            author=cls.author,
            url='future-python-roadmap',
            title='Future Python Roadmap',
            description='Scheduled post should not be exposed',
            content='Future release notes for python.',
            tags=['python'],
            published_date=now + timedelta(days=1),
        )
        cls.create_post(
            author=cls.another_author,
            url='react-korean',
            title='리액트 시작하기',
            description='한글 검색 테스트 문서',
            content='리액트와 자바스크립트를 함께 다룹니다.',
            tags=['리액트', '프론트엔드'],
            published_date=now,
        )
        cls.create_post(
            author=cls.author,
            url='symbols-guide',
            title='C++_100% Guide',
            description='Escape test with \\ character',
            content='Special keyword testing content.',
            tags=['c++', 'symbols'],
            published_date=now,
        )

    @classmethod
    def create_post(
        cls,
        *,
        author: User,
        url: str,
        title: str,
        description: str,
        content: str,
        tags: list[str],
        published_date,
        hide: bool = False,
    ):
        post = Post.objects.create(
            url=url,
            title=title,
            meta_description=description,
            author=author,
            published_date=published_date,
        )
        PostContent.objects.create(
            post=post,
            text_md=content,
            text_html=f'<h1>{title}</h1>',
        )
        PostConfig.objects.create(
            post=post,
            hide=hide,
            advertise=False,
        )

        for tag_value in tags:
            tag, _ = Tag.objects.get_or_create(value=tag_value)
            post.tags.add(tag)

        return post

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'

    def test_search_empty_query_returns_error(self):
        response = self.client.get('/v1/search?q=   ')
        self.assertEqual(response.status_code, 200)

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')

    def test_search_query_length_limit_is_100(self):
        long_query = 'a' * 130
        response = self.client.get('/v1/search', {'q': long_query})
        self.assertEqual(response.status_code, 200)

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(len(content['body']['query']), 100)

    def test_search_case_insensitive(self):
        lower_response = self.client.get('/v1/search', {'q': 'python'})
        upper_response = self.client.get('/v1/search', {'q': 'PYTHON'})

        lower_content = json.loads(lower_response.content)
        upper_content = json.loads(upper_response.content)

        self.assertEqual(lower_content['status'], 'DONE')
        self.assertEqual(upper_content['status'], 'DONE')
        self.assertGreater(lower_content['body']['totalSize'], 0)
        self.assertEqual(lower_content['body']['totalSize'], upper_content['body']['totalSize'])

    def test_search_hidden_posts_not_shown(self):
        response = self.client.get('/v1/search', {'q': 'Hidden'})
        self.assertEqual(response.status_code, 200)

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        titles = [result['title'] for result in content['body']['results']]
        self.assertNotIn('Hidden Post with Python', titles)

    def test_search_draft_posts_not_shown(self):
        response = self.client.get('/v1/search', {'q': 'Draft'})
        self.assertEqual(response.status_code, 200)

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        titles = [result['title'] for result in content['body']['results']]
        self.assertNotIn('Draft Python Note', titles)

    def test_search_future_posts_not_shown(self):
        response = self.client.get('/v1/search', {'q': 'Future'})
        self.assertEqual(response.status_code, 200)

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        titles = [result['title'] for result in content['body']['results']]
        self.assertNotIn('Future Python Roadmap', titles)

    def test_search_with_username_filter(self):
        response = self.client.get('/v1/search', {'q': 'javascript', 'username': 'another'})
        self.assertEqual(response.status_code, 200)

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertGreater(content['body']['totalSize'], 0)
        for result in content['body']['results']:
            self.assertEqual(result['author'], 'another')

    def test_search_special_characters(self):
        for keyword in ['%', '_', '\\']:
            response = self.client.get('/v1/search', {'q': keyword})
            self.assertEqual(response.status_code, 200)
            content = json.loads(response.content)
            self.assertEqual(content['status'], 'DONE')

        plus_response = self.client.get('/v1/search', {'q': 'C++'})
        plus_content = json.loads(plus_response.content)
        plus_titles = [result['title'] for result in plus_content['body']['results']]
        self.assertIn('C++_100% Guide', plus_titles)

    def test_search_multiple_keywords_split(self):
        response = self.client.get('/v1/search', {'q': 'JavaScript React'})
        self.assertEqual(response.status_code, 200)

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        titles = [result['title'] for result in content['body']['results']]

        self.assertTrue(any('JavaScript' in title for title in titles))
        self.assertTrue(any('React' in title or '리액트' in title for title in titles))

    def test_search_korean(self):
        response = self.client.get('/v1/search', {'q': '리액트'})
        self.assertEqual(response.status_code, 200)

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        titles = [result['title'] for result in content['body']['results']]
        self.assertIn('리액트 시작하기', titles)

    def test_search_positions_field(self):
        response = self.client.get('/v1/search', {'q': 'Python'})
        self.assertEqual(response.status_code, 200)

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        matched = next(
            (result for result in content['body']['results'] if result['url'] == 'python-tutorial'),
            None,
        )
        self.assertIsNotNone(matched)
        self.assertIn('positions', matched)
        self.assertIn('제목', matched['positions'])

    def test_search_relevance_ordering_prefers_title_match(self):
        response = self.client.get('/v1/search', {'q': 'Python'})
        self.assertEqual(response.status_code, 200)

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        results = content['body']['results']

        self.assertGreater(len(results), 0)
        self.assertIn('Python', results[0]['title'])

    def test_search_result_structure(self):
        response = self.client.get('/v1/search', {'q': 'Django'})
        self.assertEqual(response.status_code, 200)

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIn('elapsedTime', content['body'])
        self.assertIn('totalSize', content['body'])
        self.assertIn('lastPage', content['body'])

        if len(content['body']['results']) > 0:
            result = content['body']['results'][0]
            self.assertIn('url', result)
            self.assertIn('title', result)
            self.assertIn('image', result)
            self.assertIn('description', result)
            self.assertIn('createdDate', result)
            self.assertIn('author', result)
            self.assertIn('authorImage', result)
            self.assertIn('positions', result)

    def test_invalid_method(self):
        response = self.client.post('/v1/search', {'q': 'test'})
        self.assertEqual(response.status_code, 404)
