from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from board.models import Post, PostConfig, PostContent


BASE_MIDDLEWARE = tuple(
    middleware
    for middleware in settings.MIDDLEWARE
    if middleware != 'main.middleware.AccessSitemapOnlyBot'
)
AEO_MIDDLEWARE = BASE_MIDDLEWARE + ('main.middleware.AccessSitemapOnlyBot',)


class AgentContentTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='aeo-author',
            email='aeo@example.com',
            password='password123',
        )
        now = timezone.now()

        cls.public_post = cls.create_post(
            title='Agent Ready Post',
            url='agent-ready-post',
            text_md='## Outcome\nAgents can parse this post.\n',
            published_date=now,
        )
        html_content = (
            '<h2>HTML Outcome</h2>'
            '<p>Agents <strong>parse</strong> links <a href="/source">source</a>.</p>'
        )
        cls.html_post = cls.create_post(
            title='HTML Agent Post',
            url='html-agent-post',
            text_md=html_content,
            text_html=html_content,
            content_type=PostContent.ContentType.HTML,
            published_date=now,
        )
        cls.html_without_markdown_post = cls.create_post(
            title='New Editor Agent Post',
            url='new-editor-agent-post',
            text_md='',
            text_html=(
                '<h2>New Editor Outcome</h2>'
                '<p>Markdown source is empty, but HTML exists.</p>'
            ),
            content_type=PostContent.ContentType.HTML,
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
            content_type=PostContent.ContentType.HTML,
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
            content_type=PostContent.ContentType.HTML,
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
        content_type: str = PostContent.ContentType.MARKDOWN,
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
            content_type=content_type,
            text_md=text_md,
            text_html=(
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

    @override_settings(MIDDLEWARE=AEO_MIDDLEWARE)
    def test_sitemap_allows_regular_user_agent(self):
        """일반 user-agent도 공개 sitemap을 조회할 수 있다."""
        response = self.client.get('/sitemap.xml', HTTP_USER_AGENT='Mozilla/5.0')

        self.assertEqual(response.status_code, 200)

    @override_settings(MIDDLEWARE=AEO_MIDDLEWARE)
    def test_posts_sitemap_allows_agent_user_agent_without_bot_token(self):
        """bot 문자열이 없는 AI 에이전트 user-agent도 posts sitemap을 조회할 수 있다."""
        response = self.client.get('/posts/sitemap.xml', HTTP_USER_AGENT='curl/8.4.0')

        self.assertEqual(response.status_code, 200)

    def test_llms_txt_returns_agent_entrypoint(self):
        """/llms.txt는 에이전트용 사이트 진입점을 제공한다."""
        response = self.client.get('/llms.txt')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response['Content-Type'].startswith('text/plain'))

        body = response.content.decode()
        self.assertIn('BLEX', body)
        self.assertIn('/sitemap.xml', body)
        self.assertIn('/posts/sitemap.xml', body)
        self.assertIn('/rss', body)
        self.assertIn('/@aeo-author/agent-ready-post.md', body)

    def test_post_markdown_endpoint_returns_clean_markdown(self):
        """공개 포스트는 Markdown endpoint로 AI용 본문을 제공한다."""
        response = self.client.get('/@aeo-author/agent-ready-post.md')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response['Content-Type'].startswith('text/markdown'))
        self.assertTrue(response['X-Estimated-Tokens'].isdigit())

        body = response.content.decode()
        self.assertIn('# Agent Ready Post', body)
        self.assertIn('Author: @aeo-author', body)
        self.assertIn('Source: http://testserver/@aeo-author/agent-ready-post', body)
        self.assertIn('## Outcome\nAgents can parse this post.', body)

    def test_post_markdown_endpoint_converts_html_content(self):
        """HTML 기반 포스트도 태그 잡음 없이 Markdown fallback을 제공한다."""
        response = self.client.get('/@aeo-author/html-agent-post.md')

        self.assertEqual(response.status_code, 200)

        body = response.content.decode()
        self.assertIn('## HTML Outcome', body)
        self.assertIn('Agents **parse** links [source](/source).', body)
        self.assertNotIn('<h2>', body)

    def test_post_markdown_endpoint_converts_html_when_text_md_is_empty(self):
        """신규 에디터처럼 Markdown 원본이 없어도 HTML에서 AI용 Markdown을 만든다."""
        response = self.client.get('/@aeo-author/new-editor-agent-post.md')

        self.assertEqual(response.status_code, 200)

        body = response.content.decode()
        self.assertIn('## New Editor Outcome', body)
        self.assertIn('Markdown source is empty, but HTML exists.', body)
        self.assertNotIn('<p>', body)

    def test_post_markdown_endpoint_exports_rich_editor_html_losslessly(self):
        """신규 에디터의 rich HTML은 안전한 변환과 원본 HTML 보존을 함께 사용한다."""
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
