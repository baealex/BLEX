"""
Tests for Post Detail View and ToC structure
"""
import datetime

from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostContent, PostConfig, Series, SiteSetting

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
            content_html='<h1>Header 1</h1><h2>Header 2</h2>'
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

    def test_post_detail_series_list_hides_drafts_and_future_posts(self):
        """본문 상세의 시리즈 목록은 공개 발행 글만 노출한다."""
        series = Series.objects.create(
            owner=self.user,
            name='Test Series',
            url='test-series',
        )
        self.post.series = series
        self.post.save(update_fields=['series'])

        published_post = Post.objects.create(
            title='Published Series Post',
            url='published-series-post',
            author=self.user,
            series=series,
            published_date=timezone.now(),
        )
        PostContent.objects.create(post=published_post, content_html='<p>Published</p>')
        PostConfig.objects.create(post=published_post, hide=False)

        draft_post = Post.objects.create(
            title='Draft Series Post',
            url='draft-series-post',
            author=self.user,
            series=series,
            published_date=None,
        )
        PostContent.objects.create(post=draft_post, content_html='<p>Draft</p>')
        PostConfig.objects.create(post=draft_post, hide=False)

        future_post = Post.objects.create(
            title='Future Series Post',
            url='future-series-post',
            author=self.user,
            series=series,
            published_date=timezone.now() + datetime.timedelta(days=1),
        )
        PostContent.objects.create(post=future_post, content_html='<p>Future</p>')
        PostConfig.objects.create(post=future_post, hide=False)

        url = reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        })
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Published Series Post')
        self.assertNotContains(response, 'Draft Series Post')
        self.assertNotContains(response, 'Future Series Post')

        visible_titles = [
            series_post.title
            for series_post in response.context['post'].visible_series_posts
        ]
        self.assertEqual(visible_titles, ['Test Post', 'Published Series Post'])

    def test_post_detail_rejects_draft_for_non_owner(self):
        """임시글 상세 URL을 알아도 작성자가 아니면 볼 수 없다."""
        draft = Post.objects.create(
            title='Private Draft',
            url='private-draft',
            author=self.user,
            published_date=None,
        )
        PostContent.objects.create(post=draft, content_html='<p>Draft</p>')
        PostConfig.objects.create(post=draft, hide=False)

        response = self.client.get(reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'private-draft'
        }))

        self.assertEqual(response.status_code, 404)

    def test_post_detail_rejects_draft_for_owner(self):
        """작성자여도 임시글은 공개 상세 화면으로 렌더링하지 않는다."""
        draft = Post.objects.create(
            title='Private Draft',
            url='private-draft',
            author=self.user,
            published_date=None,
        )
        PostContent.objects.create(post=draft, content_html='<p>Draft</p>')
        PostConfig.objects.create(post=draft, hide=False)

        self.client.login(username='testauthor', password='password123')
        response = self.client.get(reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'private-draft'
        }))

        self.assertEqual(response.status_code, 404)

    def test_post_detail_rejects_future_post_for_non_owner(self):
        """미래 발행글 상세 URL을 알아도 작성자가 아니면 볼 수 없다."""
        future_post = Post.objects.create(
            title='Future Post',
            url='future-post',
            author=self.user,
            published_date=timezone.now() + datetime.timedelta(days=1),
        )
        PostContent.objects.create(post=future_post, content_html='<p>Future</p>')
        PostConfig.objects.create(post=future_post, hide=False)

        response = self.client.get(reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'future-post'
        }))

        self.assertEqual(response.status_code, 404)

    def test_post_detail_hides_agent_link_copy_option_when_aeo_disabled(self):
        """AEO가 꺼져 있으면 에이전트 링크 복사 옵션을 노출하지 않는다."""
        url = reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        })
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'aria-label="AI용 Markdown 복사"')
        self.assertNotContains(response, 'data-ai-markdown-url=')
        self.assertNotContains(response, 'data-agent-copy-url=')
        self.assertNotContains(response, '*.md 참조 주소')

    def test_post_detail_uses_noindex_only_when_seo_disabled(self):
        setting = SiteSetting.get_instance()
        setting.seo_enabled = False
        setting.save(update_fields=['seo_enabled'])

        url = reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        })
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<meta name="robots" content="noindex,nofollow">', html=True)
        self.assertContains(response, '<meta name="googlebot" content="noindex,nofollow">', html=True)
        self.assertNotContains(response, 'max-snippet:-1')
        self.assertEqual(response['X-Robots-Tag'], 'noindex, nofollow')

    def test_post_detail_shows_agent_link_copy_option_when_aeo_enabled(self):
        """AEO가 켜져 있으면 링크 복사 드롭다운에 .md 참조 링크 옵션을 표시한다."""
        self.enable_aeo()
        url = reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        })
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'aria-label="AI용 Markdown 복사"')
        self.assertNotContains(response, 'data-ai-markdown-url=')
        self.assertContains(response, '에이전트용 링크')
        self.assertContains(response, '*.md 참조 주소')

        content = response.content.decode()
        self.assertIn('data-agent-copy-url=http://testserver/@testauthor/test-post.md', content)

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
