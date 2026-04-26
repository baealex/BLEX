"""
Tests for Post Detail View and ToC structure
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostContent, PostConfig, SiteSetting

class PostDetailViewTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testauthor',
            email='test@example.com',
            password='password123'
        )
        self.post = Post.objects.create(
            title='Test Post',
            url='test-post',
            author=self.user,
            created_date=timezone.now(),
            published_date=timezone.now()
        )
        # Create PostContent with headers
        PostContent.objects.create(
            post=self.post,
            text_md='# Header 1\n## Header 2',
            text_html='<h1>Header 1</h1><h2>Header 2</h2>'
        )
        PostConfig.objects.create(
            post=self.post,
            hide=False
        )

    def enable_aeo(self):
        setting = SiteSetting.get_instance()
        setting.aeo_enabled = True
        setting.save(update_fields=['aeo_enabled'])

    def test_post_detail_context_has_toc(self):
        url = reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        })
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('table_of_contents', response.context)
        
        toc = response.context['table_of_contents']

        self.assertEqual(len(toc), 2)
        self.assertEqual(toc[0]['text'], 'Header 1')
        self.assertEqual(toc[0]['level'], 1)
        self.assertEqual(toc[1]['text'], 'Header 2')
        self.assertEqual(toc[1]['level'], 2)

    def test_post_detail_hides_copy_for_ai_action_when_aeo_disabled(self):
        url = reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        })
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'aria-label="AI용 Markdown 복사"')
        self.assertNotContains(response, 'data-ai-markdown-url=')

    def test_post_detail_has_copy_for_ai_action_when_aeo_enabled(self):
        self.enable_aeo()
        url = reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        })
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'aria-label="AI용 Markdown 복사"')
        self.assertContains(response, 'data-ai-markdown-url=/@testauthor/test-post.md')

    def test_post_detail_hides_markdown_alternate_when_aeo_disabled(self):
        """AEO가 꺼져 있으면 포스트 상세가 Markdown endpoint를 광고하지 않는다."""
        url = reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        })
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)

        content = response.content.decode()

        self.assertNotIn('rel=alternate type=text/markdown', content)
        self.assertNotIn('http://testserver/@testauthor/test-post.md', content)
        self.assertNotIn('Link', response)
        self.assertNotIn('X-Llms-Txt', response)

    def test_post_detail_advertises_markdown_alternate(self):
        """포스트 상세는 AI 에이전트가 Markdown export를 발견할 수 있게 힌트를 제공한다."""
        self.enable_aeo()
        url = reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        })
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)

        markdown_url = 'http://testserver/@testauthor/test-post.md'
        llms_txt_url = 'http://testserver/llms.txt'

        content = response.content.decode()

        self.assertIn(markdown_url, content)
        self.assertIn('rel=alternate type=text/markdown', content)
        self.assertIn(
            f'<{markdown_url}>; rel="alternate"; type="text/markdown"',
            response['Link']
        )
        self.assertIn(
            f'<{llms_txt_url}>; rel="llms-txt"',
            response['Link']
        )
        self.assertEqual(response['X-Llms-Txt'], llms_txt_url)
