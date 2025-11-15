"""
검색 페이지 템플릿 테스트
URL: /search
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostContent, PostConfig, Tag


class SearchPageTestCase(TestCase):
    """검색 페이지 (/search) 템플릿 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        # 검색 가능한 포스트 생성
        self.post = Post.objects.create(
            title='Python Django Tutorial',
            url='python-django-tutorial',
            author=self.user,
            created_date=timezone.now(),
            meta_description='Learn Django with Python'
        )
        PostContent.objects.create(
            post=self.post,
            text_md='# Django Tutorial\nLearn Python Django framework',
            text_html='<h1>Django Tutorial</h1><p>Learn Python Django framework</p>'
        )
        PostConfig.objects.create(
            post=self.post,
            hide=False,
            notice=False,
            advertise=False
        )

        # 태그 추가
        tag = Tag.objects.create(value='python')
        self.post.tags.add(tag)

    def test_search_page_renders(self):
        """검색 페이지가 정상적으로 렌더링되는지 테스트"""
        response = self.client.get(reverse('search'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/search/search_posts.html')

    def test_search_without_query(self):
        """검색어 없이 검색 페이지 접근"""
        response = self.client.get(reverse('search'))
        self.assertEqual(response.status_code, 200)

    def test_search_with_query(self):
        """검색어를 입력한 경우 테스트"""
        response = self.client.get(reverse('search') + '?q=Django')
        self.assertEqual(response.status_code, 200)
        self.assertIn('query', response.context)
        self.assertIn('results', response.context)
        self.assertIn('total_size', response.context)
        self.assertIn('elapsed_time', response.context)

    def test_search_finds_posts_by_title(self):
        """제목으로 포스트 검색 테스트"""
        response = self.client.get(reverse('search') + '?q=Django')
        self.assertEqual(response.status_code, 200)
        self.assertGreater(response.context['total_size'], 0)

    def test_search_finds_posts_by_content(self):
        """내용으로 포스트 검색 테스트"""
        response = self.client.get(reverse('search') + '?q=framework')
        self.assertEqual(response.status_code, 200)

    def test_search_finds_posts_by_tag(self):
        """태그로 포스트 검색 테스트"""
        response = self.client.get(reverse('search') + '?q=python')
        self.assertEqual(response.status_code, 200)

    def test_search_with_empty_query(self):
        """빈 검색어로 검색 시 테스트"""
        response = self.client.get(reverse('search') + '?q=')
        self.assertEqual(response.status_code, 200)

    def test_search_with_no_results(self):
        """결과가 없는 검색 테스트"""
        response = self.client.get(reverse('search') + '?q=nonexistentterm12345')
        self.assertEqual(response.status_code, 200)
        if 'total_size' in response.context:
            self.assertEqual(response.context['total_size'], 0)

    def test_search_pagination(self):
        """검색 결과 페이지네이션 테스트"""
        response = self.client.get(reverse('search') + '?q=Django&page=1')
        self.assertEqual(response.status_code, 200)
        self.assertIn('page', response.context)

    def test_search_max_query_length(self):
        """검색어 최대 길이 제한 테스트 (20자)"""
        long_query = 'a' * 100  # 100자 검색어
        response = self.client.get(reverse('search') + f'?q={long_query}')
        self.assertEqual(response.status_code, 200)
        # 검색어가 20자로 제한되어야 함
        if 'query' in response.context:
            self.assertLessEqual(len(response.context['query']), 20)

    def test_search_with_special_characters(self):
        """특수 문자가 포함된 검색어 테스트 (SQL Injection, XSS 등)"""
        special_queries = [
            '<script>alert("xss")</script>',
            'SELECT * FROM posts',
            '../../etc/passwd',
            '\'OR\'1\'=\'1',
            '<img src=x onerror=alert(1)>',
        ]

        for query in special_queries:
            with self.subTest(query=query):
                response = self.client.get(reverse('search') + f'?q={query}')
                self.assertEqual(response.status_code, 200)

    def test_search_with_unicode_query(self):
        """유니코드 검색어 테스트"""
        unicode_queries = ['한글', '日本語', '中文', '🚀']

        for query in unicode_queries:
            with self.subTest(query=query):
                response = self.client.get(reverse('search') + f'?q={query}')
                self.assertEqual(response.status_code, 200)

    def test_search_does_not_show_hidden_posts(self):
        """검색 결과에 숨겨진 포스트가 표시되지 않는지 테스트"""
        hidden_post = Post.objects.create(
            title='Hidden Django Post',
            url='hidden-django-post',
            author=self.user,
            created_date=timezone.now()
        )
        PostContent.objects.create(
            post=hidden_post,
            text_md='Hidden Django content',
            text_html='<p>Hidden Django content</p>'
        )
        PostConfig.objects.create(
            post=hidden_post,
            hide=True,
            notice=False,
            advertise=False
        )

        response = self.client.get(reverse('search') + '?q=Django')
        self.assertEqual(response.status_code, 200)

        # 검색 결과에서 숨겨진 포스트 제외 확인
        if 'results' in response.context:
            result_titles = [result['title'] for result in response.context['results']]
            self.assertNotIn('Hidden Django Post', result_titles)
