from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from board.models import Post, PostConfig, PostContent, Series
from board.services.public_series_service import PublicSeriesService


class PublicSeriesServiceTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='public-series-author',
            email='public-series@example.com',
            password='password123',
        )
        now = timezone.now()

        cls.public_series = Series.objects.create(
            owner=cls.author,
            name='Public Series',
            url='public-series',
            hide=False,
        )
        cls.create_post(cls.public_series, 'Public Post', 'public-post', now)

        cls.hidden_series = Series.objects.create(
            owner=cls.author,
            name='Hidden Series',
            url='hidden-series',
            hide=True,
        )
        cls.create_post(cls.hidden_series, 'Hidden Series Public Post', 'hidden-series-public-post', now)

        cls.draft_only_series = Series.objects.create(
            owner=cls.author,
            name='Draft Only Series',
            url='draft-only-series',
            hide=False,
        )
        cls.create_post(cls.draft_only_series, 'Draft Post', 'draft-post', None)

        cls.future_only_series = Series.objects.create(
            owner=cls.author,
            name='Future Only Series',
            url='future-only-series',
            hide=False,
        )
        cls.create_post(cls.future_only_series, 'Future Post', 'future-post', now + timedelta(days=1))

        cls.hidden_post_only_series = Series.objects.create(
            owner=cls.author,
            name='Hidden Post Only Series',
            url='hidden-post-only-series',
            hide=False,
        )
        cls.create_post(cls.hidden_post_only_series, 'Hidden Post', 'hidden-post', now, hide=True)

    @classmethod
    def create_post(cls, series, title, url, published_date, hide=False):
        post = Post.objects.create(
            title=title,
            url=url,
            author=cls.author,
            series=series,
            published_date=published_date,
        )
        PostContent.objects.create(post=post, content_html='')
        PostConfig.objects.create(post=post, hide=hide)
        return post

    def test_filter_public_series_excludes_hidden_and_series_without_public_posts(self):
        series = PublicSeriesService.filter_public_series(Series.objects).order_by('url')

        self.assertEqual(list(series), [self.public_series])

    def test_filter_public_series_supports_custom_count_field(self):
        series = PublicSeriesService.filter_public_series(
            Series.objects,
            count_field='total_posts',
        ).get()

        self.assertEqual(series, self.public_series)
        self.assertEqual(series.total_posts, 1)

    def test_is_public_matches_public_series_rules(self):
        self.assertTrue(PublicSeriesService.is_public(self.public_series))
        self.assertFalse(PublicSeriesService.is_public(self.hidden_series))
        self.assertFalse(PublicSeriesService.is_public(self.draft_only_series))
        self.assertFalse(PublicSeriesService.is_public(self.future_only_series))
        self.assertFalse(PublicSeriesService.is_public(self.hidden_post_only_series))
