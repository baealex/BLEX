from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostConfig, PostContent, Series, StaticPage


class SeriesAgentDiscoveryTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.author = User.objects.create_user(
            username='seriesauthor',
            email='series@example.com',
            password='password123',
        )
        self.series = Series.objects.create(
            owner=self.author,
            name='Agent Discovery Series',
            text_md='Series intro',
            url='agent-discovery-series',
            hide=False,
        )
        self.post = Post.objects.create(
            title='Series Post',
            url='series-post',
            author=self.author,
            series=self.series,
            created_date=timezone.now(),
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=self.post,
            text_md='Series body',
            text_html='<p>Series body</p>',
        )
        PostConfig.objects.create(
            post=self.post,
            hide=False,
        )

    def test_series_detail_advertises_markdown_alternate(self):
        response = self.client.get(reverse('series_detail', kwargs={
            'username': 'seriesauthor',
            'series_url': 'agent-discovery-series',
        }))

        self.assertEqual(response.status_code, 200)

        markdown_url = 'http://testserver/@seriesauthor/series/agent-discovery-series.md'
        llms_txt_url = 'http://testserver/llms.txt'
        content = response.content.decode()

        self.assertIn(markdown_url, content)
        self.assertIn('rel=alternate', content)
        self.assertIn('type=text/markdown', content)
        self.assertIn(
            f'<{markdown_url}>; rel="alternate"; type="text/markdown"',
            response['Link'],
        )
        self.assertIn(
            f'<{llms_txt_url}>; rel="llms-txt"',
            response['Link'],
        )
        self.assertEqual(response['X-Llms-Txt'], llms_txt_url)


class StaticPageAgentDiscoveryTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.page = StaticPage.objects.create(
            slug='agent-policy',
            title='Agent Policy',
            content='<h2>Policy</h2><p>Agent-readable policy page.</p>',
            meta_description='Agent policy page',
            is_published=True,
        )

    def test_static_page_advertises_markdown_alternate(self):
        response = self.client.get(reverse('static_page', kwargs={
            'slug': 'agent-policy',
        }))

        self.assertEqual(response.status_code, 200)

        markdown_url = 'http://testserver/static/agent-policy.md'
        llms_txt_url = 'http://testserver/llms.txt'
        content = response.content.decode()

        self.assertIn(markdown_url, content)
        self.assertIn('rel=alternate', content)
        self.assertIn('type=text/markdown', content)
        self.assertIn(
            f'<{markdown_url}>; rel="alternate"; type="text/markdown"',
            response['Link'],
        )
        self.assertIn(
            f'<{llms_txt_url}>; rel="llms-txt"',
            response['Link'],
        )
        self.assertEqual(response['X-Llms-Txt'], llms_txt_url)
