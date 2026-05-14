import json
import re

from django.contrib.auth.models import User
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostConfig, PostContent, Series, StaticPage


class StructuredDataAssertionMixin:
    def extract_structured_data(self, response):
        content = response.content.decode()
        match = re.search(
            r'<script type="?application/ld\+json"?>\s*(\{.*?\})\s*</script>',
            content,
            re.DOTALL,
        )
        self.assertIsNotNone(match)
        return json.loads(match.group(1))


class SeriesSeoMetadataTestCase(StructuredDataAssertionMixin, TestCase):
    def setUp(self):
        self.client = Client()
        self.author = User.objects.create_user(
            username='seriesauthor',
            email='series@example.com',
            password='password123',
        )
        self.series = Series.objects.create(
            owner=self.author,
            name='Structured Series',
            text_html='<p>Series description for metadata and structured data.</p>',
            url='structured-series',
            hide=False,
        )
        self.first_post = Post.objects.create(
            title='First Post',
            url='first-post',
            author=self.author,
            series=self.series,
            meta_description='First post description',
            created_date=timezone.now(),
            published_date=timezone.now(),
        )
        self.second_post = Post.objects.create(
            title='Second Post',
            url='second-post',
            author=self.author,
            series=self.series,
            meta_description='Second post description',
            created_date=timezone.now(),
            published_date=timezone.now(),
        )
        for post, content in [
            (self.first_post, '<p>First post body</p>'),
            (self.second_post, '<p>Second post body</p>'),
        ]:
            PostContent.objects.create(
                post=post,
                content_html=content,
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
            )


    def test_series_detail_returns_404_for_hidden_series(self):
        self.series.hide = True
        self.series.save()

        response = self.client.get(
            reverse(
                'series_detail',
                kwargs={
                    'username': 'seriesauthor',
                    'series_url': 'structured-series',
                },
            )
        )

        self.assertEqual(response.status_code, 404)

    def test_series_detail_returns_404_for_empty_series(self):
        empty_series = Series.objects.create(
            owner=self.author,
            name='Empty Series',
            url='empty-series',
            hide=False,
        )

        response = self.client.get(
            reverse(
                'series_detail',
                kwargs={
                    'username': 'seriesauthor',
                    'series_url': empty_series.url,
                },
            )
        )

        self.assertEqual(response.status_code, 404)

    def test_series_detail_returns_404_for_hidden_post_only_series(self):
        hidden_series = Series.objects.create(
            owner=self.author,
            name='Hidden Post Only Series',
            url='hidden-post-only-series',
            hide=False,
        )
        hidden_post = Post.objects.create(
            title='Hidden Post',
            url='hidden-series-post',
            author=self.author,
            series=hidden_series,
            published_date=timezone.now(),
        )
        PostContent.objects.create(post=hidden_post, content_html='<p>Hidden</p>')
        PostConfig.objects.create(post=hidden_post, hide=True)

        response = self.client.get(
            reverse(
                'series_detail',
                kwargs={
                    'username': 'seriesauthor',
                    'series_url': hidden_series.url,
                },
            )
        )

        self.assertEqual(response.status_code, 404)

    def test_series_detail_returns_404_for_draft_only_series(self):
        draft_series = Series.objects.create(
            owner=self.author,
            name='Draft Only Series',
            url='draft-only-series',
            hide=False,
        )
        draft_post = Post.objects.create(
            title='Draft Post',
            url='draft-series-post',
            author=self.author,
            series=draft_series,
            published_date=None,
        )
        PostContent.objects.create(post=draft_post, content_html='<p>Draft</p>')
        PostConfig.objects.create(post=draft_post, hide=False)

        response = self.client.get(
            reverse(
                'series_detail',
                kwargs={
                    'username': 'seriesauthor',
                    'series_url': draft_series.url,
                },
            )
        )

        self.assertEqual(response.status_code, 404)

    def test_series_detail_returns_404_for_scheduled_only_series(self):
        scheduled_series = Series.objects.create(
            owner=self.author,
            name='Scheduled Only Series',
            url='scheduled-only-series',
            hide=False,
        )
        scheduled_post = Post.objects.create(
            title='Scheduled Post',
            url='scheduled-series-post',
            author=self.author,
            series=scheduled_series,
            published_date=timezone.now() + timezone.timedelta(days=1),
        )
        PostContent.objects.create(post=scheduled_post, content_html='<p>Scheduled</p>')
        PostConfig.objects.create(post=scheduled_post, hide=False)

        response = self.client.get(
            reverse(
                'series_detail',
                kwargs={
                    'username': 'seriesauthor',
                    'series_url': scheduled_series.url,
                },
            )
        )

        self.assertEqual(response.status_code, 404)

    @override_settings(SITE_URL='')
    def test_series_detail_renders_canonical_meta_and_collection_json_ld(self):
        response = self.client.get(
            reverse(
                'series_detail',
                kwargs={
                    'username': 'seriesauthor',
                    'series_url': 'structured-series',
                },
            )
        )

        self.assertEqual(response.status_code, 200)

        canonical_url = 'http://testserver/@seriesauthor/series/structured-series'
        meta_description = 'Series description for metadata and structured data.'
        seo_title = 'Structured Series - seriesauthor | BLEX'

        self.assertContains(
            response,
            f'<meta name="description" content="{meta_description}">',
            html=True,
        )
        self.assertContains(
            response,
            f'<meta property="og:url" content="{canonical_url}">',
            html=True,
        )
        self.assertContains(
            response,
            f'<meta property="og:title" content="{seo_title}">',
            html=True,
        )
        self.assertContains(
            response,
            f'<meta property="twitter:description" content="{meta_description}">',
            html=True,
        )
        self.assertContains(
            response,
            f'<link rel="canonical" href="{canonical_url}">',
            html=True,
        )

        structured_data = self.extract_structured_data(response)

        self.assertEqual(structured_data['@type'], 'CollectionPage')
        self.assertEqual(structured_data['url'], canonical_url)
        self.assertEqual(structured_data['description'], meta_description)
        self.assertEqual(structured_data['author']['name'], 'seriesauthor')
        self.assertEqual(structured_data['mainEntity']['@type'], 'ItemList')
        self.assertEqual(structured_data['mainEntity']['numberOfItems'], 2)
        item_urls = [
            element['item']['url']
            for element in structured_data['mainEntity']['itemListElement']
        ]
        self.assertCountEqual(
            item_urls,
            [
                'http://testserver/@seriesauthor/first-post',
                'http://testserver/@seriesauthor/second-post',
            ],
        )


    @override_settings(SITE_URL='https://blex.example')
    def test_series_detail_uses_configured_site_url_for_canonical_metadata(self):
        response = self.client.get(
            reverse(
                'series_detail',
                kwargs={
                    'username': 'seriesauthor',
                    'series_url': 'structured-series',
                },
            ),
            {'sort': 'asc'},
        )

        self.assertEqual(response.status_code, 200)

        canonical_url = 'https://blex.example/@seriesauthor/series/structured-series?sort=asc'
        self.assertContains(
            response,
            f'<link rel="canonical" href="{canonical_url}">',
            html=True,
        )

        structured_data = self.extract_structured_data(response)
        self.assertEqual(structured_data['url'], canonical_url)
        self.assertEqual(structured_data['isPartOf']['url'], 'https://blex.example/')
        self.assertTrue(
            all(
                element['item']['url'].startswith('https://blex.example/')
                for element in structured_data['mainEntity']['itemListElement']
            )
        )

    @override_settings(SITE_URL='')
    def test_series_detail_canonical_normalizes_default_query_parameters(self):
        response = self.client.get(
            reverse(
                'series_detail',
                kwargs={
                    'username': 'seriesauthor',
                    'series_url': 'structured-series',
                },
            ),
            {
                'sort': 'desc',
                'page': 1,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            '<link rel="canonical" href="http://testserver/@seriesauthor/series/structured-series">',
            html=True,
        )


class StaticPageSeoMetadataTestCase(StructuredDataAssertionMixin, TestCase):
    def setUp(self):
        self.client = Client()
        self.author = User.objects.create_user(
            username='pageauthor',
            email='page@example.com',
            password='password123',
        )
        self.page = StaticPage.objects.create(
            slug='seo-page',
            title='SEO Page',
            content='<h2>Overview</h2><p>Static page content for metadata and structured data.</p>',
            meta_description='Static page description',
            is_published=True,
            author=self.author,
        )

    @override_settings(SITE_URL='')
    def test_static_page_renders_canonical_meta_and_webpage_json_ld(self):
        response = self.client.get(
            reverse('static_page', kwargs={'slug': 'seo-page'})
        )

        self.assertEqual(response.status_code, 200)

        canonical_url = 'http://testserver/static/seo-page'
        meta_description = 'Static page description'
        seo_title = 'SEO Page - BLEX'

        self.assertContains(
            response,
            f'<meta name="description" content="{meta_description}">',
            html=True,
        )
        self.assertContains(
            response,
            f'<meta property="og:title" content="{seo_title}">',
            html=True,
        )
        self.assertContains(
            response,
            f'<meta property="twitter:url" content="{canonical_url}">',
            html=True,
        )
        self.assertContains(
            response,
            f'<link rel="canonical" href="{canonical_url}">',
            html=True,
        )

        structured_data = self.extract_structured_data(response)

        self.assertEqual(structured_data['@type'], 'WebPage')
        self.assertEqual(structured_data['url'], canonical_url)
        self.assertEqual(structured_data['description'], meta_description)
        self.assertEqual(structured_data['author']['name'], 'pageauthor')


    @override_settings(SITE_URL='https://blex.example/')
    def test_static_page_uses_configured_site_url_for_canonical_metadata(self):
        response = self.client.get(
            reverse('static_page', kwargs={'slug': 'seo-page'})
        )

        self.assertEqual(response.status_code, 200)

        canonical_url = 'https://blex.example/static/seo-page'
        self.assertContains(
            response,
            f'<link rel="canonical" href="{canonical_url}">',
            html=True,
        )

        structured_data = self.extract_structured_data(response)
        self.assertEqual(structured_data['url'], canonical_url)
        self.assertEqual(structured_data['isPartOf']['url'], 'https://blex.example/')
        self.assertEqual(structured_data['author']['url'], 'https://blex.example/@pageauthor')

    @override_settings(SITE_URL='')
    def test_static_page_uses_content_fallback_for_meta_description(self):
        self.page.meta_description = ''
        self.page.save(update_fields=['meta_description'])

        response = self.client.get(
            reverse('static_page', kwargs={'slug': 'seo-page'})
        )

        self.assertEqual(response.status_code, 200)

        fallback_description = 'Overview Static page content for metadata and structured data.'

        self.assertContains(
            response,
            f'<meta name="description" content="{fallback_description}">',
            html=True,
        )

        structured_data = self.extract_structured_data(response)
        self.assertEqual(structured_data['description'], fallback_description)
