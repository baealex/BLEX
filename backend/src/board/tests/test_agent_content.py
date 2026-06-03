import re
from datetime import timedelta
from urllib.parse import urlsplit
from xml.etree import ElementTree

from django.conf import settings
from django.contrib.auth.models import User
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from board.models import Post, PostConfig, PostContent, Profile, Series, SiteSetting, StaticPage
from board.feeds import SitePostsFeed, UserPostsFeed


BASE_MIDDLEWARE = tuple(
    middleware
    for middleware in settings.MIDDLEWARE
    if middleware != 'main.middleware.AccessSitemapOnlyBot'
)
AEO_MIDDLEWARE = BASE_MIDDLEWARE + ('main.middleware.AccessSitemapOnlyBot',)
SITEMAP_NS = '{http://www.sitemaps.org/schemas/sitemap/0.9}'


@override_settings(SITE_URL='http://localhost:8000')
class AgentContentTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='aeo-author',
            email='aeo@example.com',
            password='password123',
        )
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR)
        now = timezone.now()

        cls.public_post = cls.create_post(
            title='Agent Ready Post',
            url='agent-ready-post',
            text_md='## Outcome\nAgents can parse this post.\n',
            published_date=now,
        )
        cls.public_series = Series.objects.create(
            owner=cls.author,
            name='Agent Ready Series',
            text_md='Series summary for agents.',
            url='agent-ready-series',
            hide=False,
        )
        cls.public_post.series = cls.public_series
        cls.public_post.save(update_fields=['series'])
        html_content = (
            '<h2>HTML Outcome</h2>'
            '<p>Agents <strong>parse</strong> links <a href="/source">source</a>.</p>'
        )
        cls.html_post = cls.create_post(
            title='HTML Agent Post',
            url='html-agent-post',
            text_md=html_content,
            text_html=html_content,
            published_date=now,
        )
        cls.html_post.series = cls.public_series
        cls.html_post.save(update_fields=['series'])
        cls.html_without_markdown_post = cls.create_post(
            title='New Editor Agent Post',
            url='new-editor-agent-post',
            text_md='',
            text_html=(
                '<h2>New Editor Outcome</h2>'
                '<p>Markdown source is empty, but HTML exists.</p>'
            ),
            published_date=now,
        )
        cls.rich_html_post = cls.create_post(
            title='Rich Editor Agent Post',
            url='rich-editor-agent-post',
            text_md='',
            text_html=(
                '<figure>'
                '<img src="/media/example.jpg" alt="Example">'
                '<figcaption>Example caption</figcaption>'
                '</figure>'
                '<table>'
                '<tr><th>Name</th><th>Value</th></tr>'
                '<tr><td>AEO</td><td>Agent readable</td></tr>'
                '</table>'
                '<pre><code class="language-python">print("hello")</code></pre>'
                '<hr>'
                '<figure>'
                '<video><source src="/media/demo.mp4" type="video/mp4"></video>'
                '<figcaption>Demo video</figcaption>'
                '</figure>'
                '<figure>'
                '<iframe src="https://example.com/embed"></iframe>'
                '<figcaption>Embedded reference</figcaption>'
                '</figure>'
            ),
            published_date=now,
        )
        cls.lossless_html_post = cls.create_post(
            title='Lossless Editor Agent Post',
            url='lossless-editor-agent-post',
            text_md='',
            text_html=(
                '<table>'
                '<tr><th colspan="2">Merged Header</th></tr>'
                '<tr><td>Left</td><td>Right</td></tr>'
                '</table>'
                '<div data-type="columns" data-layout="1:1">'
                '<div data-type="column"><p>Column left</p></div>'
                '<div data-type="column"><p>Column right</p></div>'
                '</div>'
                '<custom-card data-id="42"><p>Custom body</p></custom-card>'
                '<p>Inline <mark data-color="yellow">highlight</mark> '
                'and <span style="color:red">red text</span>.</p>'
            ),
            published_date=now,
        )
        cls.hidden_post = cls.create_post(
            title='Hidden Agent Post',
            url='hidden-agent-post',
            text_md='Hidden content',
            published_date=now,
            hide=True,
        )
        cls.draft_post = cls.create_post(
            title='Draft Agent Post',
            url='draft-agent-post',
            text_md='Draft content',
            published_date=None,
        )
        cls.future_post = cls.create_post(
            title='Future Agent Post',
            url='future-agent-post',
            text_md='Future content',
            published_date=now + timedelta(days=1),
        )
        cls.public_static_page = StaticPage.objects.create(
            slug='about-ai',
            title='About AI',
            content='<h2>About BLEX</h2><p>Static page content for agents.</p>',
            meta_description='About page for agents',
            is_published=True,
        )
        cls.unpublished_static_page = StaticPage.objects.create(
            slug='internal-ai',
            title='Internal AI Page',
            content='<p>Not public</p>',
            meta_description='Hidden page',
            is_published=False,
        )

    @classmethod
    def create_post(
        cls,
        *,
        title: str,
        url: str,
        text_md: str,
        published_date,
        hide: bool = False,
        text_html: str | None = None,
    ) -> Post:
        post = Post.objects.create(
            title=title,
            url=url,
            author=cls.author,
            meta_description=f'{title} description',
            published_date=published_date,
        )
        PostContent.objects.create(
            post=post,
            content_html=(
                text_html
                if text_html is not None
                else f'<h2>{title}</h2><p>{text_md}</p>'
            ),
        )
        PostConfig.objects.create(
            post=post,
            hide=hide,
            advertise=False,
        )
        return post

    def setUp(self):
        self.client = Client()
        setting = SiteSetting.get_instance()
        setting.seo_enabled = True
        setting.aeo_enabled = True
        setting.save(update_fields=['seo_enabled', 'aeo_enabled'])

    def parse_sitemap_locs(self, response, item_name):
        root = ElementTree.fromstring(response.content)
        return root, [
            loc.text
            for loc in root.findall(f'{SITEMAP_NS}{item_name}/{SITEMAP_NS}loc')
        ]

    @override_settings(MIDDLEWARE=AEO_MIDDLEWARE)
    def test_sitemap_allows_regular_user_agent(self):
        """일반 user-agent도 공개 sitemap을 조회할 수 있다."""
        response = self.client.get('/sitemap.xml', HTTP_USER_AGENT='Mozilla/5.0')

        self.assertEqual(response.status_code, 200)

    def test_sitemap_root_returns_standard_sitemap_index(self):
        """루트 sitemap은 하위 sitemap을 표준 sitemap index로 안내한다."""
        response = self.client.get('/sitemap.xml')

        self.assertEqual(response.status_code, 200)
        root, locs = self.parse_sitemap_locs(response, 'sitemap')

        self.assertEqual(root.tag, f'{SITEMAP_NS}sitemapindex')
        self.assertTrue(any(loc.endswith('/site/sitemap.xml') for loc in locs))
        self.assertTrue(any(loc.endswith('/user/sitemap.xml') for loc in locs))
        self.assertTrue(any(loc.endswith('/posts/sitemap.xml') for loc in locs))
        self.assertTrue(any(loc.endswith('/series/sitemap.xml') for loc in locs))
        self.assertTrue(any(loc.endswith('/staticpages/sitemap.xml') for loc in locs))
        self.assertFalse(any(loc.endswith('/@aeo-author/agent-ready-post') for loc in locs))

    @override_settings(SITE_URL='https://blex.example')
    def test_sitemaps_use_configured_site_url(self):
        """sitemap URL은 django_site 기본값 대신 공개 SITE_URL을 사용한다."""
        response = self.client.get('/sitemap.xml')

        self.assertEqual(response.status_code, 200)
        _, locs = self.parse_sitemap_locs(response, 'sitemap')
        self.assertTrue(all(loc.startswith('https://blex.example/') for loc in locs))

        response = self.client.get('/posts/sitemap.xml')

        self.assertEqual(response.status_code, 200)
        _, locs = self.parse_sitemap_locs(response, 'url')
        self.assertIn('https://blex.example/@aeo-author/agent-ready-post', locs)

    def test_site_sitemap_lists_top_level_pages_only(self):
        """site sitemap은 실제 공개 상위 페이지만 노출한다."""
        response = self.client.get('/site/sitemap.xml')

        self.assertEqual(response.status_code, 200)
        root, locs = self.parse_sitemap_locs(response, 'url')
        paths = {urlsplit(loc).path or '/' for loc in locs}

        self.assertEqual(root.tag, f'{SITEMAP_NS}urlset')
        self.assertIn('/', paths)
        self.assertIn('/tags', paths)
        for path in paths:
            with self.subTest(path=path):
                self.assertLess(self.client.get(path).status_code, 400)
        self.assertFalse(any(loc.endswith('/posts/sitemap.xml') for loc in locs))
        self.assertFalse(any(loc.endswith('/series/sitemap.xml') for loc in locs))

    @override_settings(MIDDLEWARE=AEO_MIDDLEWARE)
    def test_posts_sitemap_allows_agent_user_agent_without_bot_token(self):
        """bot 문자열이 없는 AI 에이전트 user-agent도 posts sitemap을 조회할 수 있다."""
        response = self.client.get('/posts/sitemap.xml', HTTP_USER_AGENT='curl/8.4.0')

        self.assertEqual(response.status_code, 200)

    def test_posts_sitemap_hides_non_public_posts(self):
        """posts sitemap은 숨김, 임시저장, 미래 발행 포스트를 노출하지 않는다."""
        response = self.client.get('/posts/sitemap.xml')

        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn('/@aeo-author/agent-ready-post', body)
        self.assertNotIn('/@aeo-author/hidden-agent-post', body)
        self.assertNotIn('/@aeo-author/draft-agent-post', body)
        self.assertNotIn('/@aeo-author/future-agent-post', body)

    def test_staticpages_sitemap_hides_unpublished_static_pages(self):
        """staticpages sitemap은 공개 정적 페이지만 노출한다."""
        response = self.client.get('/staticpages/sitemap.xml')

        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn('/static/about-ai', body)
        self.assertNotIn('/static/internal-ai', body)

    def test_series_sitemap_hides_series_without_public_posts(self):
        """series sitemap은 공개 글이 있는 공개 시리즈만 노출한다."""
        future_series = Series.objects.create(
            owner=self.author,
            name='Future Only Series',
            text_md='Future only',
            url='future-only-series',
            hide=False,
        )
        self.future_post.series = future_series
        self.future_post.save(update_fields=['series'])

        hidden_series = Series.objects.create(
            owner=self.author,
            name='Hidden Only Series',
            text_md='Hidden only',
            url='hidden-only-series',
            hide=False,
        )
        self.hidden_post.series = hidden_series
        self.hidden_post.save(update_fields=['series'])

        response = self.client.get('/series/sitemap.xml')

        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn('/@aeo-author/series/agent-ready-series', body)
        self.assertNotIn('/@aeo-author/series/future-only-series', body)
        self.assertNotIn('/@aeo-author/series/hidden-only-series', body)

    def test_rss_feeds_hide_non_public_posts(self):
        """RSS 피드는 숨김, 임시저장, 미래 발행 포스트를 노출하지 않는다."""
        urls = ['/rss', '/rss/@aeo-author']

        for url in urls:
            with self.subTest(url=url):
                response = self.client.get(url)

                self.assertEqual(response.status_code, 200)
                body = response.content.decode()
                self.assertIn('Agent Ready Post', body)
                self.assertNotIn('Hidden Agent Post', body)
                self.assertNotIn('Draft Agent Post', body)
                self.assertNotIn('Future Agent Post', body)

    def test_rss_feed_items_preload_author_and_content(self):
        """RSS item 렌더링에 필요한 author/content를 미리 로드한다."""
        site_item = SitePostsFeed().items()[0]
        user_item = UserPostsFeed().items(self.author)[0]

        self.assertIn('author', site_item._state.fields_cache)
        self.assertIn('content', site_item._state.fields_cache)
        self.assertIn('author', user_item._state.fields_cache)
        self.assertIn('content', user_item._state.fields_cache)

    def test_aeo_disabled_hides_agent_entrypoints(self):
        """AEO가 꺼져 있으면 llms.txt와 Markdown endpoint에 접근할 수 없다."""
        setting = SiteSetting.get_instance()
        setting.aeo_enabled = False
        setting.save(update_fields=['aeo_enabled'])

        urls = [
            '/llms.txt',
            '/@aeo-author/agent-ready-post.md',
            '/@aeo-author/series/agent-ready-series.md',
            '/static/about-ai.md',
        ]

        for url in urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 404)

    def test_robots_txt_hides_agent_entrypoint_when_aeo_disabled(self):
        """AEO가 꺼져 있으면 robots.txt에서도 AI 진입점을 광고하지 않는다."""
        setting = SiteSetting.get_instance()
        setting.aeo_enabled = False
        setting.save(update_fields=['aeo_enabled'])

        response = self.client.get('/robots.txt')

        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn('Disallow: /llms.txt', body)
        self.assertIn('Disallow: /*.md', body)
        self.assertIn('Disallow: /admin-settings/', body)
        self.assertNotIn('AI agent entry point', body)

    def test_robots_txt_omits_sitemap_when_seo_disabled(self):
        """SEO가 꺼져 있으면 sitemap 안내를 숨기고 noindex 런타임 신호를 설명한다."""
        setting = SiteSetting.get_instance()
        setting.seo_enabled = False
        setting.aeo_enabled = True
        setting.save(update_fields=['seo_enabled', 'aeo_enabled'])

        response = self.client.get('/robots.txt')

        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn('User-agent: *', body)
        self.assertIn('Search indexing is disabled at runtime.', body)
        self.assertIn('# AI agent entry point: http://localhost:8000/llms.txt', body)
        self.assertNotIn('Sitemap:', body)
        self.assertNotIn('Disallow: /\n', body)

    def test_robots_txt_appends_runtime_extra_rules(self):
        """robots.txt 추가 규칙은 런타임 설정에서 함께 생성된다."""
        setting = SiteSetting.get_instance()
        setting.robots_txt_extra_rules = 'User-agent: ExampleBot\nDisallow: /private/\n'
        setting.save(update_fields=['robots_txt_extra_rules'])

        response = self.client.get('/robots.txt')

        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn('# Custom rules', body)
        self.assertIn('User-agent: ExampleBot', body)
        self.assertIn('Disallow: /private/', body)

    def test_robots_txt_advertises_agent_entrypoint_when_aeo_enabled(self):
        """AEO가 켜져 있으면 robots.txt에 AI 진입점을 표시한다."""
        response = self.client.get('/robots.txt')

        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn('# AI agent entry point: http://localhost:8000/llms.txt', body)
        self.assertNotIn('Disallow: /llms.txt', body)
        self.assertIn('Sitemap: http://localhost:8000/sitemap.xml', body)

    @override_settings(SITE_URL='https://blex.example')
    def test_robots_txt_uses_configured_site_url(self):
        response = self.client.get('/robots.txt')

        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn('# AI agent entry point: https://blex.example/llms.txt', body)
        self.assertIn('Sitemap: https://blex.example/sitemap.xml', body)

    @override_settings(SITE_URL='https://blex.example')
    def test_markdown_endpoints_use_configured_site_url(self):
        response = self.client.get('/@aeo-author/agent-ready-post.md')

        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn('Source: https://blex.example/@aeo-author/agent-ready-post', body)

        response = self.client.get('/@aeo-author/series/agent-ready-series.md')
        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn('Source: https://blex.example/@aeo-author/series/agent-ready-series', body)
        self.assertIn(
            '- [Agent Ready Post](https://blex.example/@aeo-author/agent-ready-post.md)',
            body,
        )

        response = self.client.get('/static/about-ai.md')
        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn('Source: https://blex.example/static/about-ai', body)

    def test_llms_txt_returns_discovery_entrypoint(self):
        """/llms.txt는 공개 콘텐츠 discovery endpoint와 Markdown 규칙을 안내한다."""
        response = self.client.get('/llms.txt')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response['Content-Type'].startswith('text/plain'))

        body = response.content.decode()
        self.assertIn('# BLEX', body)
        self.assertIn('## Discovery', body)
        self.assertIn('[Sitemap index](http://localhost:8000/sitemap.xml)', body)
        self.assertIn('[Posts sitemap](http://localhost:8000/posts/sitemap.xml)', body)
        self.assertIn('[RSS feed](http://localhost:8000/rss)', body)
        self.assertIn('[Developer API OpenAPI schema](http://localhost:8000/api/developer/v1/openapi.json)', body)
        self.assertIn('## Markdown', body)
        self.assertIn('`http://localhost:8000/@{username}/{post_url}.md`', body)
        self.assertIn('`http://localhost:8000/@{username}/series/{series_url}.md`', body)
        self.assertIn('`http://localhost:8000/static/{slug}.md`', body)

    def test_llms_txt_uses_configured_site_name(self):
        setting = SiteSetting.get_instance()
        setting.site_name = 'Custom Blog'
        setting.save(update_fields=['site_name'])

        response = self.client.get('/llms.txt')

        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn('# Custom Blog', body)
        self.assertIn('> Custom Blog recent public posts.', body)

    @override_settings(SITE_URL='https://blex.example')
    def test_llms_txt_uses_configured_site_url(self):
        """/llms.txt는 configured SITE_URL origin으로 discovery URL을 만든다."""
        response = self.client.get('/llms.txt')

        self.assertEqual(response.status_code, 200)

        body = response.content.decode()
        self.assertIn('[Sitemap index](https://blex.example/sitemap.xml)', body)
        self.assertIn('[Posts sitemap](https://blex.example/posts/sitemap.xml)', body)
        self.assertIn('[RSS feed](https://blex.example/rss)', body)
        self.assertIn('[Developer API OpenAPI schema](https://blex.example/api/developer/v1/openapi.json)', body)
        self.assertIn('`https://blex.example/@{username}/{post_url}.md`', body)

    def test_llms_txt_does_not_enumerate_public_or_non_public_content(self):
        """llms.txt는 discovery 규칙만 제공하고 개별 콘텐츠를 열거하지 않는다."""
        response = self.client.get('/llms.txt')

        self.assertEqual(response.status_code, 200)

        body = response.content.decode()

        self.assertNotIn('Agent Ready Post', body)
        self.assertNotIn('/@aeo-author/agent-ready-post.md', body)
        self.assertNotIn('Hidden Agent Post', body)
        self.assertNotIn('/@aeo-author/hidden-agent-post.md', body)
        self.assertNotIn('Draft Agent Post', body)
        self.assertNotIn('/@aeo-author/draft-agent-post.md', body)
        self.assertNotIn('Future Agent Post', body)
        self.assertNotIn('/@aeo-author/future-agent-post.md', body)

    def test_post_markdown_endpoint_returns_clean_markdown(self):
        """공개 포스트는 Markdown endpoint로 AI용 본문을 제공한다."""
        response = self.client.get('/@aeo-author/agent-ready-post.md')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response['Content-Type'].startswith('text/markdown'))
        self.assertTrue(response['X-Estimated-Tokens'].isdigit())

        body = response.content.decode()
        self.assertIn('# Agent Ready Post', body)
        self.assertIn('Author: @aeo-author', body)
        self.assertIn('Source: http://localhost:8000/@aeo-author/agent-ready-post', body)
        self.assertIn('## Outcome\nAgents can parse this post.', body)

    def test_series_markdown_endpoint_returns_clean_markdown(self):
        """공개 시리즈는 Markdown endpoint로 시리즈 설명과 공개 포스트 링크를 제공한다."""
        response = self.client.get('/@aeo-author/series/agent-ready-series.md')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response['Content-Type'].startswith('text/markdown'))
        self.assertTrue(response['X-Estimated-Tokens'].isdigit())

        body = response.content.decode()
        self.assertIn('# Agent Ready Series', body)
        self.assertIn('Author: @aeo-author', body)
        self.assertIn('Source: http://localhost:8000/@aeo-author/series/agent-ready-series', body)
        self.assertIn('Series summary for agents.', body)
        self.assertIn(
            '- [Agent Ready Post](http://localhost:8000/@aeo-author/agent-ready-post.md)',
            body,
        )

    def test_static_page_markdown_endpoint_returns_clean_markdown(self):
        """공개 정적 페이지는 Markdown endpoint로 AI용 본문을 제공한다."""
        response = self.client.get('/static/about-ai.md')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response['Content-Type'].startswith('text/markdown'))
        self.assertTrue(response['X-Estimated-Tokens'].isdigit())

        body = response.content.decode()
        self.assertIn('# About AI', body)
        self.assertIn('Source: http://localhost:8000/static/about-ai', body)
        self.assertIn('## About BLEX', body)
        self.assertIn('Static page content for agents.', body)

    def test_static_page_markdown_endpoint_hides_unpublished_page(self):
        """비공개 정적 페이지는 Markdown endpoint로 노출하지 않는다."""
        response = self.client.get('/static/internal-ai.md')

        self.assertEqual(response.status_code, 404)

    def test_post_markdown_endpoint_converts_html_content(self):
        """HTML 기반 포스트도 태그 잡음 없이 Markdown fallback을 제공한다."""
        response = self.client.get('/@aeo-author/html-agent-post.md')

        self.assertEqual(response.status_code, 200)

        body = response.content.decode()
        self.assertIn('## HTML Outcome', body)
        self.assertIn('Agents **parse** links [source](/source).', body)
        self.assertNotIn('<h2>', body)

    def test_post_markdown_endpoint_converts_html_when_text_md_is_empty(self):
        """신규 작가처럼 Markdown 원본이 없어도 HTML에서 AI용 Markdown을 만든다."""
        response = self.client.get('/@aeo-author/new-editor-agent-post.md')

        self.assertEqual(response.status_code, 200)

        body = response.content.decode()
        self.assertIn('## New Editor Outcome', body)
        self.assertIn('Markdown source is empty, but HTML exists.', body)
        self.assertNotIn('<p>', body)

    def test_post_markdown_endpoint_exports_rich_editor_html_losslessly(self):
        """신규 작가의 rich HTML은 안전한 변환과 원본 HTML 보존을 함께 사용한다."""
        response = self.client.get('/@aeo-author/rich-editor-agent-post.md')

        self.assertEqual(response.status_code, 200)

        body = response.content.decode()
        self.assertIn('<figure>', body)
        self.assertIn('<img', body)
        self.assertIn('src="/media/example.jpg"', body)
        self.assertIn('alt="Example"', body)
        self.assertIn('<figcaption>Example caption</figcaption>', body)
        self.assertIn('| Name | Value |', body)
        self.assertIn('| AEO | Agent readable |', body)
        self.assertIn('```python\nprint("hello")\n```', body)
        self.assertIn('<video>', body)
        self.assertIn('src="/media/demo.mp4"', body)
        self.assertIn('<iframe src="https://example.com/embed"></iframe>', body)
        self.assertNotIn('<table>', body)

    def test_post_markdown_endpoint_preserves_lossy_html_as_raw_html(self):
        """Markdown으로 표현하면 손실되는 HTML은 원문 HTML 조각으로 보존한다."""
        response = self.client.get('/@aeo-author/lossless-editor-agent-post.md')

        self.assertEqual(response.status_code, 200)

        body = response.content.decode()
        self.assertIn('colspan="2"', body)
        self.assertIn('<th colspan="2">Merged Header</th>', body)
        self.assertIn('data-type="columns"', body)
        self.assertIn('data-layout="1:1"', body)
        self.assertIn('Column left', body)
        self.assertIn('Column right', body)
        self.assertIn('<custom-card data-id="42">', body)
        self.assertIn('<mark data-color="yellow">highlight</mark>', body)
        self.assertIn('<span style="color:red">red text</span>', body)

    def test_post_markdown_endpoint_hides_non_public_posts(self):
        """숨김, 임시저장, 미래 발행 포스트는 Markdown endpoint로 노출하지 않는다."""
        urls = [
            '/@aeo-author/hidden-agent-post.md',
            '/@aeo-author/draft-agent-post.md',
            '/@aeo-author/future-agent-post.md',
        ]

        for url in urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 404)
