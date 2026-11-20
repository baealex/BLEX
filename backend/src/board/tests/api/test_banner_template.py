import json

from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from board.models import (
    Post,
    PostConfig,
    PostContent,
    Profile,
    SiteBanner,
    SiteContentScope,
    User,
)
from board.services.banner_service import BannerService


class BannerTemplateAPITestCase(TestCase):
    """Template banners store text fields and are rendered by the server."""

    @classmethod
    def setUpTestData(cls):
        cls.editor = User.objects.create_user(
            username='editor',
            password='test',
            email='editor@test.com',
        )
        Profile.objects.create(user=cls.editor, role=Profile.Role.EDITOR)

        cls.staff = User.objects.create_user(
            username='staff',
            password='test',
            email='staff@test.com',
            is_staff=True,
        )
        Profile.objects.create(user=cls.staff)

        cls.reader = User.objects.create_user(
            username='reader',
            password='test',
            email='reader@test.com',
        )
        Profile.objects.create(user=cls.reader)

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        self.client.login(username='editor', password='test')

    def post_json(
        self,
        url: str,
        payload: dict,
        client: Client | None = None,
        language: str = 'en',
    ) -> dict:
        response = (client or self.client).post(
            url,
            json.dumps(payload),
            content_type='application/json',
            HTTP_ACCEPT_LANGUAGE=language,
        )
        self.assertEqual(response.status_code, 200)
        return response.json()

    def put_json(self, url: str, payload: dict) -> dict:
        response = self.client.put(url, json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        return response.json()

    def card_payload(self, **overrides) -> dict:
        payload = {
            'title': 'Newsletter',
            'template': 'card',
            'headline': '  Subscribe to the newsletter  ',
            'description': 'One email every week.',
            'link_label': 'Subscribe',
            'link_url': 'https://example.com/subscribe',
            'tone': 'emphasis',
            'banner_type': 'horizontal',
            'position': 'bottom',
        }
        payload.update(overrides)
        return payload

    def test_create_template_banner_stores_trimmed_text_fields(self):
        content = self.post_json('/v1/banners', self.card_payload())

        self.assertEqual(content['status'], 'DONE')
        body = content['body']
        self.assertEqual(body['template'], 'card')
        self.assertEqual(body['headline'], 'Subscribe to the newsletter')
        self.assertEqual(body['linkUrl'], 'https://example.com/subscribe')
        self.assertEqual(body['tone'], 'emphasis')
        self.assertEqual(body['contentHtml'], '')

        banner = SiteBanner.objects.get(id=body['id'])
        self.assertEqual(banner.scope, SiteContentScope.USER)
        self.assertEqual(banner.user, self.editor)

    def test_banner_list_includes_template_fields(self):
        self.post_json('/v1/banners', self.card_payload())

        response = self.client.get('/v1/banners')

        banner = response.json()['body']['banners'][0]
        self.assertEqual(banner['template'], 'card')
        self.assertEqual(banner['headline'], 'Subscribe to the newsletter')
        self.assertEqual(banner['linkLabel'], 'Subscribe')

    def test_template_banner_requires_text_but_not_html(self):
        content = self.post_json('/v1/banners', self.card_payload(headline='   '))

        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')
        self.assertFalse(SiteBanner.objects.exists())

    def test_template_rejects_incompatible_position(self):
        cases = (
            self.card_payload(template='intro', banner_type='horizontal', position='top'),
            self.card_payload(template='notice', banner_type='sidebar', position='left'),
        )

        for payload in cases:
            with self.subTest(template=payload['template']):
                content = self.post_json('/v1/banners', payload)
                self.assertEqual(content['status'], 'ERROR')
                self.assertEqual(content['errorCode'], 'error:VA')

        self.assertFalse(SiteBanner.objects.exists())

    def test_template_rejects_unknown_template_and_tone(self):
        for overrides in ({'template': 'poster'}, {'tone': 'neon'}):
            with self.subTest(overrides=overrides):
                content = self.post_json('/v1/banners', self.card_payload(**overrides))
                self.assertEqual(content['status'], 'ERROR')
                self.assertEqual(content['errorCode'], 'error:VA')

    def test_template_rejects_unsafe_and_too_long_values(self):
        cases = (
            {'link_url': 'javascript:alert(1)'},
            {'headline': 'a' * 121},
            {'description': 'a' * 301},
            {'link_label': 'a' * 41},
        )

        for overrides in cases:
            with self.subTest(field=next(iter(overrides))):
                content = self.post_json('/v1/banners', self.card_payload(**overrides))
                self.assertEqual(content['status'], 'ERROR')
                self.assertEqual(content['errorCode'], 'error:VA')

        self.assertFalse(SiteBanner.objects.exists())

    def test_update_validates_template_against_final_position(self):
        banner_id = self.post_json('/v1/banners', self.card_payload())['body']['id']

        moved = self.put_json(f'/v1/banners/{banner_id}', {
            'banner_type': 'sidebar',
            'position': 'right',
        })
        self.assertEqual(moved['status'], 'ERROR')

        switched = self.put_json(f'/v1/banners/{banner_id}', {
            'template': 'intro',
            'banner_type': 'sidebar',
            'position': 'right',
            'headline': 'About me',
        })
        self.assertEqual(switched['status'], 'DONE')

        banner = SiteBanner.objects.get(id=banner_id)
        self.assertEqual(banner.template, 'intro')
        self.assertEqual(banner.position, 'right')
        self.assertEqual(banner.headline, 'About me')
        self.assertEqual(banner.link_label, 'Subscribe')

    def test_legacy_html_banner_can_still_be_created_without_template(self):
        content = self.post_json('/v1/banners', {
            'title': 'Legacy',
            'content_html': '<div>Legacy</div>',
            'banner_type': 'horizontal',
            'position': 'top',
        })

        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['template'], 'html')

    def test_preview_renders_template_with_escaped_text(self):
        content = self.post_json('/v1/banners/preview', self.card_payload(
            headline='<script>alert(1)</script> Hello',
            link_label='',
        ))

        self.assertEqual(content['status'], 'DONE')
        html = content['body']['html']
        self.assertIn('&lt;script&gt;alert(1)&lt;/script&gt; Hello', html)
        self.assertNotIn('<script>', html)
        self.assertIn('href="https://example.com/subscribe"', html)
        self.assertFalse(SiteBanner.objects.exists())

    def test_preview_default_link_label_follows_request_language(self):
        expected_labels = {
            'en': 'Learn more',
            'ko': '자세히 보기',
        }

        for language, expected_label in expected_labels.items():
            with self.subTest(language=language):
                content = self.post_json(
                    '/v1/banners/preview',
                    self.card_payload(link_label=''),
                    language=language,
                )
                self.assertIn(expected_label, content['body']['html'])

    def test_preview_omits_button_without_link(self):
        content = self.post_json('/v1/banners/preview', self.card_payload(link_url=''))

        self.assertEqual(content['status'], 'DONE')
        self.assertNotIn('<a ', content['body']['html'])

    def test_user_html_preview_matches_sanitized_output(self):
        content = self.post_json('/v1/banners/preview', {
            'template': 'html',
            'content_html': (
                '<a href="https://example.com" class="btn" style="color:red">Go</a>'
                '<img src="https://example.com/a.png" onerror="alert(1)">'
                '<script>alert(2)</script>'
            ),
            'banner_type': 'horizontal',
            'position': 'top',
        })

        self.assertEqual(content['status'], 'DONE')
        html = content['body']['html']
        self.assertIn('<a href="https://example.com">Go</a>', html)
        self.assertNotIn('onerror', html)
        self.assertNotIn('<script>', html)

    def test_global_html_preview_keeps_scripts(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='staff', password='test')

        content = self.post_json('/v1/global-banners/preview', {
            'template': 'html',
            'content_html': '<div>Ad</div><script>loadAd()</script>',
            'banner_type': 'horizontal',
            'position': 'top',
        }, client=client)

        self.assertEqual(content['status'], 'DONE')
        self.assertIn('<script>loadAd()</script>', content['body']['html'])

    def test_preview_requires_permissions(self):
        reader = Client(HTTP_USER_AGENT='Mozilla/5.0')
        reader.login(username='reader', password='test')

        user_preview = self.post_json('/v1/banners/preview', self.card_payload(), client=reader)
        global_preview = self.post_json('/v1/global-banners/preview', self.card_payload())

        self.assertEqual(user_preview['errorCode'], 'error:RJ')
        self.assertEqual(global_preview['status'], 'ERROR')

    def test_preview_rejects_non_post_methods(self):
        response = self.client.get('/v1/banners/preview')

        self.assertEqual(response.status_code, 404)

    def test_preview_returns_validation_error_for_incompatible_template(self):
        content = self.post_json('/v1/banners/preview', self.card_payload(
            template='intro',
        ))

        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')


class BannerTemplateRenderTestCase(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username='author', password='test')
        Profile.objects.create(user=self.author)

    def create_banner(self, **kwargs) -> SiteBanner:
        defaults = dict(
            scope=SiteContentScope.USER,
            user=self.author,
            title='Banner',
            banner_type='horizontal',
            position='top',
        )
        defaults.update(kwargs)
        return SiteBanner.objects.create(**defaults)

    def test_author_banners_are_rendered_with_shared_renderer(self):
        self.create_banner(
            template='notice',
            headline='New series is out',
            link_url='/@author/series',
        )
        self.create_banner(
            content_html='<div class="x">Legacy</div><script>alert(1)</script>',
            position='bottom',
        )

        banners = BannerService.get_all_banners_for_author(self.author)

        top_html = banners['top'][0].rendered_html
        bottom_html = banners['bottom'][0].rendered_html
        self.assertIn('New series is out', top_html)
        self.assertIn('href="/@author/series"', top_html)
        self.assertIn('<div class="x">Legacy</div>', bottom_html)
        self.assertNotIn('<script>', bottom_html)

    def test_stored_unsafe_link_is_not_rendered(self):
        banner = self.create_banner(
            template='notice',
            headline='Hello',
            link_url='javascript:alert(1)',
        )

        html = BannerService.render_banner_html(banner)

        self.assertIn('Hello', html)
        self.assertNotIn('javascript:', html)
        self.assertNotIn('<a ', html)

    def test_post_detail_shows_template_banner(self):
        post = Post.objects.create(
            title='Post',
            url='post',
            author=self.author,
            created_date=timezone.now(),
            published_date=timezone.now(),
        )
        PostContent.objects.create(post=post, content_html='<p>Body</p>')
        PostConfig.objects.create(post=post, hide=False)
        self.create_banner(
            template='intro',
            banner_type='sidebar',
            position='right',
            headline='Hi, I write about Django',
            description='Weekly notes.',
            link_label='About me',
            link_url='/@author',
        )

        response = self.client.get(reverse('post_detail', kwargs={
            'username': 'author',
            'post_url': 'post',
        }))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Hi, I write about Django')
        self.assertContains(response, 'About me')
