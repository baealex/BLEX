from django.contrib.sitemaps import Sitemap
from django.urls import reverse
from django.conf import settings

from board.models import Post, Series


class SiteSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 1.0

    def items(self):
        return [
            '',
            '/tags',
            '/authors',
            '/about',
            '/user/sitemap.xml',
            '/posts/sitemap.xml',
            '/series/sitemap.xml',
        ]

    def location(self, item):
        return str(item)


class UserSitemap(Sitemap):
    changefreq = 'monthly'
    priority = 0.6

    def items(self):
        users = Post.objects.filter(config__hide=False).values_list('author__username', flat=True).distinct()
        return users

    def location(self, item):
        return reverse('user_profile', args=[item])


class PostsSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.9

    def items(self):
        return Post.objects.filter(config__hide=False).select_related('author').order_by('-updated_date')

    def location(self, element):
        return reverse('post_detail', args=[element.author.username, element.url])

    def lastmod(self, element):
        return element.updated_date


class SeriesSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.7

    def items(self):
        return Series.objects.filter(hide=False, posts__config__hide=False).select_related('owner').distinct().order_by('-updated_date')

    def location(self, element):
        return reverse('series_detail', args=[element.owner.username, element.url])

    def lastmod(self, element):
        return element.updated_date


sitemaps = {
    'static': SiteSitemap,
}

sitemap_section = {
    'user': UserSitemap,
    'posts': PostsSitemap,
    'series': SeriesSitemap,
}
