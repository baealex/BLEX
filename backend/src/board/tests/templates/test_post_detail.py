"""
Tests for Post Detail View and ToC structure
"""
import datetime
import html
import json
import re
import urllib.parse

from django.test import TestCase, Client, override_settings
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from board.models import Config, Post, PostContent, PostConfig, Profile, Series, SiteSetting
from board.services.post_service import PostService

@override_settings(SITE_URL='http://localhost:8000')
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

    def set_post_dates(self, published_date, updated_date):
        self.post.published_date = published_date
        self.post.updated_date = updated_date
        self.post.save(update_fields=['published_date', 'updated_date'])

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


    @override_settings(SITE_URL='https://blex.example')
    def test_post_detail_uses_configured_site_url_for_metadata(self):
        url = reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        })
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)

        canonical_url = 'https://blex.example/@testauthor/test-post'
        content = response.content.decode()
        self.assertIn(f'<meta content={canonical_url} property=og:url>', content)
        self.assertIn(f'<meta content={canonical_url} property=twitter:url>', content)
        self.assertIn(f'<link href={canonical_url} rel=canonical>', content)
        self.assertIn(f'"@id": "{canonical_url}"', content)
        self.assertIn('"url": "https://blex.example/@testauthor"', content)

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
        self.assertContains(response, '일반 링크')
        self.assertContains(response, 'X에 공유')
        self.assertContains(response, 'fa-x-twitter')
        self.assertContains(response, 'LinkedIn에 공유')
        self.assertContains(response, 'Facebook에 공유')
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

    def test_post_detail_hides_updated_date_when_display_date_matches(self):
        """표시 날짜가 같으면 초 단위 updated_date 차이를 수정 표시로 보여주지 않는다."""
        self.set_post_dates(
            timezone.make_aware(datetime.datetime(2026, 5, 30, 10, 0, 0)),
            timezone.make_aware(datetime.datetime(2026, 5, 30, 18, 0, 0)),
        )

        response = self.client.get(reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        }))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.context['show_post_updated_date'])
        self.assertContains(response, '2026-05-30 발행')
        self.assertNotContains(response, '2026-05-30 수정')
        self.assertNotContains(response, '수정일')

    def test_post_detail_shows_updated_date_when_display_date_differs(self):
        """표시 날짜가 다르면 상단 메타와 글 정보에 수정일을 보여준다."""
        self.set_post_dates(
            timezone.make_aware(datetime.datetime(2026, 5, 30, 10, 0, 0)),
            timezone.make_aware(datetime.datetime(2026, 5, 31, 10, 0, 0)),
        )

        response = self.client.get(reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        }))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context['show_post_updated_date'])
        self.assertContains(response, '2026-05-30 발행')
        self.assertContains(response, '2026-05-31 수정')
        self.assertContains(response, '수정일')

    def test_post_detail_shows_post_info_section(self):
        """포스트 상세 하단에 사람이 확인할 수 있는 글 정보를 보여준다."""
        response = self.client.get(reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        }))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '글 정보')
        self.assertContains(response, '작성자')
        self.assertContains(response, '최초 발행')
        self.assertContains(response, '/@testauthor')

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
        self.assertContains(response, 'X에 공유')
        self.assertContains(response, 'LinkedIn에 공유')
        self.assertContains(response, '에이전트용 링크')
        self.assertContains(response, '*.md 참조 주소')

        content = response.content.decode()
        self.assertIn('data-agent-copy-url=http://localhost:8000/@testauthor/test-post.md', content)

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
        self.assertNotIn('http://localhost:8000/@testauthor/test-post.md', content)
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

        markdown_url = 'http://localhost:8000/@testauthor/test-post.md'
        llms_txt_url = 'http://localhost:8000/llms.txt'

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

    def test_post_detail_hides_markdown_source_for_hidden_post_when_aeo_enabled(self):
        """AEO가 켜져 있어도 공개 글이 아니면 Markdown 원문을 노출하지 않는다."""
        self.enable_aeo()
        self.post.config.hide = True
        self.post.config.save(update_fields=['hide'])
        self.client.login(username='testauthor', password='password123')

        response = self.client.get(reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        }))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.context['show_agent_post_markdown'])
        self.assertNotContains(response, 'data-agent-copy-url=')
        self.assertNotContains(response, '*.md 참조 주소')
        self.assertNotIn('Link', response)
        self.assertNotIn('X-Llms-Txt', response)

    def test_post_detail_shows_hidden_status_notice_for_author(self):
        """비공개 글은 작성자에게 항상 상단 상태 안내를 보여준다."""
        self.post.config.hide = True
        self.post.config.save(update_fields=['hide'])
        self.client.login(username='testauthor', password='password123')
        url = reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        })
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context['show_post_status_notice'])
        self.assertEqual(response.context['post_visibility_status'], 'hidden')
        self.assertContains(response, 'data-post-status-notice')
        self.assertContains(response, 'data-post-status-visibility=hidden')
        self.assertNotContains(response, 'data-publish-success-guide')

    def test_post_detail_shows_scheduled_status_notice_for_author(self):
        """예약 발행 글은 작성자에게 항상 상단 상태 안내를 보여준다."""
        self.post.published_date = timezone.now() + datetime.timedelta(days=1)
        self.post.save(update_fields=['published_date'])
        self.client.login(username='testauthor', password='password123')
        url = reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        })
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context['show_post_status_notice'])
        self.assertEqual(response.context['post_visibility_status'], 'scheduled')
        self.assertContains(response, 'data-post-status-notice')
        self.assertContains(response, 'data-post-status-visibility=scheduled')
        self.assertNotContains(response, 'data-publish-success-guide')


class PostEditorPublishRedirectTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='editor',
            email='editor@example.com',
            password='password123'
        )
        Profile.objects.create(user=cls.user, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.user)

    def get_post_editor_props(self, response):
        content = response.content.decode()
        match = re.search(
            r'<island-component[^>]*\bdata-island-name="?PostEditor"?[^>]*\bprops="?([^"\s>]+)"?',
            content,
        )
        self.assertIsNotNone(match)
        return json.loads(urllib.parse.unquote(html.unescape(match.group(1))))

    def test_post_editor_shows_first_publish_guide_for_author_without_posts(self):
        """발행한 글이 없는 작성자에게 첫 발행 가이드를 노출한다."""
        self.client.login(username='editor', password='password123')

        response = self.client.get('/write')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context['show_first_publish_guide'])
        props = self.get_post_editor_props(response)
        self.assertTrue(props['showFirstPublishGuide'])

    def test_post_editor_shows_first_publish_guide_for_first_draft(self):
        """발행한 글 없이 임시 글만 있는 작성자에게 첫 발행 가이드를 노출한다."""
        draft = PostService.create_draft(
            user=self.user,
            title='First Draft',
            text_html='<p>Draft body</p>',
            custom_url='first-draft',
        )
        self.client.login(username='editor', password='password123')

        response = self.client.get(f'/write?draft={draft.url}')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context['show_first_publish_guide'])
        props = self.get_post_editor_props(response)
        self.assertTrue(props['showFirstPublishGuide'])

    def test_post_editor_hides_first_publish_guide_after_first_publish(self):
        """이미 발행한 글이 있는 작성자에게 첫 발행 가이드를 숨긴다."""
        PostService.create_post(
            user=self.user,
            title='Existing Post',
            text_html='<p>Published body</p>',
            custom_url='existing-post',
        )
        self.client.login(username='editor', password='password123')

        response = self.client.get('/write')

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.context['show_first_publish_guide'])
        props = self.get_post_editor_props(response)
        self.assertFalse(props['showFirstPublishGuide'])

    def test_post_editor_redirects_new_publish_to_post_detail(self):
        """새 글 발행 후 공개 상세 화면으로 이동한다."""
        self.client.login(username='editor', password='password123')

        response = self.client.post('/write', {
            'title': 'First Published Post',
            'url': 'first-published-post',
            'content_html': '<p>Hello BLEX</p>',
        })

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], '/@editor/first-published-post')
        self.assertTrue(Post.objects.filter(
            author=self.user,
            url='first-published-post',
            published_date__isnull=False,
        ).exists())

    def test_post_editor_redirects_draft_publish_to_post_detail(self):
        """초안 발행은 기존 초안을 공개 글로 바꾸고 상세 화면으로 이동한다."""
        draft = PostService.create_draft(
            user=self.user,
            title='Draft Title',
            text_html='<p>Draft body</p>',
            custom_url='draft-title',
        )
        self.client.login(username='editor', password='password123')

        response = self.client.post('/write', {
            'draft_url': draft.url,
            'title': 'Published Draft Title',
            'url': 'published-draft-title',
            'content_html': '<p>Published draft body</p>',
        })

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], '/@editor/published-draft-title')

        draft.refresh_from_db()
        self.assertEqual(draft.url, 'published-draft-title')
        self.assertIsNotNone(draft.published_date)
        self.assertEqual(Post.objects.filter(author=self.user).count(), 1)

    def test_post_editor_returns_to_draft_when_draft_publish_fails(self):
        """초안 발행 검증 실패 시 작성 맥락을 잃지 않고 기존 초안으로 돌아간다."""
        draft = PostService.create_draft(
            user=self.user,
            title='Recoverable Draft',
            text_html='',
            custom_url='recoverable-draft',
        )
        self.client.login(username='editor', password='password123')

        response = self.client.post('/write', {
            'draft_url': draft.url,
            'title': 'Recoverable Draft',
            'url': 'recoverable-draft',
            'content_html': '',
        })

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], '/write?draft=recoverable-draft')

        draft.refresh_from_db()
        self.assertIsNone(draft.published_date)
