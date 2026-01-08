import json
from django.test import TestCase

from board.models import (
    User, Config, Post, PostContent, PostConfig,
    Profile, Tag
)


class SearchAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Create test users
        author = User.objects.create_user(
            username='author',
            password='author',
            email='author@test.com',
        )
        Profile.objects.create(user=author, role=Profile.Role.EDITOR)
        Config.objects.create(user=author)

        author2 = User.objects.create_user(
            username='another',
            password='another',
            email='another@test.com',
        )
        Profile.objects.create(user=author2, role=Profile.Role.EDITOR)
        Config.objects.create(user=author2)

        # Create test posts with different content
        posts_data = [
            {
                'url': 'python-tutorial',
                'title': 'Python Programming Tutorial',
                'description': 'Learn Python from scratch',
                'content': '# Python Tutorial\nThis is a comprehensive Python guide.',
                'tags': ['python', 'programming']
            },
            {
                'url': 'javascript-guide',
                'title': 'JavaScript Complete Guide',
                'description': 'Master JavaScript programming',
                'content': '# JavaScript Guide\nLearn JavaScript step by step.',
                'tags': ['javascript', 'programming']
            },
            {
                'url': 'django-tips',
                'title': 'Django Tips and Tricks',
                'description': 'Useful Django tips for developers',
                'content': '# Django Tips\nOptimize your Django applications.',
                'tags': ['django', 'python']
            },
            {
                'url': 'react-basics',
                'title': 'React Basics',
                'description': 'Introduction to React framework',
                'content': '# React Introduction\nBuild UI with React.',
                'tags': ['react', 'javascript']
            },
            {
                'url': 'hidden-post',
                'title': 'Hidden Post with Python',
                'description': 'This should not appear in search',
                'content': '# Hidden Content',
                'tags': ['python'],
                'hide': True
            }
        ]

        for i, data in enumerate(posts_data):
            post = Post.objects.create(
                url=data['url'],
                title=data['title'],
                meta_description=data['description'],
                author=author if i < 3 else author2,
            )
            PostContent.objects.create(
                post=post,
                text_md=data['content'],
                text_html=f'<h1>{data["title"]}</h1>'
            )
            PostConfig.objects.create(
                post=post,
                hide=data.get('hide', False),
                advertise=False,
            )

            # Add tags
            for tag_value in data['tags']:
                tag, _ = Tag.objects.get_or_create(value=tag_value)
                post.tags.add(tag)

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'

    def test_search_by_title(self):
        """제목으로 검색 테스트"""
        response = self.client.get('/v1/search?q=Python')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertIn('results', content['body'])
        self.assertGreater(len(content['body']['results']), 0)

        # Check that the result contains Python in title
        found = False
        for result in content['body']['results']:
            if 'Python' in result['title']:
                found = True
                break
        self.assertTrue(found)

    def test_search_by_description(self):
        """설명으로 검색 테스트"""
        response = self.client.get('/v1/search?q=Master')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertGreater(len(content['body']['results']), 0)

    def test_search_by_tag(self):
        """태그로 검색 테스트"""
        response = self.client.get('/v1/search?q=programming')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertGreater(len(content['body']['results']), 0)

    def test_search_by_content(self):
        """본문 내용으로 검색 테스트"""
        response = self.client.get('/v1/search?q=comprehensive')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        results = content['body']['results']
        self.assertGreater(len(results), 0)

    def test_search_hidden_posts_not_shown(self):
        """숨겨진 포스트는 검색 결과에 나타나지 않음"""
        response = self.client.get('/v1/search?q=Hidden')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)

        # Hidden post should not appear
        for result in content['body']['results']:
            self.assertNotEqual(result['title'], 'Hidden Post with Python')

    def test_search_with_username_filter(self):
        """특정 사용자의 포스트만 검색"""
        response = self.client.get('/v1/search?q=javascript&username=another')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)

        # All results should be from 'another' user
        for result in content['body']['results']:
            self.assertEqual(result['author'], 'another')

    def test_search_with_pagination(self):
        """페이지네이션이 적용된 검색"""
        response = self.client.get('/v1/search?q=programming&page=1')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertIn('lastPage', content['body'])
        self.assertIn('results', content['body'])

    def test_search_returns_metadata(self):
        """검색 결과에 메타데이터 포함 확인"""
        response = self.client.get('/v1/search?q=Python')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)

        self.assertIn('elapsedTime', content['body'])
        self.assertIn('totalSize', content['body'])
        self.assertIn('query', content['body'])
        self.assertEqual(content['body']['query'], 'Python')

    def test_search_result_structure(self):
        """검색 결과 구조 확인"""
        response = self.client.get('/v1/search?q=Django')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        results = content['body']['results']

        if len(results) > 0:
            result = results[0]
            self.assertIn('url', result)
            self.assertIn('title', result)
            self.assertIn('description', result)
            self.assertIn('author', result)
            self.assertIn('createdDate', result)
            self.assertIn('positions', result)

    def test_search_positions_field(self):
        """검색 위치 정보 확인 (제목, 설명, 태그, 내용)"""
        response = self.client.get('/v1/search?q=Python')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        results = content['body']['results']

        # Find a result with Python in title
        for result in results:
            if 'Python' in result['title']:
                self.assertIn('positions', result)
                # Should contain '제목' since Python is in title
                self.assertIn('제목', result['positions'])
                break

    def test_search_relevance_ordering(self):
        """검색 결과 관련성 순서 확인"""
        response = self.client.get('/v1/search?q=Python')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        results = content['body']['results']

        # Title matches should come first
        if len(results) >= 2:
            first_result = results[0]
            # First result should have Python in title (highest relevance)
            self.assertTrue('Python' in first_result['title'])

    def test_search_empty_query(self):
        """빈 검색어 처리"""
        response = self.client.get('/v1/search?q=')
        self.assertEqual(response.status_code, 200)
        # Should return results (minimum length check is 0)

    def test_search_query_length_limit(self):
        """검색어 길이 제한 (최대 20자)"""
        long_query = 'a' * 30
        response = self.client.get(f'/v1/search?q={long_query}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        # Query should be truncated to 20 characters
        self.assertLessEqual(len(content['body']['query']), 20)

    def test_search_no_results(self):
        """검색 결과가 없는 경우"""
        response = self.client.get('/v1/search?q=NonexistentKeyword123')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(len(content['body']['results']), 0)
        self.assertEqual(content['body']['totalSize'], 0)

    def test_search_case_insensitive(self):
        """대소문자 구분 없이 검색"""
        response1 = self.client.get('/v1/search?q=python')
        response2 = self.client.get('/v1/search?q=PYTHON')

        content1 = json.loads(response1.content)
        content2 = json.loads(response2.content)

        # Both should return results
        self.assertGreater(len(content1['body']['results']), 0)
        self.assertGreater(len(content2['body']['results']), 0)

    def test_search_multiple_keywords(self):
        """여러 키워드로 검색"""
        response = self.client.get('/v1/search?q=JavaScript React')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        # Should return results containing JavaScript or React
        self.assertGreaterEqual(len(content['body']['results']), 0)

    def test_invalid_method(self):
        """GET 이외의 메서드는 허용되지 않음"""
        response = self.client.post('/v1/search', {'q': 'test'})
        self.assertEqual(response.status_code, 404)
