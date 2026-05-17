"""
Main page template tests.
URL: / (index)
"""
from django.contrib.auth.models import User
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostConfig, PostContent, SiteSetting


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
            content_html='<h1>Test Content</h1>',
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

    def test_index_page_adds_noindex_when_seo_disabled(self):
        setting = SiteSetting.get_instance()
        setting.seo_enabled = False
        setting.save(update_fields=['seo_enabled'])

        response = self.client.get(reverse('index'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<meta name="robots" content="noindex,nofollow">', html=True)
        self.assertContains(response, '<meta name="googlebot" content="noindex,nofollow">', html=True)
        self.assertEqual(response['X-Robots-Tag'], 'noindex, nofollow')

    def test_index_page_omits_noindex_when_seo_enabled(self):
        setting = SiteSetting.get_instance()
        setting.seo_enabled = True
        setting.save(update_fields=['seo_enabled'])

        response = self.client.get(reverse('index'))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'content="noindex,nofollow"')
        self.assertNotIn('X-Robots-Tag', response)

    @override_settings(DEBUG=True)
    def test_debug_environment_indicator_is_visible_in_debug(self):
        response = self.client.get(reverse('index'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '개발 환경')

    @override_settings(DEBUG=False)
    def test_debug_environment_indicator_is_hidden_outside_debug(self):
        response = self.client.get(reverse('index'))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, '개발 환경')

    def test_index_page_has_required_context(self):
        response = self.client.get(reverse('index'))

        required_fields = ['posts', 'page_number', 'page_count']
        for field in required_fields:
            with self.subTest(field=field):
                self.assertIn(field, response.context)

    def test_index_page_uses_latest_order_by_default(self):
        older_post = Post.objects.create(
            title='Older Post',
            url='older-post',
            author=self.user,
            created_date=timezone.now() - timezone.timedelta(days=2),
            published_date=timezone.now() - timezone.timedelta(days=2),
        )
        PostContent.objects.create(
            post=older_post,
            content_html='<p>Older content</p>',
        )
        PostConfig.objects.create(
            post=older_post,
            hide=False,
            advertise=False,
        )

        response = self.client.get(reverse('index') + '?sort=popular')
        posts = list(response.context['posts'])

        self.assertEqual(response.status_code, 200)
        self.assertNotIn('sort_type', response.context)
        self.assertEqual(posts[0].title, 'Test Post')

    def test_index_page_shows_interested_feed_tab_for_authenticated_user(self):
        self.client.login(username='testuser', password='testpass123')

        response = self.client.get(reverse('index'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'href=/interests')
        self.assertContains(response, '관심')

    def test_index_page_hides_interested_feed_tab_for_anonymous_user(self):
        response = self.client.get(reverse('index'))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'href=/interests')

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
            content_html='<p>Hidden content</p>',
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
            content_html='<p>Future content</p>',
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
                content_html=f'<p>Content {i}</p>',
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
                advertise=False,
            )

        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.context['posts']), 0)
