"""
Main page template tests.
URL: / (index)
"""
from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostConfig, PostContent


class MainPageTemplateTestCase(TestCase):
    """Template tests for the main index page."""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

        self.post = Post.objects.create(
            title='Test Post',
            url='test-post',
            author=self.user,
            created_date=timezone.now(),
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=self.post,
            text_md='# Test Content',
            text_html='<h1>Test Content</h1>',
        )
        PostConfig.objects.create(
            post=self.post,
            hide=False,
            advertise=False,
        )

    def test_index_page_renders_successfully(self):
        response = self.client.get(reverse('index'))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/posts/post_list.html')
        self.assertContains(response, 'window.__blexIslandMonitor')
        self.assertNotContains(response, 'name=LoginPrompt')
        self.assertNotContains(response, 'name=Toaster')

    def test_index_page_has_required_context(self):
        response = self.client.get(reverse('index'))

        required_fields = ['posts', 'page_number', 'page_count']
        for field in required_fields:
            with self.subTest(field=field):
                self.assertIn(field, response.context)

    def test_index_page_supports_sort_options(self):
        for sort_type in ['latest', 'popular', 'comments']:
            with self.subTest(sort_type=sort_type):
                response = self.client.get(reverse('index') + f'?sort={sort_type}')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.context['sort_type'], sort_type)

    def test_index_page_pagination(self):
        response = self.client.get(reverse('index') + '?page=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['page_number'], 1)

    def test_index_page_with_hidden_post(self):
        hidden_post = Post.objects.create(
            title='Hidden Post',
            url='hidden-post',
            author=self.user,
            created_date=timezone.now(),
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=hidden_post,
            text_md='Hidden content',
            text_html='<p>Hidden content</p>',
        )
        PostConfig.objects.create(
            post=hidden_post,
            hide=True,
            advertise=False,
        )

        response = self.client.get(reverse('index'))
        posts = list(response.context['posts'])
        post_titles = [post.title for post in posts]

        self.assertNotIn('Hidden Post', post_titles)

    def test_index_page_with_future_post(self):
        future_date = timezone.now() + timezone.timedelta(days=1)
        future_post = Post.objects.create(
            title='Future Post',
            url='future-post',
            author=self.user,
            created_date=future_date,
            published_date=future_date,
        )
        PostContent.objects.create(
            post=future_post,
            text_md='Future content',
            text_html='<p>Future content</p>',
        )
        PostConfig.objects.create(
            post=future_post,
            hide=False,
            advertise=False,
        )

        response = self.client.get(reverse('index'))
        posts = list(response.context['posts'])
        post_titles = [post.title for post in posts]

        self.assertNotIn('Future Post', post_titles)

    def test_index_page_with_empty_database(self):
        Post.objects.all().delete()

        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)

    def test_index_page_with_multiple_posts(self):
        for i in range(5):
            post = Post.objects.create(
                title=f'Test Post {i}',
                url=f'test-post-{i}',
                author=self.user,
                created_date=timezone.now(),
                published_date=timezone.now(),
            )
            PostContent.objects.create(
                post=post,
                text_md=f'Content {i}',
                text_html=f'<p>Content {i}</p>',
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
                advertise=False,
            )

        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.context['posts']), 0)
