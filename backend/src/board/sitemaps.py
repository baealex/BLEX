from django.contrib.sitemaps import Sitemap
from django.db.models import Count, Max
from django.urls import reverse

from board.models import Post, Series, Profile, StaticPage
from board.services.public_post_service import PublicPostService
from board.services.public_series_service import PublicSeriesService


class SiteSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 1.0

    def items(self):
        return [
            '',
            '/tags',
        ]

    def location(self, item):
        return str(item)

    def get_index_metadata(self):
        return len(self.items()), None


class UserSitemap(Sitemap):
    changefreq = 'monthly'
    priority = 0.6

    def items(self):
        # Only include users who have public posts and can publish content.
        users = PublicPostService.filter_public_posts(Post.objects).filter(
            author__profile__role=Profile.Role.EDITOR,
        ).values_list('author__username', flat=True).distinct().order_by('author__username')
        return users

    def location(self, item):
        return reverse('user_profile', args=[item])

    def get_index_metadata(self):
        item_count = PublicPostService.filter_public_posts(Post.objects).filter(
            author__profile__role=Profile.Role.EDITOR,
        ).aggregate(
            item_count=Count('author__username', distinct=True),
        )['item_count']
        return item_count, None


class PostsSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.9

    def items(self):
        return PublicPostService.filter_public_posts(Post.objects).select_related(
            'author'
        ).order_by('-updated_date')

    def location(self, element):
        return reverse('post_detail', args=[element.author.username, element.url])

    def lastmod(self, element):
        return element.updated_date

    def get_index_metadata(self):
        metadata = PublicPostService.filter_public_posts(Post.objects).aggregate(
            item_count=Count('pk'),
            latest_lastmod=Max('updated_date'),
        )
        return metadata['item_count'], metadata['latest_lastmod']


class SeriesSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.7

    def items(self):
        return PublicSeriesService.filter_public_series(
            Series.objects.select_related('owner')
        ).order_by('-updated_date')

    def location(self, element):
        return reverse('series_detail', args=[element.owner.username, element.url])

    def lastmod(self, element):
        return element.updated_date

    def get_index_metadata(self):
        metadata = PublicSeriesService.filter_public_series(
            Series.objects,
        ).order_by().aggregate(
            item_count=Count('pk'),
            latest_lastmod=Max('updated_date'),
        )
        return metadata['item_count'], metadata['latest_lastmod']


class StaticPageSitemap(Sitemap):
    changefreq = 'monthly'
    priority = 0.8

    def items(self):
        return StaticPage.objects.filter(is_published=True).order_by('-updated_date')

    def location(self, element):
        return reverse('static_page', args=[element.slug])

    def lastmod(self, element):
        return element.updated_date

    def get_index_metadata(self):
        metadata = StaticPage.objects.filter(is_published=True).aggregate(
            item_count=Count('pk'),
            latest_lastmod=Max('updated_date'),
        )
        return metadata['item_count'], metadata['latest_lastmod']


sitemaps = {
    'site': SiteSitemap,
    'user': UserSitemap,
    'posts': PostsSitemap,
    'series': SeriesSitemap,
    'staticpages': StaticPageSitemap,
}
