import json
import re

from django.contrib.auth.models import User
from django.test import Client, TestCase
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
                text_md='body',
                text_html=content,
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
            )

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
