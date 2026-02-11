"""
메인 페이지 템플릿 테스트
URL: / (index)
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostContent, PostConfig


class MainPageTemplateTestCase(TestCase):
    """메인 페이지 (/) 템플릿 렌더링 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        # 테스트 포스트 생성
        self.post = Post.objects.create(
            title='Test Post',
            url='test-post',
            author=self.user,
            created_date=timezone.now(),
            published_date=timezone.now()
        )
        PostContent.objects.create(
            post=self.post,
            text_md='# Test Content',
            text_html='<h1>Test Content</h1>'
        )
        PostConfig.objects.create(
            post=self.post,
            hide=False,
            notice=False,
            advertise=False
        )

    def test_index_page_renders_successfully(self):
        """메인 페이지가 정상적으로 렌더링되는지 테스트"""
        response = self.client.get(reverse('index'))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/posts/post_list.html')

    def test_index_page_has_required_context(self):
        """메인 페이지 컨텍스트에 필수 필드가 있는지 확인"""
        response = self.client.get(reverse('index'))

        required_fields = ['posts', 'page_number', 'page_count']
        for field in required_fields:
            with self.subTest(field=field):
                self.assertIn(field, response.context)

    def test_index_page_sorting_latest(self):
        """메인 페이지 최신순 정렬 테스트"""
        response = self.client.get(reverse('index') + '?sort=latest')
        self.assertEqual(response.status_code, 200)

    def test_index_page_sorting_popular(self):
        """메인 페이지 인기순 정렬 테스트"""
        response = self.client.get(reverse('index') + '?sort=popular')
        self.assertEqual(response.status_code, 200)

    def test_index_page_sorting_comments(self):
        """메인 페이지 댓글 많은 순 정렬 테스트"""
        response = self.client.get(reverse('index') + '?sort=comments')
        self.assertEqual(response.status_code, 200)

    def test_index_page_pagination(self):
        """메인 페이지 페이지네이션 테스트"""
        response = self.client.get(reverse('index') + '?page=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['page_number'], 1)

    def test_index_page_with_hidden_post(self):
        """숨겨진 포스트가 메인 페이지에 표시되지 않는지 테스트"""
        hidden_post = Post.objects.create(
            title='Hidden Post',
            url='hidden-post',
            author=self.user,
            created_date=timezone.now(),
            published_date=timezone.now()
        )
        PostContent.objects.create(
            post=hidden_post,
            text_md='Hidden content',
            text_html='<p>Hidden content</p>'
        )
        PostConfig.objects.create(
            post=hidden_post,
            hide=True,
            notice=False,
            advertise=False
        )

        response = self.client.get(reverse('index'))
        posts = list(response.context['posts'])
        post_titles = [post.title for post in posts]

        self.assertNotIn('Hidden Post', post_titles)

    def test_index_page_with_future_post(self):
        """미래 날짜의 포스트가 메인 페이지에 표시되지 않는지 테스트"""
        future_date = timezone.now() + timezone.timedelta(days=1)
        future_post = Post.objects.create(
            title='Future Post',
            url='future-post',
            author=self.user,
            created_date=future_date,
            published_date=future_date
        )
        PostContent.objects.create(
            post=future_post,
            text_md='Future content',
            text_html='<p>Future content</p>'
        )
        PostConfig.objects.create(
            post=future_post,
            hide=False,
            notice=False,
            advertise=False
        )

        response = self.client.get(reverse('index'))
        posts = list(response.context['posts'])
        post_titles = [post.title for post in posts]

        self.assertNotIn('Future Post', post_titles)

    def test_index_page_with_empty_database(self):
        """데이터베이스가 비어있을 때 메인 페이지 렌더링"""
        Post.objects.all().delete()

        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)

    def test_index_page_with_multiple_posts(self):
        """여러 포스트가 있을 때 메인 페이지 렌더링"""
        # 추가 포스트 생성
        for i in range(5):
            post = Post.objects.create(
                title=f'Test Post {i}',
                url=f'test-post-{i}',
                author=self.user,
                created_date=timezone.now(),
                published_date=timezone.now()
            )
            PostContent.objects.create(
                post=post,
                text_md=f'Content {i}',
                text_html=f'<p>Content {i}</p>'
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
                notice=False,
                advertise=False
            )

        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.context['posts']), 0)
