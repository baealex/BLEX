from django.contrib.sitemaps import Sitemap
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
            '/authors',
        ]

    def location(self, item):
        return str(item)


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


class StaticPageSitemap(Sitemap):
    changefreq = 'monthly'
    priority = 0.8

    def items(self):
        return StaticPage.objects.filter(is_published=True).order_by('-updated_date')

    def location(self, element):
        return reverse('static_page', args=[element.slug])

    def lastmod(self, element):
        return element.updated_date


sitemaps = {
    'site': SiteSitemap,
    'user': UserSitemap,
    'posts': PostsSitemap,
    'series': SeriesSitemap,
    'staticpages': StaticPageSitemap,
}
